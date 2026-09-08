/**
 * @file 类型定义
 * @description 应用核心数据类型与接口（混淆矩阵 / 指标 / 配置）
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */

/** 分类标签类型 */
export type Label = string | number;

/** 混淆矩阵单元格数据 */
export interface ConfusionMatrixCell {
  /** 真实标签 */
  actual: Label;
  /** 预测标签 */
  predicted: Label;
  /** 数量 */
  count: number;
  /** 百分比（相对于该行的总数） */
  percentage: number;
}

/** 行列统计信息 */
export interface MatrixTotals {
  /** 每行总计（按实际标签） */
  rowTotals: Map<Label, number>;
  /** 每列总计（按预测标签） */
  colTotals: Map<Label, number>;
}

/** 混淆矩阵数据 */
export interface ConfusionMatrixData {
  /** 矩阵单元格数组 */
  cells: ConfusionMatrixCell[];
  /** 所有唯一的标签列表 */
  labels: Label[];
  /** 总样本数 */
  total: number;
  /** 行列统计 */
  totals: MatrixTotals;
}

/** 分类指标 */
export interface ClassificationMetrics {
  /** 标签 */
  label: Label;
  /** 精确率 */
  precision: number;
  /** 召回率 */
  recall: number;
  /** F1分数 */
  f1Score: number;
  /** 支持度（样本数） */
  support: number;
}

/** 整体统计指标 */
export interface OverallMetrics {
  /** 准确率 */
  accuracy: number;
  /** 宏平均精确率 */
  macroPrecision: number;
  /** 宏平均召回率 */
  macroRecall: number;
  /** 宏平均F1 */
  macroF1: number;
  /** 加权平均精确率 */
  weightedPrecision: number;
  /** 加权平均召回率 */
  weightedRecall: number;
  /** 加权平均F1 */
  weightedF1: number;
  /** 各类别指标 */
  perClassMetrics: ClassificationMetrics[];
}

/** 原始数据行 */
export interface DataRow {
  [key: string]: string | number;
}

/** 列映射配置 */
export interface ColumnMapping {
  /** 真实标签列名 */
  actualColumn: string;
  /** 预测标签列名 */
  predictedColumn: string;
}

/** 数据解析结果 */
export interface ParsedData {
  /** 原始数据 */
  rawData: DataRow[];
  /** 列名列表 */
  columns: string[];
  /** 行数 */
  rowCount: number;
}

/** 热力图颜色配置 */
export interface HeatmapColorConfig {
  /** 最低值颜色 (HSL) */
  low: string;
  /** 中间值颜色 (HSL) */
  mid: string;
  /** 高值颜色 (HSL) */
  high: string;
  /** 最高值颜色 (HSL) */
  max: string;
}

/** 可视化配置 */
export interface VisualizationConfig {
  /** 是否显示百分比 */
  showPercentage: boolean;
  /** 是否显示数值 */
  showCount: boolean;
  /** 颜色方案 */
  colorScheme: 'blue' | 'green' | 'red' | 'purple';
  /** 单元格大小 */
  cellSize: number;
  /** 字体大小 */
  fontSize: number;
  /** 是否显示行列总计 */
  showTotals: boolean;
  /** 标签显示顺序（null则按字母排序） */
  labelOrder: Label[] | null;
}
