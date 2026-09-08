/**
 * @file DataInputPanel
 * @description 数据输入面板：支持粘贴文本、拖拽文件、上传 CSV/TSV/JSON/TXT
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { useState, useCallback } from 'react';

interface DataInputPanelProps {
  onDataInput: (text: string) => void;
  hasData: boolean;
  rowCount: number;
}

export function DataInputPanel({ onDataInput, hasData, rowCount }: DataInputPanelProps) {
  const [inputText, setInputText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  /** 处理文本输入：实时回传给父组件解析 */
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (text.trim()) {
      onDataInput(text);
    }
  }, [onDataInput]);

  /** 处理文件上传：读取为文本并回传 */
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInputText(text);
      onDataInput(text);
    };
    reader.readAsText(file);
  }, [onDataInput]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  /** 清空输入与已解析数据 */
  const handleClear = useCallback(() => {
    setInputText('');
    onDataInput('');
  }, [onDataInput]);

  /** 加载内置示例数据（猫/狗/鸟三分类） */
  const loadExample = useCallback(() => {
    const exampleData = `actual,predicted
猫,猫
猫,猫
猫,狗
狗,狗
狗,猫
狗,狗
鸟,鸟
鸟,猫
鸟,鸟`;
    setInputText(exampleData);
    onDataInput(exampleData);
  }, [onDataInput]);

  return (
    <div className="bg-white rounded-2xl border border-[#DEE0E3] overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#DEE0E3] bg-gradient-to-r from-[#F5F6F7] to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#3370FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="font-semibold text-[#1F2329]">数据输入</h2>
          </div>
          {hasData && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {rowCount} 行数据
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 输入区域 */}
        <div
          className={`
            relative rounded-xl border-2 border-dashed transition-all duration-200
            ${isDragging
              ? 'border-[#3370FF] bg-[#E8F1FF]'
              : 'border-[#DEE0E3] hover:border-[#3370FF]/50'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            value={inputText}
            onChange={handleTextChange}
            placeholder={`粘贴飞书表格数据...
支持格式：CSV、TSV、JSON、表格文本

示例：
actual,predicted
猫,猫
猫,狗
狗,狗`}
            className="w-full h-48 p-4 bg-transparent resize-none focus:outline-none text-sm text-[#1F2329] placeholder:text-[#646A73]/60"
          />

          {!inputText && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-[#F5F6F7] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#646A73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm text-[#646A73]">拖拽文件到此处或粘贴数据</p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <input
              type="file"
              accept=".csv,.tsv,.json,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F5F6F7] hover:bg-[#EBEBEB] border border-[#DEE0E3] rounded-lg cursor-pointer transition-colors">
              <svg className="w-4 h-4 text-[#646A73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm font-medium text-[#1F2329]">选择文件</span>
            </div>
          </label>

          <button
            onClick={loadExample}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#F5F6F7] border border-[#DEE0E3] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-[#646A73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span className="text-sm font-medium text-[#1F2329]">示例</span>
          </button>

          {inputText && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-red-50 border border-[#DEE0E3] hover:border-red-200 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-[#646A73] hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-[#646A73] space-y-1">
          <p className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            支持从飞书表格直接复制粘贴
          </p>
          <p className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            自动识别 CSV、TSV、JSON 格式
          </p>
        </div>
      </div>
    </div>
  );
}
