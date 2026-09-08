/**
 * @file ColumnMappingPanel
 * @description 列映射面板：选择真实标签列与预测标签列，并触发矩阵生成
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { useMemo } from 'react';
import type { ColumnMapping } from '../types';

interface ColumnMappingPanelProps {
  columns: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onGenerate: () => void;
  canGenerate: boolean;
}

export function ColumnMappingPanel({
  columns,
  mapping,
  onMappingChange,
  onGenerate,
  canGenerate,
}: ColumnMappingPanelProps) {
  /** 可选的列 */
  const availableColumns = useMemo(() => {
    return columns.map((col) => ({ value: col, label: col }));
  }, [columns]);

  return (
    <div className="bg-white rounded-2xl border border-[#DEE0E3] overflow-hidden shadow-sm animate-fade-in">
      <div className="px-5 py-4 border-b border-[#DEE0E3] bg-gradient-to-r from-[#F5F6F7] to-white">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#3370FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="font-semibold text-[#1F2329]">列映射配置</h2>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 真实标签列 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[#1F2329]">
            <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            真实标签列 (Actual)
          </label>
          <select
            value={mapping.actualColumn}
            onChange={(e) => onMappingChange({ ...mapping, actualColumn: e.target.value })}
            className="w-full px-3 py-2.5 bg-white border border-[#DEE0E3] rounded-lg text-sm text-[#1F2329] focus:outline-none focus:ring-2 focus:ring-[#3370FF]/20 focus:border-[#3370FF] transition-all"
          >
            <option value="">请选择列...</option>
            {availableColumns.map((col) => (
              <option key={col.value} value={col.value}>{col.label}</option>
            ))}
          </select>
          <p className="text-xs text-[#646A73]">数据的真实类别标签</p>
        </div>

        {/* 预测标签列 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[#1F2329]">
            <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            预测标签列 (Predicted)
          </label>
          <select
            value={mapping.predictedColumn}
            onChange={(e) => onMappingChange({ ...mapping, predictedColumn: e.target.value })}
            className="w-full px-3 py-2.5 bg-white border border-[#DEE0E3] rounded-lg text-sm text-[#1F2329] focus:outline-none focus:ring-2 focus:ring-[#3370FF]/20 focus:border-[#3370FF] transition-all"
          >
            <option value="">请选择列...</option>
            {availableColumns.map((col) => (
              <option key={col.value} value={col.value}>{col.label}</option>
            ))}
          </select>
          <p className="text-xs text-[#646A73]">模型预测的类别标签</p>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
            ${canGenerate
              ? 'bg-gradient-to-r from-[#3370FF] to-[#245BDB] text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5'
              : 'bg-[#F5F6F7] text-[#646A73] cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          生成混淆矩阵
        </button>

        {/* 说明 */}
        <div className="p-3 bg-[#F5F6F7] rounded-lg">
          <p className="text-xs text-[#646A73] leading-relaxed">
            系统将基于所选列自动生成混淆矩阵，并计算准确率、精确率、召回率等分类指标。
          </p>
        </div>
      </div>
    </div>
  );
}
