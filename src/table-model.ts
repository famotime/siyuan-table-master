/**
 * table-model.ts - 表格行模型纯函数
 * 
 * 处理 kramdown ↔ 行数组的转换，核心库的输入输出模型。
 * 所有函数纯同步、无副作用，方便单元测试。
 * 
 * 思源表格块的 kramdown 输出格式:
 *   | Col1 | Col2 |
 *   |------|------|
 *   | Data | Data |
 *   {: id="xxx" data-node-id="xxx" ...}
 * 
 * 关键设计: IAL（Inline Attribute List）行与表格主体分离处理，
 * 核心库只操作表格行，IAL 由适配层单独管理。
 */

/** 解析后的表格 kramdown 结构 */
export interface ParsedTableKramdown {
  /** 表格 Markdown 行（从表头到最后一行数据） */
  tableLines: string[];
  /** 块级 IAL 行（可能为空） */
  ialLine: string | null;
  /** 表格在原文中的起始行号 */
  startLineIndex: number;
  /** IAL 在原文中的行号（如果有） */
  ialLineIndex: number | null;
}

/**
 * 从 kramdown 文本中分离表格行和 IAL 行
 * 
 * @param kramdown - getBlockKramdown 返回的完整文本
 * @returns 解析后的结构
 */
export function parseTableKramdown(kramdown: string): ParsedTableKramdown {
  if (typeof kramdown !== "string") {
    kramdown = String(kramdown ?? "");
  }
  const lines = kramdown.split("\n");

  // 找到所有表格行（以 | 开头或以 | 结尾）
  const tableLineIndices: number[] = [];
  let ialLineIndex: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableLineIndices.push(i);
    } else if (trimmed.startsWith("{:")) {
      ialLineIndex = i;
    }
  }

  const tableLines = tableLineIndices.map(i => lines[i]);

  // 净化数据行：将仅含占位横杠 "-" 的单元格清空，防止写入思源时保留真实的 "-" 脏数据
  const sanitizedLines = tableLines.map((line, index) => {
    if (index < 2) return line; // 排除表头(0)和分隔行(1)
    
    // 如果不是有效的表格行，保持原样
    if (!line.trim().startsWith("|")) return line;
    
    const cells = splitTableRow(line);
    const hasDashCell = cells.some(cell => cell === "-");
    if (!hasDashCell) return line;
    
    // 自动将含有短横杠 "-" 且无其他字符的单元格净化为空
    const newCells = cells.map(cell => cell === "-" ? "" : cell);
    return `| ${newCells.join(" | ")} |`;
  });

  return {
    tableLines: sanitizedLines,
    ialLine: ialLineIndex !== null ? lines[ialLineIndex] : null,
    startLineIndex: tableLineIndices[0] ?? 0,
    ialLineIndex,
  };
}

/**
 * 将表格行和 IAL 重新组合为 kramdown 文本
 * 
 * @param tableLines - 核心库操作后的表格行
 * @param ialLine - 原始 IAL 行（可能为 null）
 * @returns 完整的 kramdown 文本
 */
export function serializeTableKramdown(
  tableLines: string[],
  ialLine: string | null,
): string {
  const parts = [...tableLines];
  if (ialLine) {
    parts.push(ialLine);
  }
  return parts.join("\n");
}

/**
 * 检测一行是否是表格分隔行（|---|---| 等变体）
 */
export function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;

  // 去掉首尾 | 后，按 | 分割，每个分隔单元格只含 -, :, 空格，且必须包含至少一个破折号 -
  const inner = trimmed.slice(1, -1);
  const cells = inner.split("|");
  return cells.length > 0 && cells.every(cell => /^\s*:?-+:?\s*$/.test(cell));
}

/**
 * 获取表格列数（从表头行解析）
 */
export function getColumnCount(tableLines: string[]): number {
  if (tableLines.length === 0) return 0;

  // 表头行: | Col1 | Col2 | Col3 |
  const headerLine = tableLines[0];
  const cells = splitTableRow(headerLine);
  return cells.length;
}

/**
 * 将表格行按 | 分割为单元格数组
 * 处理转义管道符 \|
 */
export function splitTableRow(line: string): string[] {
  // 去掉首尾的 |
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [trimmed];
  }

  const inner = trimmed.slice(1, -1);

  // 按 | 分割，但跳过转义的 \|
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of inner) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());

  return cells;
}

/**
 * 检查行索引是否在分隔行位置（表格行的第 1 行，索引 1）
 * 核心库的表格模型: 行 0 = 表头, 行 1 = 分隔行, 行 2+ = 数据
 */
export function isDataLine(lineIndex: number): boolean {
  return lineIndex >= 2;
}

/**
 * 将 DOM 单元格坐标（行/列,0-indexed）转换为核心库的行模型坐标
 * 
 * DOM: thead > tr[0] = 表头, tbody > tr[0] = 第一行数据
 * 核心库: 行 0 = 表头, 行 1 = 分隔行, 行 2 = 第一行数据
 * 
 * @param domRow - DOM tr 索引（0=表头行）
 * @param domCol - DOM td/th 索引（0=第一列）
 * @returns 核心库的 Point (row=行号, column=字符偏移)
 *   注意：column 需要根据文本内容计算精确偏移
 */
export function domCoordToRowModelIndex(
  domRow: number,
  domCol: number,
  tableLines: string[],
): { row: number; approxCol: number } {
  // 核心库行号 = DOM行号 + 1（因为分隔行插入在表头和数据之间）
  // 但如果 DOM 行 0 是 thead tr，对应核心库行 0
  // DOM 行 1 是 tbody tr[0]，对应核心库行 2（跳过分隔行）
  const row = domRow === 0 ? 0 : domRow + 1;

  // 近似列偏移：找到第 domCol 个 | 后的位置
  const line = tableLines[row] || "";
  const approxCol = getPipePosition(line, domCol + 1);

  return { row, approxCol };
}

/**
 * 获取一行中第 n 个管道符 | 的位置（字符偏移）
 */
export function getPipePosition(line: string, n: number): number {
  let count = 0;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (line[i] === "\\") {
      escaped = true;
      continue;
    }
    if (line[i] === "|") {
      count++;
      if (count === n) {
        return i + 1; // 返回 | 后面的位置
      }
    }
  }

  return line.length;
}

/**
 * CJK 字符串显示宽度（用于对齐计算）
 * CJK 字符占 2 宽度，ASCII 占 1
 */
export function displayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0);
    // CJK Unified Ideographs, 全角符号等
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK 基本
      (code >= 0x3000 && code <= 0x303F) ||  // CJK 标点
      (code >= 0xFF00 && code <= 0xFFEF)     // 全角
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 对格式化后的表格行做 CJK 宽度校正
 * 
 * 核心库 FormatType.NORMAL 把 CJK 字符按 1 字符宽度 padding，
 * 但显示时 CJK 占 2 宽度，导致列宽不齐。
 * 
 * 此函数：
 * 1. 收集每列所有单元格的 CJK 显示宽度
 * 2. 以最大显示宽度为基准，重新 padding 所有单元格
 * 3. 重建分隔行使其与数据行显示宽度一致
 */
export function fixCJKSeparatorWidth(tableLines: string[]): string[] {
  if (tableLines.length < 2) return tableLines;

  const separatorLine = tableLines[1];
  if (!isSeparatorLine(separatorLine)) return tableLines;

  // 收集每列所有单元格文本
  const numCols = splitTableRow(tableLines[0]).length;
  const colDisplayWidths: number[] = [];

  for (let col = 0; col < numCols; col++) {
    let maxDisplayWidth = 3; // 最小宽度
    for (const line of tableLines) {
      if (isSeparatorLine(line)) continue;
      const cells = splitTableRow(line);
      if (cells[col] !== undefined) {
        maxDisplayWidth = Math.max(maxDisplayWidth, displayWidth(cells[col]));
      }
    }
    colDisplayWidths.push(maxDisplayWidth);
  }

  // 重建所有行
  const result: string[] = [];

  for (let rowIdx = 0; rowIdx < tableLines.length; rowIdx++) {
    const line = tableLines[rowIdx];

    if (isSeparatorLine(line)) {
      // 重建分隔行时，必须读取原始分隔单元格的对齐标记（冒号 :）并保留
      // 否则 alignColumn 写入的 :---:/:--- /---: 会在此被抹除，导致对齐失效
      const originalSepCells = splitTableRow(line);
      const sepCells = colDisplayWidths.map((w, col) => {
        const orig = (originalSepCells[col] || "---").trim();
        const hasLeftColon = orig.startsWith(":");
        const hasRightColon = orig.endsWith(":");
        // 破折号数量 = 目标显示宽度 - 已被冒号占用的宽度
        const dashCount = Math.max(1, w - (hasLeftColon ? 1 : 0) - (hasRightColon ? 1 : 0));
        const dashes = "-".repeat(dashCount);
        const cell = (hasLeftColon ? ":" : "") + dashes + (hasRightColon ? ":" : "");
        return ` ${cell} `;
      });
      result.push(`|${sepCells.join("|")}|`);
    } else {
      // 重建数据/表头行：用显示宽度 padding
      const cells = splitTableRow(line);
      const paddedCells = cells.map((cell, col) => {
        const cellDisplayWidth = displayWidth(cell);
        const targetDisplayWidth = colDisplayWidths[col] || 3;
        const paddingNeeded = targetDisplayWidth - cellDisplayWidth;
        // 右侧填充空格
        return ` ${cell}${" ".repeat(Math.max(0, paddingNeeded))} `;
      });
      result.push(`|${paddedCells.join("|")}|`);
    }
  }

  return result;
}

/**
 * 批量删除表格指定的 DOM 行（0-indexed，0 为表头）。
 * 
 * 规则：
 * 1. 表头行（DOM row 0）不允许作为普通行删除。如果仅选中表头行，返回 error: "cannot_delete_header"。
 * 2. 如果选区包含表头行以及数据行，则只删除选中的数据行，保留表头行。
 * 3. 若所有数据行均被删除，保留一行空数据行以保证 Markdown 表格结构合法。
 * 4. 自动保留 CJK 宽度校正与格式。
 * 
 * @param tableLines - 表格行数组（行 0 = 表头，行 1 = 分隔行，行 2+ = 数据行）
 * @param domRowsToDelete - 待删除的 DOM 行索引数组（0-indexed）
 * @returns 处理结果对象
 */
export function deleteTableRows(
  tableLines: string[],
  domRowsToDelete: number[],
): { lines: string[]; deletedCount: number; error?: "cannot_delete_header" } {
  if (tableLines.length < 2) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  const uniqueDomRows = Array.from(new Set(domRowsToDelete));
  // 过滤出真正的数据行 (DOM 行号 >= 1)
  const dataDomRows = uniqueDomRows.filter(r => r >= 1);

  // 如果待删除列表里只有表头行 (0)，且没有数据行
  if (dataDomRows.length === 0 && uniqueDomRows.includes(0)) {
    return { lines: [...tableLines], deletedCount: 0, error: "cannot_delete_header" };
  }

  if (dataDomRows.length === 0) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  // DOM 行号 r 对应 tableLines 的行索引 r + 1 (因为行 1 是分隔行)
  const lineIndicesToDelete = new Set(
    dataDomRows
      .map(r => r + 1)
      .filter(idx => idx >= 2 && idx < tableLines.length)
  );

  if (lineIndicesToDelete.size === 0) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  let newLines = tableLines.filter((_, idx) => !lineIndicesToDelete.has(idx));

  // 如果所有数据行都被删除了（只剩表头和分隔行），自动补一行空数据行保持表格合法性
  if (newLines.length === 2) {
    const colCount = getColumnCount(newLines);
    const emptyCells = Array.from({ length: colCount }, () => "");
    newLines.push(`| ${emptyCells.join(" | ")} |`);
  }

  // 做一次 CJK 宽度校正
  newLines = fixCJKSeparatorWidth(newLines);

  return {
    lines: newLines,
    deletedCount: lineIndicesToDelete.size,
  };
}

/**
 * 批量删除表格指定的 DOM 列（0-indexed，0 为第一列）。
 * 
 * 规则：
 * 1. 表格至少需要保留一列。若待删除列数 >= 总列数，返回 error: "cannot_delete_all_columns"。
 * 2. 依次过滤每行（包含表头、分隔行、所有数据行）中对应列的单元格。
 * 3. 自动保留 CJK 宽度校正与格式。
 * 
 * @param tableLines - 表格行数组
 * @param domColsToDelete - 待删除的 DOM 列索引数组（0-indexed）
 * @returns 处理结果对象
 */
export function deleteTableColumns(
  tableLines: string[],
  domColsToDelete: number[],
): { lines: string[]; deletedCount: number; error?: "cannot_delete_all_columns" } {
  if (tableLines.length === 0) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  const totalCols = getColumnCount(tableLines);
  if (totalCols === 0) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  const validCols = new Set(
    domColsToDelete.filter(c => c >= 0 && c < totalCols)
  );

  if (validCols.size === 0) {
    return { lines: [...tableLines], deletedCount: 0 };
  }

  if (validCols.size >= totalCols) {
    return { lines: [...tableLines], deletedCount: 0, error: "cannot_delete_all_columns" };
  }

  let newLines = tableLines.map(line => {
    if (!line.trim().startsWith("|")) return line;
    const isSep = isSeparatorLine(line);
    const cells = splitTableRow(line);
    const filteredCells = cells.filter((_, colIdx) => !validCols.has(colIdx));
    if (isSep) {
      return `|${filteredCells.map(c => ` ${c.trim()} `).join("|")}|`;
    }
    return `| ${filteredCells.join(" | ")} |`;
  });

  newLines = fixCJKSeparatorWidth(newLines);

  return {
    lines: newLines,
    deletedCount: validCols.size,
  };
}
