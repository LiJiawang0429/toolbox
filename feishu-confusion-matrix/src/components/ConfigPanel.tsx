/**
 * @file ConfigPanel
 * @description 显示设置面板：颜色方案、显示项、单元格大小
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import type { VisualizationConfig } from '../types';

interface ConfigPanelProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
}

export function ConfigPanel({ config, onConfigChange }: ConfigPanelProps) {
  /** 通用字段更新 */
  const handleChange = <K extends keyof VisualizationConfig>(
    key: K,
    value: VisualizationConfig[K]
  ) => {
    onConfigChange({ ...config, [key]: value });
  };

  const colorSchemes: { value: VisualizationConfig['colorScheme']; label: string; color: string }[] = [
    { value: 'blue', label: '蓝色', color: '#3370FF' },
    { value: 'green', label: '绿色', color: '#22C55E' },
    { value: 'red', label: '红色', color: '#EF4444' },
    { value: 'purple', label: '紫色', color: '#A855F7' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#DEE0E3] overflow-hidden shadow-sm animate-fade-in">
      <div className="px-5 py-4 border-b border-[#DEE0E3] bg-gradient-to-r from-[#F5F6F7] to-white">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#3370FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <h2 className="font-semibold text-[#1F2329]">显示设置</h2>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 颜色方案 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#1F2329]">颜色方案</label>
          <div className="grid grid-cols-4 gap-2">
            {colorSchemes.map((scheme) => (
              <button
                key={scheme.value}
                onClick={() => handleChange('colorScheme', scheme.value)}
                className={`
                  flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all
                  ${config.colorScheme === scheme.value
                    ? 'border-[#3370FF] bg-[#E8F1FF]'
                    : 'border-[#DEE0E3] hover:border-[#3370FF]/50'
                  }
                `}
              >
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: scheme.color }}
                />
                <span className="text-xs text-[#646A73]">{scheme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 显示选项 */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[#1F2329]">显示内容</label>

          <label className="flex items-center justify-between p-3 bg-[#F5F6F7] rounded-lg cursor-pointer hover:bg-[#EBEBEB] transition-colors">
            <span className="text-sm text-[#1F2329]">显示数值</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.showCount}
                onChange={(e) => handleChange('showCount', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#DEE0E3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3370FF]" />
            </div>
          </label>

          <label className="flex items-center justify-between p-3 bg-[#F5F6F7] rounded-lg cursor-pointer hover:bg-[#EBEBEB] transition-colors">
            <span className="text-sm text-[#1F2329]">显示百分比</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.showPercentage}
                onChange={(e) => handleChange('showPercentage', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#DEE0E3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3370FF]" />
            </div>
          </label>

          <label className="flex items-center justify-between p-3 bg-[#F5F6F7] rounded-lg cursor-pointer hover:bg-[#EBEBEB] transition-colors">
            <span className="text-sm text-[#1F2329]">显示行列总计</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.showTotals}
                onChange={(e) => handleChange('showTotals', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#DEE0E3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3370FF]" />
            </div>
          </label>
        </div>

        {/* 单元格大小 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#1F2329]">单元格大小</label>
            <span className="text-xs text-[#646A73] bg-[#F5F6F7] px-2 py-0.5 rounded">
              {config.cellSize}px
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="100"
            value={config.cellSize}
            onChange={(e) => handleChange('cellSize', Number(e.target.value))}
            className="w-full h-2 bg-[#F5F6F7] rounded-lg appearance-none cursor-pointer accent-[#3370FF]"
          />
          <div className="flex justify-between text-xs text-[#646A73]">
            <span>小</span>
            <span>大</span>
          </div>
        </div>
      </div>
    </div>
  );
}
