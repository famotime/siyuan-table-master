/**
 * table-to-db-utils.ts
 * 
 * Markdown 表格转 SiYuan 数据库（Attribute View）的核心数据结构与智能字段类型推断工具库
 */

export type DbFieldType = "text" | "number" | "date" | "select" | "mSelect" | "checkbox" | "url";

export interface ColumnMeta {
  index: number;
  name: string;
  inferredType: DbFieldType;
  selectedType: DbFieldType;
}

export interface TableDbData {
  headers: string[];
  columns: ColumnMeta[];
  rows: string[][];
}

/** 正则判断集合 */
const REGEX_CHECKBOX = /^(true|false|是|否|✓|✗|\[\s?\]|\[x\]|yes|no)$/i;
const REGEX_URL = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;
const REGEX_DATE = /^(\d{4}[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])(\s+(0?\d|1\d|2[0-3]):[0-5]\d(:[0-5]\d)?)?)$/;
const REGEX_NUMBER = /^[-+]?\d{1,3}(,\d{3})*(\.\d+)?%?$|^[-+]?[$¥€£]?\d+(,\d{3})*(\.\d+)?%?$/;

/**
 * 智能推断指定列的字段类型
 * 
 * @param colIndex 列索引
 * @param values 该列在所有数据行中的文本数组
 * @returns 推断出的 DbFieldType
 */
export function inferColumnType(colIndex: number, values: string[]): DbFieldType {
  // 第一列默认为主属性/标题列（文本类型）
  if (colIndex === 0) {
    return "text";
  }

  // 过滤空白单元格
  const cleanValues = values.map(v => v.trim()).filter(v => v.length > 0);
  if (cleanValues.length === 0) {
    return "text";
  }

  // 1. 检查是否全为复选框/布尔类型
  const isAllCheckbox = cleanValues.every(v => REGEX_CHECKBOX.test(v));
  if (isAllCheckbox) {
    return "checkbox";
  }

  // 2. 检查是否全为 URL
  const isAllUrl = cleanValues.every(v => REGEX_URL.test(v));
  if (isAllUrl) {
    return "url";
  }

  // 3. 检查是否全为日期
  const isAllDate = cleanValues.every(v => REGEX_DATE.test(v));
  if (isAllDate) {
    return "date";
  }

  // 4. 检查是否全为数字（在 mSelect 之前检查，避免包含千分位逗号的数字被误判为多选）
  const isAllNumber = cleanValues.every(v => REGEX_NUMBER.test(v));
  if (isAllNumber) {
    return "number";
  }

  // 检查是否包含混合特殊格式（例如部分为数字/日期，但另一部分为非数字文本，导致不匹配）
  const hasSomeNumber = cleanValues.some(v => REGEX_NUMBER.test(v));
  const hasSomeDate = cleanValues.some(v => REGEX_DATE.test(v));
  const hasSomeUrl = cleanValues.some(v => REGEX_URL.test(v));
  if ((hasSomeNumber && !isAllNumber) || (hasSomeDate && !isAllDate) || (hasSomeUrl && !isAllUrl)) {
    return "text";
  }

  // 5. 检查是否为多选 (mSelect)：单元格中包含逗号、分号或顿号分隔符
  const hasDelimiter = cleanValues.some(v => /[,;、|]/.test(v));
  if (hasDelimiter && cleanValues.length >= 2) {
    return "mSelect";
  }

  // 6. 检查是否为单选 (select)：去重种类较少 (<= 5)
  const uniqueValues = new Set(cleanValues);
  if (uniqueValues.size <= 5 && cleanValues.length >= 2) {
    return "select";
  }

  // 默认降级为文本
  return "text";
}

/**
 * 解析二维表格数据并生成智能列推断元数据
 * 
 * @param rawHeaders 表头数组
 * @param rawRows 数据行二维数组
 */
export function parseTableDataForDb(rawHeaders: string[], rawRows: string[][]): TableDbData {
  const colCount = Math.max(
    rawHeaders.length,
    ...rawRows.map(r => r.length)
  );

  const headers: string[] = [];
  const columns: ColumnMeta[] = [];

  for (let i = 0; i < colCount; i++) {
    // 补全表头名称
    const rawHeader = (rawHeaders[i] || "").trim();
    const headerName = rawHeader || `列 ${i + 1}`;
    headers.push(headerName);

    // 提取该列数据值
    const colValues = rawRows.map(row => row[i] || "");
    const inferred = inferColumnType(i, colValues);

    columns.push({
      index: i,
      name: headerName,
      inferredType: inferred,
      selectedType: inferred
    });
  }

  return {
    headers,
    columns,
    rows: rawRows
  };
}
