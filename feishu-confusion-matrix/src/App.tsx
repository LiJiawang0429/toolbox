/**
 * @file App.tsx
 * @description 应用根组件：数据输入 → 列映射 → 混淆矩阵与指标展示
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { useState, useCallback, useMemo } from 'react';
import './global.css';
import type {
  ParsedData,
  ColumnMapping,
  ConfusionMatrixData,
  OverallMetrics,
  VisualizationConfig,
} from './types';
import { autoParse, guessColumns, validateData } from './utils/dataParser';
import { calculateConfusionMatrix, calculateMetrics } from './utils/matrixCalculator';
import { DataInputPanel } from './components/DataInputPanel';
import { ColumnMappingPanel } from './components/ColumnMappingPanel';
import { ConfusionMatrixHeatmap } from './components/ConfusionMatrixHeatmap';
import { MetricsPanel } from './components/MetricsPanel';
import { ConfigPanel } from './components/ConfigPanel';

// 运行时注入 Tailwind 配置（飞书品牌色系）
declare global {
  interface Window {
    tailwind?: any;
  }
}
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  ...window.tailwind.config,
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3370FF',
          light: '#E8F1FF',
          dark: '#245BDB',
        },
        feishu: {
          bg: '#F5F6F7',
          card: '#FFFFFF',
          text: '#1F2329',
          muted: '#646A73',
          border: '#DEE0E3',
        },
      },
    },
  },
};

function App() {
  // 状态管理
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    actualColumn: '',
    predictedColumn: '',
  });
  const [matrixData, setMatrixData] = useState<ConfusionMatrixData | null>(null);
  const [metrics, setMetrics] = useState<OverallMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<VisualizationConfig>({
    showPercentage: true,
    showCount: true,
    colorScheme: 'blue',
    cellSize: 60,
    fontSize: 14,
    showTotals: true,
    labelOrder: null,
  });

  /** 处理数据输入：自动解析 + 智能猜列 */
  const handleDataInput = useCallback((text: string) => {
    try {
      setError(null);
      const data = autoParse(text);
      setParsedData(data);

      // 自动猜测真实/预测列
      const guessed = guessColumns(data.columns, data.rawData);
      setColumnMapping({
        actualColumn: guessed.actual || '',
        predictedColumn: guessed.predicted || '',
      });

      // 清空之前的计算结果
      setMatrixData(null);
      setMetrics(null);
    } catch (err) {
      setError('数据解析失败: ' + (err as Error).message);
      setParsedData(null);
    }
  }, []);

  /** 生成混淆矩阵：校验数据 → 计算矩阵与指标 */
  const handleGenerateMatrix = useCallback(() => {
    if (!parsedData || !columnMapping.actualColumn || !columnMapping.predictedColumn) {
      return;
    }

    const validation = validateData(
      parsedData,
      columnMapping.actualColumn,
      columnMapping.predictedColumn
    );

    if (!validation.valid) {
      setError(validation.message || '数据验证失败');
      return;
    }

    try {
      setError(null);
      const matrix = calculateConfusionMatrix(parsedData.rawData, columnMapping);
      const calculatedMetrics = calculateMetrics(matrix);
      setMatrixData(matrix);
      setMetrics(calculatedMetrics);
      // 重置自定义标签顺序
      setConfig((prev) => ({ ...prev, labelOrder: null }));
    } catch (err) {
      setError('计算失败: ' + (err as Error).message);
    }
  }, [parsedData, columnMapping]);

  const hasValidData = useMemo(() => {
    return parsedData && parsedData.rawData.length > 0;
  }, [parsedData]);

  const canGenerate = useMemo(() => {
    return hasValidData && columnMapping.actualColumn && columnMapping.predictedColumn;
  }, [hasValidData, columnMapping]);

  return (
    <div className="min-h-screen bg-[#F5F6F7]">
      {/* Header */}
      <header className="bg-white border-b border-[#DEE0E3] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3370FF] to-[#245BDB] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#1F2329]">混淆矩阵可视化</h1>
                <p className="text-sm text-[#646A73]">飞书表格数据智能分析工具</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Data Input */}
          <div className="space-y-6">
            <DataInputPanel
              onDataInput={handleDataInput}
              hasData={hasValidData}
              rowCount={parsedData?.rowCount || 0}
            />

            {parsedData && (
              <ColumnMappingPanel
                columns={parsedData.columns}
                mapping={columnMapping}
                onMappingChange={setColumnMapping}
                onGenerate={handleGenerateMatrix}
                canGenerate={canGenerate}
              />
            )}

            {matrixData && (
              <ConfigPanel config={config} onConfigChange={setConfig} />
            )}
          </div>

          {/* Right Panel - Visualization */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {matrixData ? (
              <div className="space-y-6">
                <ConfusionMatrixHeatmap
                  data={matrixData}
                  config={config}
                  onLabelOrderChange={(newOrder) => setConfig((prev) => ({ ...prev, labelOrder: newOrder }))}
                />
                <MetricsPanel metrics={metrics} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#DEE0E3] p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-[#F5F6F7] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-[#646A73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[#1F2329] mb-2">开始分析数据</h3>
                <p className="text-sm text-[#646A73] max-w-md mx-auto">
                  在左侧粘贴或导入飞书表格数据，系统将自动生成混淆矩阵和分类指标分析
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#646A73]">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#E8F1FF] text-[#3370FF] flex items-center justify-center text-xs font-medium">1</span>
                    <span>粘贴数据</span>
                  </div>
                  <div className="w-8 h-px bg-[#DEE0E3]"></div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#E8F1FF] text-[#3370FF] flex items-center justify-center text-xs font-medium">2</span>
                    <span>选择列</span>
                  </div>
                  <div className="w-8 h-px bg-[#DEE0E3]"></div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#E8F1FF] text-[#3370FF] flex items-center justify-center text-xs font-medium">3</span>
                    <span>生成矩阵</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
