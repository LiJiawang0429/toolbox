# PE Runner

> 通用 Prompt Engineering 跑数工具：给定一个 PE 模板 + CSV 输入数据，并发调用任意 OpenAI 兼容的 LLM API，自动解析 JSON 输出并写入结果 CSV，可选地根据 GT 列计算分类指标（Accuracy / Precision / Recall / F1 / 混淆矩阵）。

![Python](https://img.shields.io/badge/python-3.8+-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-stable-brightgreen)

纯个人兴趣项目，与任何公司/组织无关。

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [CLI 参数](#cli-参数)
- [输出格式](#输出格式)
- [评估指标](#评估指标可选)
- [常见问题 FAQ](#常见问题-faq)
- [后续计划 Roadmap](#后续计划-roadmap)

---

## 功能特性

- 🎯 **通用 PE 模板**：任意 `.md` / `.txt` 模板，通过 `{{Input_prompt}}` 占位符注入输入文本（占位符可自定义）
- ⚡ **多线程并发**：内置线程池 + 在途请求限流，单机数百并发；限流/超时自动指数退避重试
- 🔑 **多 Key 轮换**：配置主 Key + 备用 Key 后，遇 429/TPM/RPM/超时自动切换，不阻塞跑数
- 🧩 **动态 JSON 字段**：自动探测模型返回 JSON 中所有 key 并取并集，**无需预定义列名**，适配任意 PE
- 🛡️ **三级 JSON 容错**：`json.loads` → `dirtyjson` → 提取 `{...}` 片段再解析
- 📊 **内置评估指标**：提供 GT 列后自动算 Accuracy / 各类 P/R/F1 / 混淆矩阵 + 中英文标签归一化
- 📋 **输出顺序稳定**：始终按输入文件原始行号排序，方便对比检查
- 🌐 **任意 LLM 兼容**：基于 OpenAI Python SDK，兼容所有 OpenAI 协议的服务

---

## 快速开始

### 环境要求

- Python ≥ 3.8
- 任一 OpenAI 兼容的 LLM API（OpenAI / Azure OpenAI / 各类兼容服务）

### 1. 安装依赖

```bash
git clone <your-repo-url>
cd pe-runner
pip install -r requirements.txt
```

### 2. 配置 API Key

复制 `.env.example` 为 `src/.env`，填入你的真实配置：

```bash
cp src/llm_client.env.example src/.env
```

编辑 `src/.env`：

```ini
API_KEY="your_api_key_here"
BASE_URL="https://api.openai.com/v1"
MODEL_NAME="gpt-4o-mini"
```

> `.env` 已被 `.gitignore` 忽略，不会被提交。

### 3. 最小运行示例

使用仓库内置的情感分类示例数据跑一次：

```bash
# 跑数（仅生成结果 CSV）
./run.sh examples/sample_input.csv

# 跑数 + 算指标（GT 列 = label，Pred 列 = sentiment）
./run.sh examples/sample_input.csv --gt-field "label" --pred-field "sentiment"
```

跑完后产物：

```
outputs/
├── 跑数结果_<时间>.csv      # 完整跑数结果
├── metrics_<时间>.txt       # 指标报告（人类可读）
├── metrics_<时间>.json      # 指标数据（程序可读）
└── logs/pe_run_<时间>.log   # 运行日志
```

---

## 项目结构

```text
pe-runner/
├── README.md                          # 本文档
├── LICENSE                            # MIT License
├── .gitignore                         # Git 忽略规则
├── requirements.txt                   # Python 依赖
├── run.sh                             # 一键启动脚本（简化模式 + 完整模式）
├── src/
│   ├── run_pe.py                      # 跑数主脚本（CLI 入口）
│   ├── llm_client.py                  # LLM API 封装（多 Key 轮换 + 重试 + JSON 容错）
│   ├── llm_client.env.example         # 配置模板（复制为 .env 使用）
│   └── prompts/
│       └── example_pe.md              # 示例 PE 模板（情感分类）
├── examples/
│   └── sample_input.csv               # 示例输入数据（虚构，10 条）
└── outputs/                           # 跑数产物输出目录
    └── .gitkeep
```

---

## 配置说明

所有配置通过环境变量读取（来自 `src/.env`），完整列表：

| 变量 | 必需 | 默认值 | 说明 |
|-|:-:|-|-|
| `API_KEY` | ✅ | — | 主 API Key |
| `BASE_URL` | ✅ | — | API Endpoint，OpenAI 兼容协议 |
| `MODEL_NAME` | ✅ | — | 模型名称（从 env 读取，无硬编码） |
| `API_KEY_FALLBACK_1` | ❌ | — | 备用 Key 1（启用多 Key 轮换） |
| `API_KEY_FALLBACK_2` | ❌ | — | 备用 Key 2 |
| `MAX_TOKENS` | ❌ | `16384` | 单次请求最大 tokens |
| `HTTP_TIMEOUT` | ❌ | `300` | HTTP 超时秒数 |
| `LLM_RETRIES` | ❌ | `5` | 限流/超时最大重试次数 |
| `LLM_RETRY_BASE_SLEEP` | ❌ | `1.0` | 指数退避基础等待秒数 |
| `LLM_RETRY_MAX_SLEEP` | ❌ | `30.0` | 指数退避单次等待上限 |

---

## CLI 参数

| 参数 | 类型 | 默认值 | 说明 |
|-|-|-|-|
| `--source-file` | str | **必填** | 输入 CSV 文件路径 |
| `--pe-file` | str | **必填** | PE 模板文件路径（`.md` / `.txt`） |
| `--out-csv` | str | `outputs/跑数结果_<时间>.csv` | 输出 CSV 路径 |
| `--input-field` | str | `request` | 从 CSV 哪列读取待分析文本 |
| `--placeholder` | str | `{{Input_prompt}}` | PE 模板中的占位符 |
| `--total` | int | `100000` | 最多处理条数 |
| `--workers` | int | `200` | 并发线程数 |
| `--max-inflight` | int | `0`(=`workers×4`) | 最大在途请求数 |
| `--seed` | int | `42` | 随机打乱种子 |
| `--temperature` | float | `1.0` | 采样温度 |
| `--no-schema` | flag | — | 不解析 JSON，仅保留原始文本输出 |
| `--gt-field` | str | — | GT（人工标注）所在的 CSV 列名，提供后自动计算指标 |
| `--pred-field` | str | — | 模型 JSON 输出中作为预测结果的字段名。**提供 `--gt-field` 时必须显式指定** |

---

## 输出格式

输出 CSV 包含：

1. **原始 CSV 全部字段**（原样保留）
2. **JSON 解析字段**（动态生成）— 模型返回 JSON 中的每个 key 自动成为一列，列名 = JSON key
3. `raw_output` — 模型原始文本输出（含容错清洗后文本）
4. `_error` — 处理失败的错误信息（成功则为空）

> JSON 字段是**动态探测**的：脚本自动收集所有成功解析结果中出现的 JSON key，取并集作为输出列。无需预定义列名，适配任意 PE。

输出 CSV **始终按输入文件的原始行号排序**，不被内部随机打乱影响，方便与原数据对比检查。

---

## 评估指标（可选）

提供 `--gt-field` 后，脚本自动计算：

| 指标 | 说明 |
|-|-|
| **整体准确率 (Accuracy)** | 正确预测数 / 有效样本数 |
| **各类 Precision** | TP / (TP + FP)，该类被模型判对的比例 |
| **各类 Recall** | TP / (TP + FN)，该类被模型找全的比例 |
| **各类 F1** | 2PR / (P + R)，准召调和平均 |
| **Weighted F1** | 按各类 support 加权的 F1 |
| **混淆矩阵** | 行=GT，列=Pred，直观看错在哪 |

### 关键：GT 和 Pred 必须显式分开

- `--gt-field` 是 CSV 中**人工标注**的列名
- `--pred-field` 是**模型 JSON 输出**中作为预测结果的字段名

两者通常不同，脚本不会自动 fallback，避免误用同一列得到虚高准确率。

### 标签归一化

GT 和 Pred 的标签会自动归一化后再对比，常见变体映射：

```
高 / 高风险 / high / High  →  high
低 / 低风险 / low          →  low
无 / 无风险 / none         →  none
是 / yes / true            →  yes
```

### 使用示例

```bash
# 必须显式指定 GT 列 + Pred 列（两者不能相同）
./run.sh "data.csv" --gt-field "label" --pred-field "sentiment"

# 不需要算指标就别传
./run.sh "data.csv"
```

### 输出文件

```
outputs/
├── 跑数结果_<时间>.csv      # 完整跑数结果（按输入顺序）
├── metrics_<时间>.txt       # 指标报告（人类可读）
├── metrics_<时间>.json      # 指标数据（程序可读）
└── logs/pe_run_<时间>.log   # 运行日志
```

### 控制台输出示例

```
============================================================
评估指标报告
============================================================
GT 字段:   label
Pred 字段: sentiment
有效样本数: 195 / 207
  跳过（处理失败）: 3
  跳过（GT 为空）: 2
  跳过（Pred 为空）: 7

整体准确率 (Accuracy): 172/195 = 0.8821

各类指标:
label         precision      recall          f1    support
------------------------------------------------------------
high              0.9091      0.8696      0.8889        46
low               0.8571      0.9091      0.8824        55
none              0.8878      0.8681      0.8778        94
------------------------------------------------------------
macro             0.8820      0.8821      0.8820       195

混淆矩阵 (行=GT, 列=Pred):
              high       low      none
high            40         3         3
low              2        50         3
none             2         9        83
```

---

## 常见问题 FAQ

### Q1: 报错「缺少 API Key」或「缺少 BASE_URL」？

`src/.env` 未创建或字段为空。请执行：

```bash
cp src/llm_client.env.example src/.env
# 然后编辑 src/.env 填入真实值
```

### Q2: 跑数速度很慢，如何优化？

- 增大 `--workers`（默认 200，单机一般可到 500+）
- 增大 `--max-inflight`（默认 `workers×4`，提高在途请求数）
- 如果模型端限流严重，在 `.env` 中配置 `API_KEY_FALLBACK_1` / `API_KEY_FALLBACK_2` 启用多 Key 轮换
- 缩短 PE 输出长度（让模型输出更紧凑）

### Q3: 模型返回不是 JSON，导致解析失败怎么办？

- 检查 PE 模板是否明确要求「只输出 JSON，不带 markdown 代码块」
- 确认模型名支持结构化输出（部分小模型对 JSON 输出稳定性较差）
- 临时加 `--no-schema` 关闭 JSON 解析，只保留原始文本输出，再后处理
- 在 `.env` 中调高 `LLM_RETRIES`（默认 5）

### Q4: 如何接入非 OpenAI 的兼容服务？

只要服务遵循 OpenAI 协议（`/chat/completions` 接口），改 `BASE_URL` 即可：

```ini
API_KEY="your_key"
BASE_URL="https://your-compatible-service.com/v1"
MODEL_NAME="your-model-name"
```

### Q5: 输出 CSV 字段顺序与原始不一致？

输出 CSV 始终按输入文件**原始行号**排序（不受内部随机打乱影响）。列顺序为：原始字段 → JSON 解析字段（动态探测的并集）→ `raw_output` → `_error`。

### Q6: GT 和 Pred 列名相同时为什么不自动算准确率？

这是**刻意设计**：避免误用同一列得到虚高准确率（100%）。请确认 `--gt-field` 是人工标注列，`--pred-field` 是模型 JSON 输出的预测列，两者必须显式区分。

---

## 后续计划 Roadmap

- [ ] 流式输出（Streaming）支持，降低超时风险
- [ ] 异步 async/await 版本，替代线程池
- [ ] PE 模板版本管理（多 PE 对比跑数）
- [ ] 内置更多评估指标（Macro/Micro/Weighted 一键全输出）
- [ ] Docker 镜像，便于一键部署

---

## 许可证

[MIT License](./LICENSE) — 自由使用、修改与分发。
