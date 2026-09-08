# parquet-to-table

> 一个轻量命令行工具，把任意 Parquet 文件解析为可读的表格：打印 schema + 前若干行预览，并支持一键导出为 csv / xlsx / html / json / markdown。

纯个人兴趣项目，不涉及任何公司代码或敏感信息。

---

## 项目列表

| 项目名 | 一句话说明 | 技术栈 | 状态 |
|-|-|-|-|
| [parquet_to_table](./parquet_to_table.py) | Parquet → 表格预览 + 多格式导出 CLI | Python / pyarrow / pandas | ✅ 可用 |

> 本仓库当前仅含一个子项目，根目录 README 即为其说明文档。

---

## 功能特性

- 📋 **Schema 概览**：列名、类型、总行数一目了然
- 👀 **表格预览**：控制台直接打印前 N 行，支持指定列
- 📤 **多格式导出**：`csv` / `xlsx` / `html` / `json` / `markdown`
- 🪶 **零配置**：单文件脚本，命令行即用，无服务端依赖
- 🧩 **依赖轻**：仅需 `pyarrow` + `pandas`（xlsx 再加 `openpyxl`）

## 依赖

| 依赖 | 用途 | 安装 |
|-|-|-|
| `pyarrow` | parquet 解析（核心） | `pip install pyarrow` |
| `pandas` | 表格化 / 导出 | `pip install pandas` |
| `openpyxl` | 仅导出 xlsx 时需要 | `pip install openpyxl` |

一键安装：

```bash
pip install pyarrow pandas openpyxl tabulate
```

> 注：导出 `markdown` 需要 `tabulate`。

## 快速开始

```bash
# 仅打印 schema + 前 20 行预览
python3 parquet_to_table.py sample.parquet

# 看前 5 行 + 只看指定列
python3 parquet_to_table.py sample.parquet --rows 5 --cols sid,account,model

# 导出为 csv（同目录同名，可换 xlsx/html/json/markdown）
python3 parquet_to_table.py sample.parquet --export csv

# 导出 xlsx 并指定输出路径
python3 parquet_to_table.py sample.parquet --export xlsx --out ./sample.xlsx
```

## 参数说明

| 参数 | 必填 | 说明 |
|-|-|-|
| `file` | 是 | parquet 文件路径 |
| `--rows` | 否 | 预览行数，默认 20 |
| `--cols` | 否 | 只看指定列，逗号分隔（如 `sid,account,model`） |
| `--export` | 否 | 导出格式：`csv` / `xlsx` / `html` / `json` / `markdown` |
| `--out` | 否 | 导出文件路径；不填则用 parquet 同名 + 对应后缀 |

## 输出示例

```text
======================================================================
Schema（共 6 列, 100 行）
======================================================================
  #  列名                                       类型
----------------------------------------------------------------------
  1  event_time                               string
  2  sid                                      string
  3  account                                  string
  4  model                                    string
  5  endpoint                                 string
  6  api_type                                 string
======================================================================

预览（前 5 行 / 共 100 行, 6 列）
----------------------------------------------------------------------
event_time,sid,account,model,endpoint,api_type
2026-09-01 00:00:03,sess_a1b2c3,user_001,llm-model-lite,ep-01,Response
2026-09-01 00:00:07,sess_d4e5f6,user_001,llm-model-lite,ep-01,Response
2026-09-01 00:00:09,sess_g7h8i9,user_001,llm-model-lite,ep-01,Response
2026-09-01 00:00:16,sess_j0k1l2,user_002,llm-model-lite,ep-02,Chat
2026-09-01 00:00:19,sess_m3n4o5,user_001,llm-model-lite,ep-01,Response
----------------------------------------------------------------------
```

## 导出格式说明

| 格式 | 说明 |
|-|-|
| `csv` | 带表头，UTF-8 |
| `xlsx` | Excel 表，需 `openpyxl` |
| `html` | 标准 HTML 表格 |
| `json` | JSON Lines，每行一条 JSON |
| `markdown` | Markdown 表格，需 `tabulate` |

## 目录结构

```text
parquet-to-table/
├── README.md            # 本文档
├── parquet_to_table.py  # 主脚本
└── .gitignore
```

## 许可证

MIT License — 自由使用、修改与分发。
