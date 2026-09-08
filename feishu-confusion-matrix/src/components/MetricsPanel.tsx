/**
 * @file MetricsPanel
 * @description 指标面板：整体指标卡片 + 各类别指标表格（Precision/Recall/F1/Support）
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { useState } from 'react';
import type { OverallMetrics } from '../types';
import { formatPercentage, formatNumber } from '../utils/matrixCalculator';

interface MetricsPanelProps {
  metrics: OverallMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<'overall' | 'perClass'>('overall');

  if (!metrics) return null;

  const {
    accuracy,
    macroPrecision,
    macroRecall,
    macroF1,
    weightedPrecision,
    weightedRecall,
    weightedF1,
    perClassMetrics,
  } = metrics;

  /** 整体指标卡片配置 */
  const overallCards = [
    { label: '准确率', value: accuracy, description: '所有样本中预测正确的比例', color: 'blue' },
    { label: '宏平均精确率', value: macroPrecision, description: '各类别精确率的算术平均', color: 'purple' },
    { label: '宏平均召回率', value: macroRecall, description: '各类别召回率的算术平均', color: 'green' },
    { label: '宏平均 F1', value: macroF1, description: '宏平均精确率和召回率的调和平均', color: 'orange' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#DEE0E3] overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#DEE0E3] bg-gradient-to-r from-[#F5F6F7] to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#3370FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="font-semibold text-[#1F2329]">分类指标</h2>
          </div>

          {/* 标签切换 */}
          <div className="flex items-center bg-[#F5F6F7] rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overall')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${activeTab === 'overall'
                  ? 'bg-white text-[#3370FF] shadow-sm'
                  : 'text-[#646A73] hover:text-[#1F2329]'
                }
              `}
            >
              整体指标
            </button>
            <button
              onClick={() => setActiveTab('perClass')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${activeTab === 'perClass'
                  ? 'bg-white text-[#3370FF] shadow-sm'
                  : 'text-[#646A73] hover:text-[#1F2329]'
                }
              `}
            >
              各类别
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'overall' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {overallCards.map((card) => (
              <div
                key={card.label}
                className="group relative p-4 rounded-xl border border-[#DEE0E3] hover:border-[#3370FF]/30 hover:shadow-md transition-all"
              >
                <p className="text-xs text-[#646A73] mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-[#1F2329]">
                  {formatPercentage(card.value, 2)}
                </p>
                {/* 进度条 */}
                <div className="mt-2 h-1.5 bg-[#F5F6F7] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      card.color === 'blue' ? 'bg-[#3370FF]' :
                      card.color === 'green' ? 'bg-green-500' :
                      card.color === 'purple' ? 'bg-purple-500' :
                      'bg-orange-500'
                    }`}
                    style={{ width: `${card.value * 100}%` }}
                  />
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1F2329] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {card.description}
                </div>
              </div>
            ))}

            {/* 加权平均指标 */}
            <div className="col-span-2 md:col-span-4 mt-2 p-4 bg-[#F5F6F7] rounded-xl">
              <h4 className="text-sm font-medium text-[#1F2329] mb-3">加权平均指标</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#646A73]">加权精确率</p>
                  <p className="text-lg font-semibold text-[#1F2329]">
                    {formatPercentage(weightedPrecision, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#646A73]">加权召回率</p>
                  <p className="text-lg font-semibold text-[#1F2329]">
                    {formatPercentage(weightedRecall, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#646A73]">加权 F1</p>
                  <p className="text-lg font-semibold text-[#1F2329]">
                    {formatPercentage(weightedF1, 2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#DEE0E3]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#646A73]">类别</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#646A73]">精确率</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#646A73]">召回率</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#646A73]">F1 分数</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#646A73]">样本数</th>
                </tr>
              </thead>
              <tbody>
                {perClassMetrics.map((metric, index) => (
                  <tr
                    key={String(metric.label)}
                    className="border-b border-[#DEE0E3]/50 hover:bg-[#F5F6F7]/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-[#E8F1FF] text-[#3370FF] flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="font-medium text-[#1F2329]">{metric.label}</span>
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-medium ${metric.precision >= 0.9 ? 'text-green-600' : metric.precision >= 0.7 ? 'text-[#1F2329]' : 'text-orange-500'}`}>
                        {formatPercentage(metric.precision, 2)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-medium ${metric.recall >= 0.9 ? 'text-green-600' : metric.recall >= 0.7 ? 'text-[#1F2329]' : 'text-orange-500'}`}>
                        {formatPercentage(metric.recall, 2)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-semibold ${metric.f1Score >= 0.9 ? 'text-green-600' : metric.f1Score >= 0.7 ? 'text-[#1F2329]' : 'text-orange-500'}`}>
                        {formatPercentage(metric.f1Score, 2)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-[#646A73]">
                      {formatNumber(metric.support)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
