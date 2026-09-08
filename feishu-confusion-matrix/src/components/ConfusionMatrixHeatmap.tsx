/**
 * @file ConfusionMatrixHeatmap
 * @description 混淆矩阵热力图组件：支持拖拽调整类别顺序、显示行/列总计
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { useMemo, useState } from 'react';
import type { ConfusionMatrixData, VisualizationConfig, Label } from '../types';
import { getHeatmapColor, getDiagonalColor, formatNumber } from '../utils/matrixCalculator';

interface ConfusionMatrixHeatmapProps {
  data: ConfusionMatrixData;
  config: VisualizationConfig;
  onLabelOrderChange?: (newOrder: Label[]) => void;
}

export function ConfusionMatrixHeatmap({ data, config, onLabelOrderChange }: ConfusionMatrixHeatmapProps) {
  const { cells, labels: originalLabels, total, totals } = data;
  const { showPercentage, showCount, colorScheme, cellSize, showTotals, labelOrder } = config;
  const [hoveredCell, setHoveredCell] = useState<{ actual: Label; predicted: Label } | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<Label | null>(null);

  /** 使用自定义顺序或原始顺序 */
  const labels = useMemo(() => {
    if (labelOrder && labelOrder.length > 0) {
      const orderSet = new Set(labelOrder);
      const missing = originalLabels.filter((l) => !orderSet.has(l));
      return [...labelOrder, ...missing];
    }
    return originalLabels;
  }, [originalLabels, labelOrder]);

  /** 构建单元格查找表，O(1) 取数 */
  const cellMap = useMemo(() => {
    const map = new Map<string, ConfusionMatrixData['cells'][0]>();
    cells.forEach((cell) => {
      map.set(`${cell.actual}||${cell.predicted}`, cell);
    });
    return map;
  }, [cells]);

  /** 计算最大值用于归一化 */
  const maxCount = useMemo(() => {
    return Math.max(...cells.map((c) => c.count));
  }, [cells]);

  /** 获取单元格颜色：对角线为绿色（正确），其他为按方案渲染的热力色 */
  const getCellColor = (actual: Label, predicted: Label, count: number, maxCount: number) => {
    const isDiagonal = actual === predicted;
    const intensity = maxCount > 0 ? count / maxCount : 0;

    if (isDiagonal) {
      return getDiagonalColor(intensity);
    }
    return getHeatmapColor(intensity, colorScheme);
  };

  const matrixSize = labels.length;
  const headerSize = 70;
  const totalColWidth = showTotals ? 70 : 0;
  const totalRowHeight = showTotals ? 35 : 0;

  /** 拖拽排序：将 draggedLabel 移动到 targetLabel 位置 */
  const handleDragStart = (label: Label) => {
    setDraggedLabel(label);
  };

  const handleDragOver = (e: React.DragEvent, targetLabel: Label) => {
    e.preventDefault();
    if (!draggedLabel || draggedLabel === targetLabel) return;

    const newOrder = [...labels];
    const fromIndex = newOrder.indexOf(draggedLabel);
    const toIndex = newOrder.indexOf(targetLabel);

    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedLabel);

    onLabelOrderChange?.(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedLabel(null);
  };

  /** 重置标签顺序到默认（按字母排序） */
  const handleResetOrder = () => {
    onLabelOrderChange?.([]);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DEE0E3] overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#DEE0E3] bg-gradient-to-r from-[#F5F6F7] to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#3370FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <h2 className="font-semibold text-[#1F2329]">混淆矩阵</h2>
          </div>
          <div className="flex items-center gap-3">
            {onLabelOrderChange && (
              <button
                onClick={handleResetOrder}
                className="text-xs text-[#3370FF] hover:text-[#245BDB] transition-colors"
                title="重置为默认顺序"
              >
                重置顺序
              </button>
            )}
            <span className="text-xs text-[#646A73] bg-[#F5F6F7] px-3 py-1 rounded-full">
              {matrixSize} × {matrixSize} · {formatNumber(total)} 样本
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 overflow-x-auto">
        <div className="inline-block">
          {/* 预测标签标题 */}
          <div className="text-center mb-3">
            <span className="text-sm font-medium text-[#3370FF]">预测标签 (Predicted)</span>
          </div>

          <div className="flex">
            {/* 真实标签标题 */}
            <div className="flex items-center mr-3">
              <span
                className="text-sm font-medium text-green-600 whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                真实标签 (Actual)
              </span>
            </div>

            <div>
              {/* 列标题 */}
              <div className="flex" style={{ marginLeft: headerSize }}>
                {labels.map((label) => (
                  <div
                    key={`col-${label}`}
                    draggable={!!onLabelOrderChange}
                    onDragStart={() => handleDragStart(label)}
                    onDragOver={(e) => handleDragOver(e, label)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center justify-center text-xs font-medium text-[#646A73]
                      ${onLabelOrderChange ? 'cursor-move hover:bg-[#E8F1FF] rounded' : ''}
                    `}
                    style={{ width: cellSize, height: 30 }}
                    title={onLabelOrderChange ? '拖拽调整顺序' : String(label)}
                  >
                    <span className="truncate px-1" title={String(label)}>
                      {String(label).length > 8 ? String(label).slice(0, 6) + '...' : label}
                    </span>
                  </div>
                ))}
                {/* 列总计标题 */}
                {showTotals && (
                  <div
                    className="flex items-center justify-center text-xs font-semibold text-[#3370FF] bg-[#E8F1FF] rounded ml-1"
                    style={{ width: totalColWidth - 10, height: 30 }}
                  >
                    合计
                  </div>
                )}
              </div>

              {/* 矩阵主体 */}
              <div className="flex">
                {/* 行标题 */}
                <div style={{ width: headerSize }}>
                  {labels.map((label) => (
                    <div
                      key={`row-${label}`}
                      draggable={!!onLabelOrderChange}
                      onDragStart={() => handleDragStart(label)}
                      onDragOver={(e) => handleDragOver(e, label)}
                      onDragEnd={handleDragEnd}
                      className={`
                        flex items-center justify-end pr-3 text-xs font-medium text-[#646A73]
                        ${onLabelOrderChange ? 'cursor-move hover:bg-[#E8F1FF] rounded' : ''}
                      `}
                      style={{ height: cellSize }}
                      title={onLabelOrderChange ? '拖拽调整顺序' : String(label)}
                    >
                      <span className="truncate" title={String(label)}>
                        {String(label).length > 10 ? String(label).slice(0, 8) + '...' : label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 单元格 + 行总计 */}
                <div>
                  {/* 单元格网格 */}
                  <div
                    className="grid gap-px bg-[#DEE0E3]"
                    style={{
                      gridTemplateColumns: `repeat(${matrixSize}, ${cellSize}px)`,
                      gridTemplateRows: `repeat(${matrixSize}, ${cellSize}px)`,
                    }}
                  >
                    {labels.map((actual) =>
                      labels.map((predicted) => {
                        const cell = cellMap.get(`${actual}||${predicted}`);
                        const count = cell?.count || 0;
                        const percentage = cell?.percentage || 0;
                        const isDiagonal = actual === predicted;
                        const isHovered = hoveredCell?.actual === actual && hoveredCell?.predicted === predicted;

                        return (
                          <div
                            key={`${actual}-${predicted}`}
                            className={`
                              relative flex flex-col items-center justify-center cursor-pointer
                              transition-all duration-200
                              ${isHovered ? 'ring-2 ring-[#3370FF] ring-offset-1 z-10' : ''}
                            `}
                            style={{
                              backgroundColor: getCellColor(actual, predicted, count, maxCount),
                              width: cellSize,
                              height: cellSize,
                            }}
                            onMouseEnter={() => setHoveredCell({ actual, predicted })}
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`真实: ${actual} / 预测: ${predicted}`}
                          >
                            {/* 数值显示 */}
                            {showCount && count > 0 && (
                              <span
                                className={`font-semibold ${isDiagonal ? 'text-green-800' : 'text-[#1F2329]'}`}
                                style={{ fontSize: Math.max(10, cellSize / 4) }}
                              >
                                {count}
                              </span>
                            )}

                            {/* 百分比显示 */}
                            {showPercentage && count > 0 && (
                              <span
                                className={`${isDiagonal ? 'text-green-700' : 'text-[#646A73]'}`}
                                style={{ fontSize: Math.max(9, cellSize / 5) }}
                              >
                                {percentage.toFixed(1)}%
                              </span>
                            )}

                            {/* 对角线指示器 */}
                            {isDiagonal && count > 0 && (
                              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 列总计行 */}
                  {showTotals && (
                    <div
                      className="grid gap-px bg-[#DEE0E3] mt-1"
                      style={{
                        gridTemplateColumns: `repeat(${matrixSize}, ${cellSize}px)`,
                        gridTemplateRows: `${totalRowHeight}px`,
                      }}
                    >
                      {labels.map((label) => {
                        const colTotal = totals.colTotals.get(label) || 0;
                        return (
                          <div
                            key={`col-total-${label}`}
                            className="flex flex-col items-center justify-center bg-[#E8F1FF] text-[#3370FF] font-semibold"
                            style={{ width: cellSize, height: totalRowHeight }}
                          >
                            <span className="text-xs">{colTotal}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 行总计列 */}
                {showTotals && (
                  <div className="ml-1 flex flex-col">
                    {labels.map((label) => {
                      const rowTotal = totals.rowTotals.get(label) || 0;
                      return (
                        <div
                          key={`row-total-${label}`}
                          className="flex items-center justify-center bg-[#E8F1FF] text-[#3370FF] font-semibold rounded"
                          style={{ width: totalColWidth - 10, height: cellSize, marginBottom: 1 }}
                        >
                          <span className="text-xs">{rowTotal}</span>
                        </div>
                      );
                    })}
                    {/* 总样本数 */}
                    <div
                      className="flex items-center justify-center bg-[#3370FF] text-white font-bold rounded mt-1"
                      style={{ width: totalColWidth - 10, height: totalRowHeight }}
                    >
                      <span className="text-xs">{total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 拖拽提示 */}
          {onLabelOrderChange && (
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#646A73]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>拖拽行列标题可调整类别顺序</span>
            </div>
          )}

          {/* 图例 */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-[#DEE0E3]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: getDiagonalColor(0.5) }} />
              <span className="text-xs text-[#646A73]">正确预测</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: getHeatmapColor(0.5, colorScheme) }} />
              <span className="text-xs text-[#646A73]">错误预测</span>
            </div>
            {showTotals && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#E8F1FF] border border-[#3370FF]" />
                <span className="text-xs text-[#646A73]">行列总计</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
