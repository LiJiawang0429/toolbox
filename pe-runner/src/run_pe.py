"""
PE 跑数脚本（通用版）
=====================

文件用途：
    给定一个 PE（Prompt Engineering）模板 + CSV 输入数据，调用 LLM API 并发跑数，
    自动解析 JSON 输出并写入结果 CSV；可选地根据 GT 列计算分类指标。

特性：
  - 支持任意 PE 模板（通过 {{Input_prompt}} 占位符注入输入文本，占位符可自定义）
  - 多线程并发请求，带限流/超时自动重试与 Key 切换（由 llm_client.py 实现）
  - 动态解析 JSON 输出：自动提取所有字段，无需预定义列名
  - 保留原始 CSV 字段，追加解析结果列 + raw_output
  - 输出按输入文件原始行号排序（不被内部随机打乱影响）
  - 可选评估指标：整体准确率 + 各类 Precision/Recall/F1 + 混淆矩阵 + 标签归一化

依赖：
  - openai
  - httpx
  - python-dotenv
  - tqdm
  - dirtyjson (可选，提供更宽松的 JSON 解析)

用法示例：
  python run_pe.py \\
      --source-file input.csv \\
      --pe-file prompts/example_pe.md \\
      --input-field "request" \\
      --out-csv output.csv \\
      --workers 200

  # 启用评估指标（必须显式同时提供 --gt-field 和 --pred-field）
  python run_pe.py \\
      --source-file input.csv \\
      --pe-file prompts/example_pe.md \\
      --input-field "request" \\
      --gt-field "label" \\
      --pred-field "sentiment"
"""
import argparse
import csv
import json
import logging
import random
import re
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from tqdm import tqdm

# ========== 路径配置（基于脚本位置自动推导，不依赖当前工作目录） ==========
BASE_DIR = Path(__file__).resolve().parent          # src/
PROJECT_DIR = BASE_DIR.parent                        # pe-runner/
PROMPT_DIR = BASE_DIR / "prompts"
LLM_CALL_PATH = BASE_DIR / "llm_client.py"           # LLM 客户端模块
DEFAULT_OUTPUT_DIR = PROJECT_DIR / "outputs"

# ========== 日志配置 ==========
current_date = time.strftime("%Y%m%d_%H%M%S")
DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = DEFAULT_OUTPUT_DIR / "logs" / f"pe_run_{current_date}.log"
(LOG_FILE.parent).mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8-sig"),
    ],
)


# ========== 动态加载 llm_client.call_llm ==========
def _load_call_llm(path: Path):
    """动态加载 LLM 客户端模块，返回其中的 call_llm 函数。

    参数:
        path: llm_client.py 文件的绝对路径

    返回:
        call_llm 函数对象

    异常:
        RuntimeError: 模块无法加载或未导出 call_llm 函数
    """
    spec = spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {path}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    fn = getattr(module, "call_llm", None)
    if fn is None:
        raise RuntimeError(f"{path} 中未找到 call_llm 函数")
    return fn


def _read_prompt(path: Path) -> str:
    """读取 PE 模板文件（UTF-8 BOM 兼容）。"""
    return path.read_text(encoding="utf-8-sig")


def _render_prompt(template: str, input_text: str, placeholder: str = "{{Input_prompt}}") -> str:
    """将 PE 模板中的占位符替换为真实输入文本。"""
    return template.replace(placeholder, input_text)


def _normalize_text_output(text: Any) -> str:
    """去除 markdown 代码块包裹，返回纯文本。"""
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def _extract_json_str(text: str) -> str:
    """从文本中提取首个 {...} 或 [...] 片段。"""
    start_obj = text.find("{")
    start_arr = text.find("[")
    start = -1
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start, end = start_obj, text.rfind("}")
    elif start_arr != -1:
        start, end = start_arr, text.rfind("]")
    else:
        return ""
    if start == -1 or end == -1 or end <= start:
        return ""
    return text[start:end + 1]


def _safe_json_loads(text: str) -> Optional[Any]:
    """容错 JSON 解析：先 json.loads，再 dirtyjson，最后提取片段再试。"""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        import dirtyjson  # type: ignore
        return dirtyjson.loads(text)
    except Exception:
        pass
    snippet = _extract_json_str(text)
    if snippet:
        try:
            return json.loads(snippet)
        except json.JSONDecodeError:
            try:
                import dirtyjson  # type: ignore
                return dirtyjson.loads(snippet)
            except Exception:
                pass
    return None


def _sanitize_for_csv(text: Any) -> str:
    """将文本规范化为 CSV 安全的单行字符串（移除换行/制表符/控制字符）。"""
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"[\x00-\x1f]+", "", text)
    return text.strip()


def _read_all_csv_rows(path: Path) -> List[Dict[str, Any]]:
    """读取 CSV 全部行，返回 dict 列表。"""
    rows: List[Dict[str, Any]] = []
    csv.field_size_limit(2147483647)
    with path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader((line.replace("\0", "") for line in f))
        for row in reader:
            if row:
                rows.append(row)
    return rows


def _process_one(
    call_llm,
    pe_template: str,
    item: Dict[str, Any],
    raw_row: Dict[str, Any],
    placeholder: str,
    temperature: float,
    use_schema: bool,
) -> Dict[str, Any]:
    """处理单条记录：渲染 PE -> 调用 LLM -> 解析 JSON -> 组装结果行。

    参数:
        call_llm:     LLM 调用函数
        pe_template:  PE 模板字符串
        item:         包含 prompt_text 的字典
        raw_row:      原始 CSV 行（作为输出基底）
        placeholder:  PE 中的占位符
        temperature: 采样温度
        use_schema:  是否解析 JSON 输出

    返回:
        组装好的输出行（原始字段 + JSON 解析字段 + raw_output）

    异常:
        RuntimeError: 5 次重试后仍失败
    """
    prompt_text = item["prompt_text"]
    classify_prompt = _render_prompt(pe_template, prompt_text, placeholder)
    last_normalized = ""
    last_err: Optional[BaseException] = None

    for attempt in range(1, 6):
        try:
            out = call_llm(
                user_prompt=classify_prompt,
                temperature=temperature,
                top_p=0.95,
                use_schema=False,  # 自己做容错解析，更可控
            )

            # 检查 LLM 调用是否报错
            if isinstance(out, str) and (
                out in {"模型限流", "模型超时或连接错误"}
                or out.startswith("模型调用错误")
            ):
                raise RuntimeError(f"LLM 调用失败: {out}")

            normalized = _normalize_text_output(out)
            last_normalized = normalized

            result: Dict[str, Any] = {}
            if use_schema:
                parsed = _safe_json_loads(normalized)
                if parsed is None:
                    raise ValueError("JSON 解析失败")
                if isinstance(parsed, dict):
                    result = parsed
                else:
                    # 非 dict（如 list），原样存入 _parsed
                    result = {"_parsed": parsed}

            # 组装输出行：原始字段 + 解析字段 + raw_output
            row_out = {**raw_row}
            for k, v in result.items():
                row_out[k] = _sanitize_for_csv(v) if isinstance(v, str) else v
            row_out["raw_output"] = _sanitize_for_csv(normalized)
            return row_out

        except Exception as e:
            last_err = e
            if attempt >= 5:
                break
            time.sleep(0.5 * attempt)

    # 全部重试失败
    raise RuntimeError(
        f"process_failed:{last_err}|last_out:{last_normalized[:200]}"
    )


# ========== 评估指标 ==========

# 常见标签变体映射（归一化到标准值）
_LABEL_ALIASES: Dict[str, str] = {
    "high": "high", "高": "high", "高风险": "high", "高危": "high",
    "medium": "medium", "中": "medium", "中风险": "medium",
    "low": "low", "低": "low", "低风险": "low",
    "none": "none", "无": "none", "无风险": "none",
    "yes": "yes", "是": "yes", "true": "yes",
    "no": "no", "否": "no", "false": "no",
    "正": "positive", "positive": "positive",
    "负": "negative", "negative": "negative",
}


def _normalize_label_value(val: Any) -> str:
    """将标签值归一化为小写字符串，处理常见中英文变体。"""
    if val is None:
        return ""
    s = str(val).strip().lower()
    if not s:
        return ""
    if s in _LABEL_ALIASES:
        return _LABEL_ALIASES[s]
    return s


def _calc_metrics(
    results: List[Dict[str, Any]],
    gt_field: str,
    pred_field: str,
) -> Tuple[str, Dict[str, Any]]:
    """计算整体准确率 + 各类 Precision / Recall / F1 + 混淆矩阵。

    参数:
        results:     跑数结果列表
        gt_field:    GT（人工标注真值）所在的 CSV 列名
        pred_field:  模型 JSON 输出中作为预测结果的字段名

    返回:
        (report_text, metrics_dict)
        - report_text: 人类可读的指标报告
        - metrics_dict: 程序可读的指标字典（含 accuracy/per_class/confusion_matrix）
    """
    gt_vals: List[str] = []
    pred_vals: List[str] = []
    skipped_error = 0
    skipped_missing_gt = 0
    skipped_missing_pred = 0

    for row in results:
        if row.get("_error"):
            skipped_error += 1
            continue

        gt_raw = row.get(gt_field, "")
        gt_norm = _normalize_label_value(gt_raw)
        if not gt_norm:
            skipped_missing_gt += 1
            continue

        pred_raw = row.get(pred_field, "")
        pred_norm = _normalize_label_value(pred_raw)
        if not pred_norm:
            skipped_missing_pred += 1
            continue

        gt_vals.append(gt_norm)
        pred_vals.append(pred_norm)

    valid_n = len(gt_vals)
    all_labels = sorted(set(gt_vals) | set(pred_vals))

    # ---- 整体准确率 ----
    correct = sum(1 for g, p in zip(gt_vals, pred_vals) if g == p)
    accuracy = correct / valid_n if valid_n > 0 else 0.0

    # ---- 混淆矩阵 ----
    confusion: Dict[str, Dict[str, int]] = {
        l: {l2: 0 for l2 in all_labels} for l in all_labels
    }
    for g, p in zip(gt_vals, pred_vals):
        confusion[g][p] += 1

    # ---- 各类 Precision / Recall / F1 ----
    per_class: Dict[str, Dict[str, float]] = {}
    for label in all_labels:
        tp = confusion[label][label]
        # FN: GT=label 但 Pred≠label
        fn = sum(confusion[label][l] for l in all_labels if l != label)
        # FP: Pred=label 但 GT≠label
        fp = sum(confusion[g][label] for g in all_labels if g != label)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        per_class[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": tp + fn,  # GT 中该类样本数
            "tp": tp, "fp": fp, "fn": fn,
        }

    # ---- 组装报告文本 ----
    lines: List[str] = []
    lines.append("=" * 60)
    lines.append("评估指标报告")
    lines.append("=" * 60)
    lines.append(f"GT 字段:   {gt_field}")
    lines.append(f"Pred 字段: {pred_field}")
    lines.append(f"有效样本数: {valid_n} / {len(results)}")
    if skipped_error:
        lines.append(f"  跳过（处理失败）: {skipped_error}")
    if skipped_missing_gt:
        lines.append(f"  跳过（GT 为空）: {skipped_missing_gt}")
    if skipped_missing_pred:
        lines.append(f"  跳过（Pred 为空）: {skipped_missing_pred}")
    lines.append("")

    lines.append(f"整体准确率 (Accuracy): {correct}/{valid_n} = {accuracy:.4f}")
    lines.append("")

    lines.append("各类指标:")
    lines.append(f"{'label':<12}{'precision':>12}{'recall':>12}{'f1':>12}{'support':>10}")
    lines.append("-" * 60)
    weighted_p = 0.0
    weighted_r = 0.0
    weighted_f1 = 0.0
    total_support = 0
    for label in all_labels:
        m = per_class[label]
        lines.append(
            f"{label:<12}{m['precision']:>12.4f}{m['recall']:>12.4f}"
            f"{m['f1']:>12.4f}{m['support']:>10d}"
        )
        w = m["support"]
        weighted_p += m["precision"] * w
        weighted_r += m["recall"] * w
        weighted_f1 += m["f1"] * w
        total_support += w
    if total_support > 0:
        lines.append("-" * 60)
        lines.append(
            f"{'macro':<12}{weighted_p/total_support:>12.4f}"
            f"{weighted_r/total_support:>12.4f}"
            f"{weighted_f1/total_support:>12.4f}{total_support:>10d}"
        )
    lines.append("")

    # 混淆矩阵
    if len(all_labels) > 1:
        lines.append("混淆矩阵 (行=GT, 列=Pred):")
        header = f"{'':<12}" + "".join(f"{l:>10}" for l in all_labels)
        lines.append(header)
        for gt_l in all_labels:
            row_str = f"{gt_l:<12}" + "".join(
                f"{confusion[gt_l][p]:>10d}" for p in all_labels
            )
            lines.append(row_str)

    report_text = "\n".join(lines)
    metrics_dict = {
        "accuracy": accuracy,
        "correct": correct,
        "total": valid_n,
        "per_class": per_class,
        "confusion_matrix": confusion,
        "all_labels": all_labels,
        "skipped": {
            "error": skipped_error,
            "missing_gt": skipped_missing_gt,
            "missing_pred": skipped_missing_pred,
        },
    }
    return report_text, metrics_dict


def _parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    p = argparse.ArgumentParser(description="PE 跑数脚本（通用版）")
    p.add_argument("--source-file", type=str, required=True,
                   help="输入 CSV 文件路径")
    p.add_argument("--pe-file", type=str, required=True,
                   help="PE 模板文件路径（.md/.txt）")
    p.add_argument("--out-csv", type=str, default=None,
                   help="输出 CSV 路径（默认: outputs/跑数结果_<时间>.csv）")
    p.add_argument("--input-field", type=str, default="request",
                   help="从 CSV 哪个列读取待分析文本（默认: request）")
    p.add_argument("--placeholder", type=str, default="{{Input_prompt}}",
                   help="PE 模板中的占位符（默认: {{Input_prompt}}）")
    p.add_argument("--total", type=int, default=100000,
                   help="最多处理多少条（默认: 100000）")
    p.add_argument("--workers", type=int, default=200,
                   help="并发线程数（默认: 200）")
    p.add_argument("--max-inflight", type=int, default=0,
                   help="最大在途请求数，0=自动(=workers*4)")
    p.add_argument("--seed", type=int, default=42,
                   help="随机打乱种子（默认: 42）")
    p.add_argument("--temperature", type=float, default=1.0,
                   help="采样温度（默认: 1.0）")
    p.add_argument("--no-schema", action="store_true",
                   help="不解析 JSON，仅保留原始文本输出")
    p.add_argument("--gt-field", type=str, default=None,
                   help="GT（人工标注真值）所在的 CSV 列名，提供后自动计算准确率和各类准召")
    p.add_argument("--pred-field", type=str, default=None,
                   help="模型 JSON 输出中作为预测结果的字段名（如 sentiment）。"
                        "提供 --gt-field 时必须显式指定，不允许与 GT 同列")
    return p.parse_args()


def main() -> None:
    """主入口：解析参数 -> 加载 LLM -> 读 CSV -> 并发跑数 -> 写 CSV -> （可选）算指标。"""
    args = _parse_args()

    # 加载 call_llm
    call_llm = _load_call_llm(LLM_CALL_PATH)
    logging.info(f"已加载 LLM 模块: {LLM_CALL_PATH}")

    # 读取 PE 模板
    pe_path = Path(args.pe_file).resolve()
    if not pe_path.exists():
        raise RuntimeError(f"PE 文件不存在: {pe_path}")
    pe_template = _read_prompt(pe_path)
    logging.info(f"已加载 PE 模板: {pe_path}")

    # 读取输入 CSV
    source_file = Path(args.source_file).resolve()
    if not source_file.exists():
        raise RuntimeError(f"输入文件不存在: {source_file}")
    all_rows = _read_all_csv_rows(source_file)
    if not all_rows:
        raise RuntimeError(f"输入文件无有效数据: {source_file}")

    input_field = args.input_field
    first_keys = list(all_rows[0].keys())
    if input_field not in first_keys:
        raise RuntimeError(
            f"输入字段 '{input_field}' 不存在于 CSV 中。现有字段: {first_keys}"
        )
    logging.info(f"输入字段: {input_field}")
    logging.info(f"CSV 原始字段: {first_keys}")

    # 校验 GT 字段（如果提供）
    gt_field = args.gt_field
    if gt_field is not None and gt_field not in first_keys:
        raise RuntimeError(
            f"GT 字段 '{gt_field}' 不存在于 CSV 中。现有字段: {first_keys}"
        )
    # Pred 字段必须显式指定（即模型 JSON 输出的列名），不允许 fallback 到 gt_field
    pred_field = args.pred_field
    if gt_field is not None and pred_field is None:
        raise RuntimeError(
            f"提供了 --gt-field='{gt_field}'，必须同时显式指定 --pred-field "
            f"(模型 JSON 输出中作为预测结果的字段名)。"
            f"可用字段: {first_keys}"
        )
    if pred_field is not None:
        logging.info(f"GT 字段: {gt_field} | Pred 字段: {pred_field}")

    # 给每行打上原始索引（用于跑完后恢复输入顺序）
    for idx, row in enumerate(all_rows):
        row["_original_index"] = idx

    # 过滤空值 + 随机打乱
    rng = random.Random(int(args.seed))
    rng.shuffle(all_rows)
    valid_rows = [row for row in all_rows if row.get(input_field, "")]
    total_target = min(max(0, int(args.total)), len(valid_rows))
    selected_rows = valid_rows[:total_target]
    logging.info(
        f"总行数: {len(all_rows)}, 有效行数: {len(valid_rows)}, 目标处理数: {total_target}"
    )

    if total_target == 0:
        logging.warning("没有有效数据可处理")
        return

    # 输出路径
    out_path = Path(args.out_csv) if args.out_csv else (
        DEFAULT_OUTPUT_DIR / f"跑数结果_{current_date}.csv"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    use_schema = not args.no_schema
    max_inflight = (
        int(args.max_inflight) if int(args.max_inflight) > 0
        else max(1, int(args.workers) * 4)
    )

    # 先处理所有数据，收集结果（内存中），以便动态收集 JSON 字段
    results: List[Dict[str, Any]] = []
    failed_count = 0

    submitted = 0
    inflight: Dict[Any, Dict[str, Any]] = {}

    pbar = tqdm(total=total_target, desc="跑数", unit="row")
    try:
        with ThreadPoolExecutor(max_workers=int(args.workers)) as ex:
            while len(results) + failed_count < total_target:
                # 提交新任务
                while (
                    len(inflight) < max_inflight
                    and len(results) + len(inflight) + failed_count < total_target
                ):
                    if submitted >= len(selected_rows):
                        break
                    row = selected_rows[submitted]
                    submitted += 1
                    prompt_text = row.get(input_field, "")
                    if not prompt_text:
                        continue
                    item = {"prompt_text": prompt_text}
                    fut = ex.submit(
                        _process_one,
                        call_llm, pe_template, item, row,
                        args.placeholder, args.temperature, use_schema,
                    )
                    inflight[fut] = row

                if not inflight:
                    break

                done, _ = wait(set(inflight.keys()), return_when=FIRST_COMPLETED)
                for fut in done:
                    raw_row = inflight.pop(fut)
                    try:
                        row_out = fut.result()
                        results.append(row_out)
                    except Exception as e:
                        failed_count += 1
                        fail_row = {
                            **raw_row,
                            "raw_output": "",
                            "_error": str(e),
                        }
                        results.append(fail_row)
                    pbar.update(1)
    finally:
        pbar.close()

    # 按输入文件原始顺序排序（而非乱序返回）
    results.sort(key=lambda r: int(r.get("_original_index", 0)))

    # 动态收集所有 JSON 解析出的字段（排除原始 CSV 字段和保留字段）
    reserved_fields = {"raw_output", "_error", "_original_index"}
    original_field_set = set(first_keys) | {"_original_index"}
    extra_json_keys: List[str] = []
    seen_keys = set()
    for r in results:
        for k in r.keys():
            if k in original_field_set or k in reserved_fields:
                continue
            if k not in seen_keys:
                seen_keys.add(k)
                extra_json_keys.append(k)

    # 组装最终输出字段顺序：原始字段 + JSON 解析字段 + 保留字段，去重保持顺序
    fieldnames = list(first_keys) + extra_json_keys + ["raw_output", "_error"]
    seen = set()
    final_fieldnames = []
    for f in fieldnames:
        if f not in seen:
            seen.add(f)
            final_fieldnames.append(f)

    # 写入 CSV
    with out_path.open("w", encoding="utf-8-sig", newline="") as f_out:
        writer = csv.DictWriter(
            f_out, fieldnames=final_fieldnames, quoting=csv.QUOTE_MINIMAL,
            extrasaction="ignore",  # 自动忽略 _original_index 等未列入 fieldnames 的内部字段
        )
        writer.writeheader()
        for row in results:
            # 确保所有字段都有值
            for fn in final_fieldnames:
                if fn not in row:
                    row[fn] = ""
            writer.writerow(row)

    logging.info(
        f"跑数完成！成功: {len(results) - failed_count}, 失败: {failed_count}, "
        f"输出: {out_path}"
    )
    print(f"\n跑数完成！成功: {len(results) - failed_count}, 失败: {failed_count}")
    print(f"输出文件: {out_path}")
    print(f"日志文件: {LOG_FILE}")

    # ---- 计算评估指标（如果提供了 gt-field） ----
    if gt_field is not None:
        report_text, metrics = _calc_metrics(results, gt_field, pred_field)
        print(f"\n{report_text}")
        metrics_file = DEFAULT_OUTPUT_DIR / f"metrics_{current_date}.txt"
        metrics_file.write_text(report_text, encoding="utf-8-sig")
        # 同时写一份 JSON 便于后续程序读取
        metrics_json_file = DEFAULT_OUTPUT_DIR / f"metrics_{current_date}.json"
        metrics_json_file.write_text(
            json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8-sig"
        )
        logging.info(f"指标报告已写入: {metrics_file}")
        print(f"指标报告: {metrics_file}")
        print(f"指标 JSON: {metrics_json_file}")

        # GT/Pred 类别不匹配警告
        gt_labels = set()
        pred_labels = set()
        for row in results:
            if row.get("_error"):
                continue
            g = _normalize_label_value(row.get(gt_field, ""))
            p = _normalize_label_value(row.get(pred_field, ""))
            if g:
                gt_labels.add(g)
            if p:
                pred_labels.add(p)
        only_gt = gt_labels - pred_labels
        only_pred = pred_labels - gt_labels
        if only_gt:
            msg = f"注意：GT 中有 {only_gt}，但 Pred 中未出现"
            logging.warning(msg)
            print(f"\n⚠️  {msg}")
        if only_pred:
            msg = f"注意：Pred 中有 {only_pred}，但 GT 中未出现"
            logging.warning(msg)
            print(f"⚠️  {msg}")


if __name__ == "__main__":
    main()
