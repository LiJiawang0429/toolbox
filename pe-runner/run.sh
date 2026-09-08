#!/bin/bash
# ============================================================
# PE 跑数一键启动脚本
# ============================================================
# 用法:
#   简化模式: ./run.sh <数据文件.csv> [其他run_pe.py参数...]
#   完整模式: ./run.sh --source-file xxx --pe-file xxx ...
#
# 示例:
#   ./run.sh examples/sample_input.csv
#   ./run.sh data.csv --workers 100 --gt-field "label"
#   ./run.sh --source-file data.csv --pe-file src/prompts/custom_pe.md --workers 200
# ------------------------------------------------------------

# 自动定位脚本所在目录（不依赖当前工作目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_PY="$SCRIPT_DIR/src/run_pe.py"
DEFAULT_PE="$SCRIPT_DIR/src/prompts/example_pe.md"
DEFAULT_INPUT_FIELD="request"
DEFAULT_WORKERS=50
# 默认 GT/Pred 字段（留空则不自动算指标，需用户命令行追加）
DEFAULT_GT_FIELD=""
DEFAULT_PRED_FIELD=""

# 无参数时打印用法
if [ $# -eq 0 ]; then
    echo "PE 跑数脚本一键启动器"
    echo ""
    echo "用法:"
    echo "  简化模式: $0 <数据文件.csv> [其他run_pe.py参数...]"
    echo "  完整模式: $0 --source-file xxx --pe-file xxx ..."
    echo ""
    echo "示例:"
    echo "  $0 examples/sample_input.csv"
    echo "  $0 data.csv --workers 100"
    echo "  $0 data.csv --gt-field \"label\" --pred-field \"sentiment\""
    echo "  $0 --source-file data.csv --pe-file src/prompts/custom_pe.md --workers 200"
    echo ""
    echo "默认值:"
    echo "  PE 文件:      src/prompts/example_pe.md"
    echo "  输入字段:      $DEFAULT_INPUT_FIELD"
    echo "  并发线程数:    $DEFAULT_WORKERS"
    echo "  评估指标:      需显式传 --gt-field 和 --pred-field 才计算"
    exit 1
fi

# 构建简化模式默认参数
SIMPLIFIED_ARGS=(
    --source-file "$1"
    --pe-file "$DEFAULT_PE"
    --input-field "$DEFAULT_INPUT_FIELD"
    --workers "$DEFAULT_WORKERS"
)
# 简化模式下也支持预填 GT/Pred 字段（默认为空，需用户在命令行追加）
if [ -n "$DEFAULT_GT_FIELD" ] && [ -n "$DEFAULT_PRED_FIELD" ]; then
    SIMPLIFIED_ARGS+=(--gt-field "$DEFAULT_GT_FIELD" --pred-field "$DEFAULT_PRED_FIELD")
fi

# 判断模式
if [[ "$1" == --* ]]; then
    # 完整参数模式：原样透传给 run_pe.py
    exec python3 "$RUN_PY" "$@"
else
    # 简化模式：第一个参数作为 source-file，其余参数追加
    exec python3 "$RUN_PY" \
        "${SIMPLIFIED_ARGS[@]}" \
        "${@:2}"
fi
