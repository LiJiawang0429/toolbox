/**
 * @file dataParser
 * @description 数据解析工具：支持 CSV / TSV / JSON / 纯文本表格，并智能猜测列用途
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import type { DataRow, ParsedData } from '../types';

/**
 * 检测文本格式类型
 * @param text 输入文本
 * @returns 格式类型
 */
export function detectFormat(text: string): 'csv' | 'tsv' | 'json' | 'unknown' {
  const trimmed = text.trim();

  // 检测 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // 继续检测其他格式
    }
  }

  // 检测 TSV（制表符分隔）
  if (trimmed.includes('\t')) {
    return 'tsv';
  }

  // 检测 CSV（逗号分隔）
  if (trimmed.includes(',')) {
    return 'csv';
  }

  return 'unknown';
}

/**
 * 解析单行 CSV/TSV（处理引号）
 * @param line 行文本
 * @param delimiter 分隔符
 * @returns 字段数组
 */
function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * 解析 CSV/TSV 格式
 * @param text 输入文本
 * @param delimiter 分隔符
 * @returns 解析后的数据
 */
export function parseDelimitedText(
  text: string,
  delimiter: string = ','
): ParsedData {
  const lines = text.trim().split('\n');

  if (lines.length === 0) {
    return { rawData: [], columns: [], rowCount: 0 };
  }

  const headers = parseLine(lines[0], delimiter);

  const rawData: DataRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const values = parseLine(line, delimiter);
      const row: DataRow = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        const numValue = Number(value);
        row[header] = !isNaN(numValue) && value !== '' ? numValue : value;
      });
      rawData.push(row);
    }
  }

  return {
    rawData,
    columns: headers,
    rowCount: rawData.length,
  };
}

/**
 * 解析 JSON 格式
 * @param text JSON 文本
 * @returns 解析后的数据
 */
export function parseJSON(text: string): ParsedData {
  try {
    const parsed = JSON.parse(text.trim());

    let data: DataRow[] = [];

    if (Array.isArray(parsed)) {
      data = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      data = [parsed];
    }

    const columnSet = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => columnSet.add(key));
    });

    return {
      rawData: data,
      columns: Array.from(columnSet),
      rowCount: data.length,
    };
  } catch (error) {
    throw new Error('JSON 解析失败: ' + (error as Error).message);
  }
}

/**
 * 自动解析数据（自动检测格式）
 * @param text 输入文本
 * @returns 解析后的数据
 */
export function autoParse(text: string): ParsedData {
  const format = detectFormat(text);

  switch (format) {
    case 'json':
      return parseJSON(text);
    case 'tsv':
      return parseDelimitedText(text, '\t');
    case 'csv':
      return parseDelimitedText(text, ',');
    default:
      // 默认尝试空格或制表符分隔
      if (text.includes('  ')) {
        return parseDelimitedText(text.replace(/\s+/g, '\t'), '\t');
      }
      return parseDelimitedText(text, '\t');
  }
}

/**
 * 从飞书表格粘贴的文本中提取数据
 * 飞书表格复制出来通常是制表符分隔的格式
 * @param text 粘贴的文本
 * @returns 解析后的数据
 */
export function parseFeishuTable(text: string): ParsedData {
  try {
    return autoParse(text);
  } catch {
    return parseDelimitedText(text, '\t');
  }
}

/**
 * 智能猜测列用途
 * @param columns 列名数组
 * @param sampleData 样本数据
 * @returns 猜测的真实标签列和预测标签列
 */
export function guessColumns(
  columns: string[],
  _sampleData: DataRow[]
): { actual?: string; predicted?: string } {
  const lowerColumns = columns.map((c) => c.toLowerCase());

  const actualKeywords = ['actual', 'true', 'label', '真实', '标签', '实际', '真值', 'ground_truth', 'gt'];
  const predictedKeywords = ['predicted', 'pred', 'prediction', '预测', '结果', 'output', '模型', 'model'];

  let actual: string | undefined;
  let predicted: string | undefined;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const lowerCol = lowerColumns[i];

    if (!actual && actualKeywords.some((k) => lowerCol.includes(k))) {
      actual = col;
    }
    if (!predicted && predictedKeywords.some((k) => lowerCol.includes(k))) {
      predicted = col;
    }
  }

  if (!actual && columns.length >= 1) {
    actual = columns[0];
  }
  if (!predicted && columns.length >= 2) {
    predicted = columns[1];
  } else if (!predicted && columns.length === 1) {
    predicted = columns[0];
  }

  return { actual, predicted };
}

/**
 * 验证数据是否可用于混淆矩阵
 * @param data 解析后的数据
 * @param actualColumn 真实标签列名
 * @param predictedColumn 预测标签列名
 * @returns 验证结果
 */
export function validateData(
  data: ParsedData,
  actualColumn: string,
  predictedColumn: string
): { valid: boolean; message?: string } {
  if (data.rawData.length === 0) {
    return { valid: false, message: '数据为空' };
  }

  if (!data.columns.includes(actualColumn)) {
    return { valid: false, message: `未找到真实标签列: ${actualColumn}` };
  }

  if (!data.columns.includes(predictedColumn)) {
    return { valid: false, message: `未找到预测标签列: ${predictedColumn}` };
  }

  const sampleRow = data.rawData[0];
  const actualValue = sampleRow[actualColumn];
  const predictedValue = sampleRow[predictedColumn];

  if (actualValue === undefined || actualValue === null || actualValue === '') {
    return { valid: false, message: '真实标签列包含空值' };
  }

  if (predictedValue === undefined || predictedValue === null || predictedValue === '') {
    return { valid: false, message: '预测标签列包含空值' };
  }

  return { valid: true };
}
