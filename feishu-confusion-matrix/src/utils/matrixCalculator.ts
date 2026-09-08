/**
 * @file matrixCalculator
 * @description 混淆矩阵与分类指标（Precision / Recall / F1 / Accuracy 等）核心计算逻辑
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import type {
  Label,
  ConfusionMatrixCell,
  ConfusionMatrixData,
  ClassificationMetrics,
  OverallMetrics,
  DataRow,
  ColumnMapping,
} from '../types';

/**
 * 计算混淆矩阵
 * @param data 原始数据数组
 * @param mapping 列映射配置
 * @returns 混淆矩阵数据
 */
export function calculateConfusionMatrix(
  data: DataRow[],
  mapping: ColumnMapping
): ConfusionMatrixData {
  const { actualColumn, predictedColumn } = mapping;

  // 收集所有唯一标签
  const labelSet = new Set<Label>();
  data.forEach((row) => {
    labelSet.add(String(row[actualColumn]));
    labelSet.add(String(row[predictedColumn]));
  });

  const labels = Array.from(labelSet).sort();

  // 初始化计数矩阵
  const counts: Map<string, number> = new Map();

  data.forEach((row) => {
    const actual = String(row[actualColumn]);
    const predicted = String(row[predictedColumn]);
    const key = `${actual}||${predicted}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  // 计算每行/每列总数
  const rowTotals: Map<Label, number> = new Map();
  const colTotals: Map<Label, number> = new Map();

  labels.forEach((label) => {
    let rowTotal = 0;
    let colTotal = 0;
    labels.forEach((otherLabel) => {
      rowTotal += counts.get(`${label}||${otherLabel}`) || 0;
      colTotal += counts.get(`${otherLabel}||${label}`) || 0;
    });
    rowTotals.set(label, rowTotal);
    colTotals.set(label, colTotal);
  });

  // 构建单元格数据
  const cells: ConfusionMatrixCell[] = [];
  labels.forEach((actual) => {
    const rowTotal = rowTotals.get(actual) || 1;
    labels.forEach((predicted) => {
      const count = counts.get(`${actual}||${predicted}`) || 0;
      cells.push({
        actual,
        predicted,
        count,
        percentage: rowTotal > 0 ? (count / rowTotal) * 100 : 0,
      });
    });
  });

  return {
    cells,
    labels,
    total: data.length,
    totals: {
      rowTotals,
      colTotals,
    },
  };
}

/**
 * 计算分类指标
 * @param matrix 混淆矩阵数据
 * @returns 整体指标和各类别指标
 */
export function calculateMetrics(matrix: ConfusionMatrixData): OverallMetrics {
  const { cells, labels, total } = matrix;

  // 构建快速查找表
  const cellMap = new Map<string, ConfusionMatrixCell>();
  cells.forEach((cell) => {
    cellMap.set(`${cell.actual}||${cell.predicted}`, cell);
  });

  const perClassMetrics: ClassificationMetrics[] = [];

  labels.forEach((label) => {
    // TP: 真正例（实际=label，预测=label）
    const tp = cellMap.get(`${label}||${label}`)?.count || 0;

    // FP: 假正例（实际≠label，预测=label）
    let fp = 0;
    labels.forEach((actual) => {
      if (actual !== label) {
        fp += cellMap.get(`${actual}||${label}`)?.count || 0;
      }
    });

    // FN: 假负例（实际=label，预测≠label）
    let fn = 0;
    labels.forEach((predicted) => {
      if (predicted !== label) {
        fn += cellMap.get(`${label}||${predicted}`)?.count || 0;
      }
    });

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = tp + fn;

    perClassMetrics.push({
      label,
      precision,
      recall,
      f1Score,
      support,
    });
  });

  // 整体准确率
  let correct = 0;
  labels.forEach((label) => {
    correct += cellMap.get(`${label}||${label}`)?.count || 0;
  });
  const accuracy = total > 0 ? correct / total : 0;

  // 宏平均
  const macroPrecision = perClassMetrics.reduce((sum, m) => sum + m.precision, 0) / labels.length;
  const macroRecall = perClassMetrics.reduce((sum, m) => sum + m.recall, 0) / labels.length;
  const macroF1 = perClassMetrics.reduce((sum, m) => sum + m.f1Score, 0) / labels.length;

  // 加权平均
  const weightedPrecision = perClassMetrics.reduce((sum, m) => sum + m.precision * m.support, 0) / total;
  const weightedRecall = perClassMetrics.reduce((sum, m) => sum + m.recall * m.support, 0) / total;
  const weightedF1 = perClassMetrics.reduce((sum, m) => sum + m.f1Score * m.support, 0) / total;

  return {
    accuracy,
    macroPrecision,
    macroRecall,
    macroF1,
    weightedPrecision,
    weightedRecall,
    weightedF1,
    perClassMetrics,
  };
}

/**
 * 获取单元格颜色（根据数值大小）
 * @param value 数值（0-1之间）
 * @param scheme 颜色方案
 * @returns HSL颜色字符串
 */
export function getHeatmapColor(
  value: number,
  scheme: 'blue' | 'green' | 'red' | 'purple' = 'blue'
): string {
  const normalizedValue = Math.max(0, Math.min(1, value));

  const schemes = {
    blue: { h: 220, s: 90, lMin: 95, lMax: 45 },
    green: { h: 150, s: 60, lMin: 95, lMax: 35 },
    red: { h: 0, s: 75, lMin: 95, lMax: 45 },
    purple: { h: 270, s: 70, lMin: 95, lMax: 40 },
  };

  const { h, s, lMin, lMax } = schemes[scheme];
  const l = lMin - (lMin - lMax) * normalizedValue;

  return `hsl(${h} ${s}% ${l}%)`;
}

/**
 * 获取对角线单元格的特殊颜色（正确预测）
 * @param value 数值（0-1之间）
 * @returns HSL颜色字符串
 */
export function getDiagonalColor(value: number): string {
  const normalizedValue = Math.max(0, Math.min(1, value));
  const l = 85 - 40 * normalizedValue;
  return `hsl(150 70% ${l}%)`;
}

/**
 * 格式化百分比
 * @param value 数值（0-1之间）
 * @param decimals 小数位数
 * @returns 格式化后的字符串
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化数字（带千位分隔符）
 * @param value 数值
 * @returns 格式化后的字符串
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}
