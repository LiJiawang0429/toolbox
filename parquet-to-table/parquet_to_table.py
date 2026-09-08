#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parquet_to_table.py — Parquet 文件解析为表格

文件用途：读取任意 parquet 文件，打印 schema + 表格预览，并可选导出为
          csv / xlsx / html / json / markdown 等格式。
作者：TODO <your-github-username>
创建日期：2026-09-08
许可证：MIT

依赖：pyarrow（parquet 解析）、pandas（表格化）、可选 openpyxl（xlsx 导出）。
"""
import argparse
import json
import sys
from pathlib import Path

import pyarrow.parquet as pq
import pandas as pd


def log(msg):
    """统一带 [parquet] 前缀的日志输出。"""
    print(f"[parquet] {msg}", flush=True)


def read_parquet(path: Path):
    """
    读取 parquet 文件。

    参数:
        path: parquet 文件路径（Path 对象）

    返回:
        (pyarrow.Table, pandas.DataFrame)：原始 Arrow 表与等价的 pandas 表
    """
    if not path.exists():
        sys.exit(f"文件不存在: {path}")
    if path.suffix.lower() != ".parquet":
        log(f"⚠ 文件后缀不是 .parquet，仍尝试解析: {path.name}")
    table = pq.read_table(str(path))
    df = table.to_pandas()
    return table, df


def show_schema(table):
    """
    打印 parquet schema 信息：列名、类型、行数。

    参数:
        table: pyarrow.Table
    """
    print("\n" + "=" * 70)
    print(f"Schema（共 {table.num_columns} 列, {table.num_rows} 行）")
    print("=" * 70)
    print(f"{'#':>3}  {'列名':<40} {'类型':<20}")
    print("-" * 70)
    for i, (name, dtype) in enumerate(zip(table.schema.names, table.schema.types), 1):
        print(f"{i:>3}  {name:<40} {str(dtype):<20}")
    print("=" * 70)


def show_preview(df, rows, cols=None):
    """
    控制台打印表格预览。

    参数:
        df: pandas.DataFrame
        rows: 预览行数
        cols: 可选，只看指定列（列表）
    """
    n_rows = len(df)
    n_cols = len(df.columns)
    print(f"\n预览（前 {min(rows, n_rows)} 行 / 共 {n_rows} 行, {n_cols} 列）")
    print("-" * 70)
    sub = df.head(rows)
    if cols:
        sub = sub[cols]
    with pd.option_context(
        "display.max_columns", None,
        "display.width", 200,
        "display.max_colwidth", 60,
        "display.unicode.east_asian_width", True,
    ):
        print(sub.to_string(index=True))
    print("-" * 70)


def export(df, fmt, out: Path):
    """
    按指定格式导出到文件。

    参数:
        df: pandas.DataFrame
        fmt: 导出格式（csv / xlsx / html / json / markdown）
        out: 输出文件路径（Path 对象）
    """
    if fmt == "csv":
        df.to_csv(out, index=False)
    elif fmt == "xlsx":
        try:
            df.to_excel(out, index=False, engine="openpyxl")
        except ImportError:
            sys.exit("xlsx 导出需要 openpyxl：pip install openpyxl")
    elif fmt == "html":
        df.to_html(out, index=False)
    elif fmt == "json":
        # JSON Lines：每行一条 JSON，便于流式处理
        with open(out, "w", encoding="utf-8") as f:
            for record in df.to_dict(orient="records"):
                f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    elif fmt == "markdown":
        with open(out, "w", encoding="utf-8") as f:
            f.write(df.to_markdown(index=False))
    else:
        sys.exit(f"未知导出格式: {fmt}")
    log(f"已导出 -> {out.resolve()}")


def main():
    p = argparse.ArgumentParser(
        description="解析 parquet 文件为表格：打印 schema + 预览，可选导出"
    )
    p.add_argument("file", help="parquet 文件路径")
    p.add_argument("--rows", type=int, default=20, help="预览行数，默认 20")
    p.add_argument("--cols", help="只看指定列（逗号分隔，如 sid,account,model）")
    p.add_argument("--export", choices=["csv", "xlsx", "html", "json", "markdown"],
                   help="导出格式（不指定则只打印预览）")
    p.add_argument("--out", help="导出文件路径；不填则用 parquet 同名 + 对应后缀")
    args = p.parse_args()

    src = Path(args.file).expanduser().resolve()
    table, df = read_parquet(src)

    show_schema(table)

    cols = [c.strip() for c in args.cols.split(",")] if args.cols else None
    show_preview(df, args.rows, cols)

    if args.export:
        out = Path(args.out) if args.out else src.with_suffix(f".{args.export}")
        export(df, args.export, out)


if __name__ == "__main__":
    main()
