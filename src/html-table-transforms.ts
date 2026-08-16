/**
 * html-table-transforms.ts - HTML 表格结构变换与排版纯函数
 *
 * 涵盖：表格转置（行列互换）、整表拆分、复制行列、均分行高列宽、
 * 按列智能排序（数字/日期/货币/文本）、表头与总计行状态设置。
 * 纯算法实现，不依赖 DOM 运行环境，便于完整单元测试。
 */

import { CellData, createCell } from "./html-dialog-utils";
import { parseNumber } from "./utils/number-utils";

/**
 * 检查表格矩阵中是否存在合并单元格 (rowSpan > 1 或 colSpan > 1)
 */
export function hasMergedCells(matrix: CellData[][]): boolean {
  for (const row of matrix) {
    for (const cell of row) {
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 构建二维视觉网格映射（展开 colspan / rowspan）
 */
export function buildVisualGrid(matrix: CellData[][]): (CellData | null)[][] {
  const rowCount = matrix.length;
  if (rowCount === 0) return [];

  // 计算最大列数
  let maxCol = 0;
  for (const row of matrix) {
    let cols = 0;
    for (const cell of row) {
      cols += cell.colSpan;
    }
    if (cols > maxCol) maxCol = cols;
  }

  const grid: (CellData | null)[][] = Array.from({ length: rowCount }, () =>
    Array(maxCol).fill(null)
  );

  for (let r = 0; r < rowCount; r++) {
    let c = 0;
    for (const cell of matrix[r]) {
      while (c < maxCol && grid[r][c] !== null) {
        c++;
      }
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          if (r + dr < rowCount && c + dc < maxCol) {
            grid[r + dr][c + dc] = cell;
          }
        }
      }
      c += cell.colSpan;
    }
  }

  return grid;
}

/**
 * 矩阵深拷贝
 */
export function cloneMatrix(matrix: CellData[][]): CellData[][] {
  return matrix.map((row, r) =>
    row.map((cell, c) => ({
      ...cell,
      r,
      c,
      style: { ...cell.style },
      backup: cell.backup ? { ...cell.backup, style: { ...cell.backup.style } } : undefined,
    }))
  );
}

/**
 * 表格转置 (绕左上角 90° 行列互换)
 * 含合并单元格时安全拦截并返回错误
 */
export function transposeMatrix(matrix: CellData[][]): {
  success: boolean;
  matrix?: CellData[][];
  error?: string;
} {
  if (!matrix || matrix.length === 0 || !matrix[0] || matrix[0].length === 0) {
    return { success: false, error: "表格为空，无法转置" };
  }

  if (hasMergedCells(matrix)) {
    return {
      success: false,
      error: "含合并单元格的表格结构无法无损转置，已自动拦截",
    };
  }

  const oldRowCount = matrix.length;
  const oldColCount = matrix[0].length;

  const newMatrix: CellData[][] = [];

  for (let c = 0; c < oldColCount; c++) {
    const newRow: CellData[] = [];
    for (let r = 0; r < oldRowCount; r++) {
      const srcCell = matrix[r][c];
      const newCell = createCell(c, r, {
        content: srcCell.content,
        rowSpan: 1,
        colSpan: 1,
        style: { ...srcCell.style },
        backup: srcCell.backup ? { ...srcCell.backup } : undefined,
      });
      newRow.push(newCell);
    }
    newMatrix.push(newRow);
  }

  return { success: true, matrix: newMatrix };
}

/**
 * 整表拆分 (从指定行拆分为两部分)
 * @param atRow 拆分起始行号（0-indexed，该行及以下移入新表）
 * @param copyHeader 是否将原表首行（表头）复制给拆分后的第二张表
 */
export function splitMatrix(
  matrix: CellData[][],
  atRow: number,
  copyHeader = false
): {
  success: boolean;
  top?: CellData[][];
  bottom?: CellData[][];
  error?: string;
} {
  if (!matrix || matrix.length <= 1) {
    return { success: false, error: "单行表格无法拆分" };
  }
  if (atRow <= 0 || atRow >= matrix.length) {
    return { success: false, error: "拆分位置不合法（不可在首行前或表尾外拆分）" };
  }

  const topRows = matrix.slice(0, atRow);
  let bottomRows = matrix.slice(atRow);

  if (copyHeader && topRows.length > 0) {
    const headerClone = topRows[0].map((cell) =>
      createCell(0, cell.c, {
        content: cell.content,
        rowSpan: 1,
        colSpan: cell.colSpan,
        style: { ...cell.style },
      })
    );
    bottomRows = [headerClone, ...bottomRows];
  }

  // 重新建立坐标索引
  const top = topRows.map((row, r) =>
    row.map((cell, c) => ({ ...cell, r, c, style: { ...cell.style } }))
  );
  const bottom = bottomRows.map((row, r) =>
    row.map((cell, c) => ({ ...cell, r, c, style: { ...cell.style } }))
  );

  return { success: true, top, bottom };
}

/**
 * 复制指定行并插入到其下方
 */
export function duplicateRowAt(matrix: CellData[][], rowIndex: number): CellData[][] {
  if (rowIndex < 0 || rowIndex >= matrix.length) return cloneMatrix(matrix);

  const newMatrix: CellData[][] = [];
  for (let r = 0; r < matrix.length; r++) {
    newMatrix.push(
      matrix[r].map((cell, c) => ({
        ...cell,
        r: newMatrix.length,
        c,
        style: { ...cell.style },
      }))
    );
    if (r === rowIndex) {
      // 克隆该行
      const clonedRow = matrix[r].map((cell, c) =>
        createCell(newMatrix.length, c, {
          content: cell.content,
          rowSpan: 1, // 复制出的新行收敛为单跨度
          colSpan: cell.colSpan,
          style: { ...cell.style },
        })
      );
      newMatrix.push(clonedRow);
    }
  }

  // 重新规范化所有 r 索引
  return newMatrix.map((row, r) => row.map((cell, c) => ({ ...cell, r, c })));
}

/**
 * 复制指定列并插入到其右侧
 */
export function duplicateColAt(matrix: CellData[][], colIndex: number): CellData[][] {
  if (matrix.length === 0 || colIndex < 0) return cloneMatrix(matrix);

  const newMatrix: CellData[][] = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    const newRow: CellData[] = [];
    for (let c = 0; c < row.length; c++) {
      newRow.push({ ...row[c], r, c: newRow.length, style: { ...row[c].style } });
      if (c === colIndex) {
        const src = row[c];
        newRow.push(
          createCell(r, newRow.length, {
            content: src.content,
            rowSpan: src.rowSpan,
            colSpan: 1, // 复制出的列跨度设为 1
            style: { ...src.style },
          })
        );
      }
    }
    newMatrix.push(newRow);
  }

  return newMatrix;
}

/**
 * 均分各列宽度 (重置为百分比等宽)
 */
export function distributeColWidths(matrix: CellData[][]): string[] {
  if (matrix.length === 0) return [];
  let maxCols = 0;
  for (const row of matrix) {
    let count = 0;
    for (const cell of row) {
      count += cell.colSpan || 1;
    }
    maxCols = Math.max(maxCols, count);
  }
  if (maxCols <= 0) return [];

  const pct = (100 / maxCols).toFixed(2) + "%";
  return Array(maxCols).fill(pct);
}

/**
 * 智能解析用于排序的单元格比较键值
 */
export function parseSortKey(content: string): {
  type: "number" | "date" | "text";
  val: number | string;
} {
  let clean = content.replace(/<[^>]+>/g, "").trim();
  if (!clean) {
    return { type: "number", val: -Infinity };
  }

  // 1. 尝试解析数字 / 货币 / 百分比
  let cleanNum = clean.replace(/^[¥$￥€£]\s*/, "");
  const numParsed = parseNumber(cleanNum);
  if (numParsed !== null) {
    return { type: "number", val: numParsed.value };
  }

  // 2. 尝试解析标准日期 (YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD)
  const dateMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dateMatch) {
    const timestamp = Date.parse(clean.replace(/\./g, "-"));
    if (!Number.isNaN(timestamp)) {
      return { type: "date", val: timestamp };
    }
  }

  // 3. 文本普通字符串
  return { type: "text", val: clean };
}

/**
 * 按指定列对表格矩阵进行智能排序
 * @param colIndex 目标排序物理列索引
 * @param ascending 是否升序
 * @param hasHeader 是否首行是表头（排序时跳过首行）
 */
export function sortMatrixByCol(
  matrix: CellData[][],
  colIndex: number,
  ascending = true,
  hasHeader = true
): CellData[][] {
  if (!matrix || matrix.length <= 1) return cloneMatrix(matrix);

  let headerRow: CellData[] | null = null;
  let totalRow: CellData[] | null = null;
  let dataRows: CellData[][] = [];

  let startIdx = 0;
  let endIdx = matrix.length;

  if (hasHeader) {
    headerRow = matrix[0];
    startIdx = 1;
  }

  // 检测末行是否是合计/总计行
  const lastRow = matrix[matrix.length - 1];
  const lastRowText = lastRow.map((c) => c.content.replace(/<[^>]+>/g, "")).join(" ");
  if (lastRowText.includes("合计") || lastRowText.includes("总计") || lastRowText.toLowerCase().includes("total")) {
    totalRow = lastRow;
    endIdx = matrix.length - 1;
  }

  if (startIdx >= endIdx) return cloneMatrix(matrix);

  dataRows = matrix.slice(startIdx, endIdx);

  // 执行排序
  dataRows.sort((rowA, rowB) => {
    const cellA = rowA[colIndex] || rowA[rowA.length - 1];
    const cellB = rowB[colIndex] || rowB[rowB.length - 1];
    const keyA = parseSortKey(cellA ? cellA.content : "");
    const keyB = parseSortKey(cellB ? cellB.content : "");

    let cmp = 0;
    if (keyA.type === "number" && keyB.type === "number") {
      cmp = (keyA.val as number) - (keyB.val as number);
    } else if (keyA.type === "date" && keyB.type === "date") {
      cmp = (keyA.val as number) - (keyB.val as number);
    } else {
      cmp = String(keyA.val).localeCompare(String(keyB.val), "zh-CN", {
        numeric: true,
        sensitivity: "base",
      });
    }

    return ascending ? cmp : -cmp;
  });

  const result: CellData[][] = [];
  if (headerRow) result.push(headerRow);
  for (const row of dataRows) result.push(row);
  if (totalRow) result.push(totalRow);

  // 重新修正 r 索引
  return result.map((row, r) =>
    row.map((cell, c) => ({
      ...cell,
      r,
      c,
      style: { ...cell.style },
    }))
  );
}
