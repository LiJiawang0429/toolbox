"""
LLM API 封装模块（OpenAI 兼容接口）
==================================

文件用途：
    封装一个支持多 Key 轮换、限流/超时重试、容错 JSON 解析的 LLM 调用入口，
    供 run_pe.py 通过动态加载方式调用。

设计要点：
    - 基于 OpenAI Python SDK，兼容任意 OpenAI 协议的 LLM 服务
    - 多 Key 轮换：配置主 Key + 多个备用 Key，遇限流(429/TPM/RPM)或超时自动切换
    - 指数退避重试：默认 5 次，base/cap 通过 env 可调
    - JSON 容错解析：json.loads → dirtyjson → 提取 {...} 片段再解析

环境变量（详见 llm_client.env.example）：
    API_KEY                 主 API Key（必需）
    API_KEY_FALLBACK_1      备用 Key 1（可选，启用多 Key 轮换）
    API_KEY_FALLBACK_2      备用 Key 2（可选）
    BASE_URL                API Endpoint（必需）
    MODEL_NAME              模型名称（必需，从 env 读取，无硬编码）
    MAX_TOKENS              单次最大 tokens，默认 16384
    HTTP_TIMEOUT            HTTP 超时秒数，默认 300
    LLM_RETRIES             最大重试次数，默认 5
    LLM_RETRY_BASE_SLEEP    重试基础等待秒数，默认 1.0
    LLM_RETRY_MAX_SLEEP     重试最大等待秒数（上限），默认 30.0
"""

import json
import os
import re
import time
import logging
import threading
from pathlib import Path

import httpx
from openai import OpenAI

try:
    import dirtyjson  # type: ignore
except Exception:
    dirtyjson = None

from dotenv import load_dotenv

# 自动加载同目录下的 .env（如果存在）
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

# 线程本地存储：保证多线程下 client / key 索引独立
_tls = threading.local()
_model_printed = False
_print_lock = threading.Lock()


def _fallback_keys() -> list:
    """收集所有已配置的备用 Key（用于多 Key 轮换）。"""
    return [k for k in [os.getenv("API_KEY_FALLBACK_1"), os.getenv("API_KEY_FALLBACK_2")] if k]


def _switch_key_if_needed():
    """遇限流/超时时，切换到下一个 API Key。"""
    keys = _fallback_keys()
    if len(keys) > 1:
        _tls.current_key_index = getattr(_tls, "current_key_index", 0) + 1
        _tls.client = None  # 清缓存，强制重建 client


def _get_client() -> OpenAI:
    """获取/初始化当前线程的 OpenAI client。

    Key 选择优先级：备用 Key 池（轮换索引）→ 主 Key（API_KEY）。
    """
    client = getattr(_tls, "client", None)
    if client is not None:
        return client

    api_key = os.getenv("API_KEY")
    base_url = os.getenv("BASE_URL")

    fallback_keys = _fallback_keys()
    if fallback_keys:
        idx = getattr(_tls, "current_key_index", 0) % len(fallback_keys)
        api_key = fallback_keys[idx]

    if not api_key:
        raise RuntimeError("缺少 API Key，请在 .env 中配置 API_KEY")
    if not base_url:
        raise RuntimeError("缺少 BASE_URL，请在 .env 中配置 BASE_URL")

    timeout_s = float(os.getenv("HTTP_TIMEOUT") or "300")
    http_client = httpx.Client(timeout=httpx.Timeout(timeout_s), trust_env=False)
    client = OpenAI(base_url=base_url, api_key=api_key, http_client=http_client)
    _tls.client = client
    return client


def _get_model_name() -> str:
    """获取当前使用的模型名称（完全从 env 读取，无硬编码）。"""
    global _model_printed
    model_name = os.getenv("MODEL_NAME")
    if not model_name:
        raise RuntimeError("缺少模型名称，请在 .env 中配置 MODEL_NAME")

    if not _model_printed:
        with _print_lock:
            if not _model_printed:
                logging.info(f"[配置] 当前跑数使用的模型为: {model_name}")
                _model_printed = True
    return model_name


def _get_max_tokens() -> int:
    return int(os.getenv("MAX_TOKENS") or "16384")


def _get_retries() -> int:
    return int(os.getenv("LLM_RETRIES") or "5")


def _sleep_s(attempt: int) -> float:
    """指数退避：base * 2^attempt，但不超过 cap。"""
    base = float(os.getenv("LLM_RETRY_BASE_SLEEP") or "1.0")
    cap = float(os.getenv("LLM_RETRY_MAX_SLEEP") or "30.0")
    return min(cap, base * (2 ** attempt))


def _strip_markdown_codeblock(text: str) -> str:
    """去除 ```json ... ``` 形式的 markdown 包裹。"""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r'^```(json|python)?\s*', '', t, flags=re.IGNORECASE)
        t = re.sub(r'\s*```$', '', t.strip())
    return t


def call_llm(user_prompt=None, messages=None, temperature=1, top_p=0.95,
             use_schema=False, schema=None, on_rate_limit=None):
    """调用语言模型。

    参数:
        user_prompt:    纯文本用户提示词（与 messages 二选一）
        messages:       OpenAI messages 格式（与 user_prompt 二选一）
        temperature:    采样温度
        top_p:          核采样概率
        use_schema:     是否要求返回 JSON 并解析
        schema:         预留：JSON Schema 约束（当前实现走自然语言 JSON 输出）
        on_rate_limit:  限流回调

    返回:
        use_schema=True  -> dict / list / None（解析后的 JSON 对象）
        use_schema=False -> str（模型原始文本输出）
        遇到不可恢复错误时返回错误描述字符串
    """
    if messages is None:
        if user_prompt is None:
            raise ValueError("必须提供 user_prompt 或 messages")
        messages = [{"role": "user", "content": user_prompt}]

    max_retries = _get_retries()
    for attempt in range(max_retries):
        try:
            client = _get_client()
            model_name = _get_model_name()
            max_tokens = _get_max_tokens()

            completion = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                seed=42,
            )
            content = completion.choices[0].message.content

        except Exception as e:
            err_str = str(e).lower()
            # 判断是否限流
            is_rate_limit = (
                "429" in err_str
                or "tpm" in err_str
                or "rpm" in err_str
                or "rate limit" in err_str
                or "too many requests" in err_str
            )
            # 判断是否超时/网络异常
            is_timeout = isinstance(e, (httpx.ReadTimeout, httpx.TimeoutException))

            if is_rate_limit or is_timeout:
                if on_rate_limit:
                    try:
                        on_rate_limit()
                    except Exception:
                        pass
                if attempt < max_retries - 1:
                    reason = "限流(429/TPM)" if is_rate_limit else f"超时/网络异常({type(e).__name__})"
                    logging.warning(
                        f"[Thread-{threading.get_ident()}] 遇到 {reason}，切换备用 Key 重试..."
                    )
                    _switch_key_if_needed()
                    time.sleep(_sleep_s(attempt))
                    continue
                error_msg = "模型限流" if is_rate_limit else f"模型超时或连接错误: {str(e)}"
                logging.error(error_msg)
                return error_msg

            # 其他错误
            if attempt < max_retries - 1:
                time.sleep(_sleep_s(attempt))
                continue
            error_msg = f"模型调用错误: {str(e)}"
            logging.error(error_msg)
            return error_msg

        # ---- 拿到正常输出，处理 ----
        content = _strip_markdown_codeblock(content)

        if use_schema:
            # 尝试从输出中提取并解析 JSON
            parsed = _try_parse_json(content)
            if parsed is not None:
                return parsed

            # JSON 解析失败，重试
            if attempt < max_retries - 1:
                logging.warning(f"[Thread-{threading.get_ident()}] JSON 解析失败，重试...")
                time.sleep(_sleep_s(attempt))
                continue
            logging.error("JSON 解析失败（达到最大重试次数）")
            return None

        # 不需要 JSON 解析，直接返回文本
        return content

    return "模型调用错误: 达到最大重试次数"


def _try_parse_json(text: str):
    """尝试从文本中提取并解析 JSON，支持宽松解析。"""
    if not text:
        return None

    # 1. 直接 json.loads
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. dirtyjson（容错更强）
    if dirtyjson is not None:
        try:
            return dirtyjson.loads(text)
        except Exception:
            pass

    # 3. 提取第一个 {...} 或 [...] 块再解析
    start_obj = text.find("{")
    start_arr = text.find("[")
    start = -1
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start = start_obj
        end = text.rfind("}")
    elif start_arr != -1:
        start = start_arr
        end = text.rfind("]")
    else:
        return None

    if start == -1 or end == -1 or end <= start:
        return None

    snippet = text[start:end + 1]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        if dirtyjson is not None:
            try:
                return dirtyjson.loads(snippet)
            except Exception:
                pass
    return None


if __name__ == "__main__":
    # 冒烟测试：调用模型输出一段 JSON
    result = call_llm("请输出 JSON: {\"status\": \"ok\"}", use_schema=True)
    print("模型返回:", result)
