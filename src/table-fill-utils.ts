/**
 * table-fill-utils.ts - 表格数据智能填充纯函数工具
 *
 * 支持向下填充 (Fill Down) 与向右填充 (Fill Right)：
 * 1. 纯数字：按步长 +1 递增（如 1 → 2 → 3，1.5 → 2.5 → 3.5）
 * 2. 带前导零数字：保持格式宽度递增（如 001 → 002 → 003）
 * 3. 序号文本：自动识别中间或末尾数字序列并递增（如 第1期 → 第2期，Task-01 → Task-02）
 * 4. 普通文本：原样复制填充
 * 5. 支持单格光标（填充至末尾）与多选区范围（填充至选区边界）
 */

import { splitTableRow, isSeparatorLine, getColumnCount } from "./table-model";

/**
 * 智能递增单元格内容纯函数
 * @param source 原单元格文本
 * @param step 步数偏移（1 表示下一个，2 表示下两个...）
 */
export function smartIncrement(source: string, step: number): string {
  if (!source) return "";
  const trimmed = source.trim();
  if (trimmed === "") return "";

  // 1. 纯整数判断（支持正负号与前导零）
  const intMatch = trimmed.match(/^([+-]?)(\d+)$/);
  if (intMatch) {
    const sign = intMatch[1];
    const digits = intMatch[2];
    const num = parseInt(sign + digits, 10);
    const nextVal = num + step;

    // 若原文本包含前导零且位数大于 1（例如 "001" 或 "07"）
    if (digits.length > 1 && digits.startsWith("0")) {
      if (nextVal >= 0) {
        return String(nextVal).padStart(digits.length, "0");
      }
      return String(nextVal);
    }
    return String(nextVal);
  }

  // 2. 浮点数判断（例如 "1.5", "-3.14"）
  const floatMatch = trimmed.match(/^([+-]?\d+)\.(\d+)$/);
  if (floatMatch) {
    const base = parseFloat(trimmed);
    const decimals = floatMatch[2].length;
    const nextVal = base + step;
    return nextVal.toFixed(decimals);
  }

  // 3. 序号类混合文本（如 "第1期", "Task-01", "Item 1 (draft)", "A099"）
  // 提取文本中的最后一个数字片段进行自增
  const seqMatch = trimmed.match(/^(.*?)(\d+)([^\d]*)$/);
  if (seqMatch) {
    const prefix = seqMatch[1];
    const numStr = seqMatch[2];
    const suffix = seqMatch[3];

    const num = parseInt(numStr, 10);
    const nextVal = num + step;

    let paddedNum = String(nextVal);
    // 如果原数字部分有前导零（如 "01"），且自增后为正数，则保持位数
    if (numStr.length > 1 && numStr.startsWith("0") && nextVal >= 0) {
      paddedNum = String(nextVal).padStart(numStr.length, "0");
    }

    return `${prefix}${paddedNum}${suffix}`;
  }

  // 4. 普通纯文本：原样复制
  return source;
}

/**
 * 将 DOM 行号转换为行模型在 _lines 数组中的索引
 * DOM row 0 为表头（model index 0）
 * DOM row 1 为第一条数据（model index 2，因为 index 1 是分隔行）
 */
export function domRowToLineIndex(domRow: number): number {
  return domRow === 0 ? 0 : domRow + 1;
}

/**
 * 获取 DOM 视角下的总行数（排除分隔线行）
 */
export function getTotalDomRows(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    if (!isSeparatorLine(line)) {
      count++;
    }
  }
  return count;
}

/**
 * 获取指定 DOM 行在指定 DOM 列的单元格内容
 */
export function getCellAt(lines: string[], domRow: number, domCol: number): string {
  const lineIdx = domRowToLineIndex(domRow);
  const line = lines[lineIdx];
  if (!line) return "";
  const cells = splitTableRow(line);
  return cells[domCol] ?? "";
}

/**
 * 设置指定 DOM 行在指定 DOM 列的单元格内容
 */
export function setCellAt(lines: string[], domRow: number, domCol: number, value: string): void {
  const lineIdx = domRowToLineIndex(domRow);
  const orig = lines[lineIdx];
  if (orig === undefined) return;
  const cells = splitTableRow(orig);
  if (domCol >= cells.length) {
    // 补齐列
    while (cells.length < domCol) {
      cells.push("");
    }
    cells.push(value);
  } else {
    cells[domCol] = value;
  }
  lines[lineIdx] = `| ${cells.join(" | ")} |`;
}

/**
 * 向下填充单列
 * @param lines 表格行模型数组
 * @param startRow 起始 DOM 行（通常是光标所在行）
 * @param col 目标 DOM 列
 * @param endRow 结束 DOM 行（默认为表格最末行）
 */
export function fillColumnDown(
  lines: string[],
  startRow: number,
  col: number,
  endRow?: number
): string[] {
  const result = [...lines];
  const totalDomRows = getTotalDomRows(result);
  const targetEndRow = endRow !== undefined ? Math.min(endRow, totalDomRows - 1) : totalDomRows - 1;

  if (startRow >= targetEndRow) return result;

  const sourceContent = getCellAt(result, startRow, col);

  for (let r = startRow + 1; r <= targetEndRow; r++) {
    const step = r - startRow;
    const newContent = smartIncrement(sourceContent, step);
    setCellAt(result, r, col, newContent);
  }

  return result;
}

/**
 * 向右填充单行
 * @param lines 表格行模型数组
 * @param row 目标 DOM 行
 * @param startCol 起始 DOM 列（通常是光标所在列）
 * @param endCol 结束 DOM 列（默认为表格最右列）
 */
export function fillRowRight(
  lines: string[],
  row: number,
  startCol: number,
  endCol?: number
): string[] {
  const result = [...lines];
  const totalCols = getColumnCount(result);
  const targetEndCol = endCol !== undefined ? Math.min(endCol, totalCols - 1) : totalCols - 1;

  if (startCol >= targetEndCol) return result;

  const sourceContent = getCellAt(result, row, startCol);

  for (let c = startCol + 1; c <= targetEndCol; c++) {
    const step = c - startCol;
    const newContent = smartIncrement(sourceContent, step);
    setCellAt(result, row, c, newContent);
  }

  return result;
}

/**
 * 选区范围或光标位置批量填充
 * @param lines 表格行模型数组
 * @param cursorCoord 光标所在单元格坐标
 * @param selectedRows 当前选中的行集合（如果有多选）
 * @param selectedCols 当前选中的列集合（如果有多选）
 * @param direction "down" (向下填充) 或 "right" (向右填充)
 */
export function fillTable(
  lines: string[],
  cursorCoord: { row: number; col: number },
  selectedRows: number[] | null | undefined,
  selectedCols: number[] | null | undefined,
  direction: "down" | "right"
): string[] {
  let result = [...lines];
  const totalDomRows = getTotalDomRows(result);
  const totalCols = getColumnCount(result);

  const hasMultiRows = !!selectedRows && selectedRows.length > 1;
  const hasMultiCols = !!selectedCols && selectedCols.length > 1;

  if (direction === "down") {
    if (hasMultiRows) {
      // 存在多行选区：在选区内的每列从选区第一行填充至选区末行
      const sortedRows = [...selectedRows].sort((a, b) => a - b);
      const startR = sortedRows[0];
      const endR = sortedRows[sortedRows.length - 1];
      const targetCols = (selectedCols && selectedCols.length > 0) ? selectedCols : [cursorCoord.col];

      for (const col of targetCols) {
        result = fillColumnDown(result, startR, col, endR);
      }
    } else {
      // 无多行选区：从当前行（或选中的列）一直向下填充到表格底部
      const startR = cursorCoord.row;
      const targetCols = (selectedCols && selectedCols.length > 0) ? selectedCols : [cursorCoord.col];

      for (const col of targetCols) {
        result = fillColumnDown(result, startR, col, totalDomRows - 1);
      }
    }
  } else if (direction === "right") {
    if (hasMultiCols) {
      // 存在多列选区：在选区内的每行从选区第一列填充至选区最右列
      const sortedCols = [...selectedCols].sort((a, b) => a - b);
      const startC = sortedCols[0];
      const endC = sortedCols[sortedCols.length - 1];
      const targetRows = (selectedRows && selectedRows.length > 0) ? selectedRows : [cursorCoord.row];

      for (const row of targetRows) {
        result = fillRowRight(result, row, startC, endC);
      }
    } else {
      // 无多列选区：从当前列（或选中的行）一直向右填充到表格最右侧
      const startC = cursorCoord.col;
      const targetRows = (selectedRows && selectedRows.length > 0) ? selectedRows : [cursorCoord.row];

      for (const row of targetRows) {
        result = fillRowRight(result, row, startC, totalCols - 1);
      }
    }
  }

  return result;
}
