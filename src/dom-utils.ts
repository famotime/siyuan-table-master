/**
 * dom-utils.ts - 思源 Protyle DOM 工具
 * 
 * 提供从 DOM 中定位表格块、反推光标坐标的工具函数。
 * 所有函数都是纯 DOM 操作，不依赖内核 API。
 */

/** 表格单元格坐标（行列从 0 开始，不含分隔行） */
export interface CellCoord {
  /** 行号（0 = 表头，1 = 第一行数据...），不含分隔行 */
  row: number;
  /** 列号（0 = 第一列） */
  col: number;
}

/**
 * 从当前选区/光标向上查找最近的 NodeTable 块元素
 * 
 * 思源 DOM 结构:
 *   div.protyle-wysiwyg
 *     div[data-node-id][data-type="NodeTable"]
 *       table
 *         thead > tr > th / tbody > tr > td
 * 
 * @param node - 起点 DOM 节点（通常是选区的 anchorNode）
 * @returns NodeTable 的块根元素，或 null
 */
export function findTableBlock(node: Node | null): HTMLElement | null {
  if (!node) return null;

  let current: Node | null = node;

  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      // 检查是否是 NodeTable 块
      if (current.dataset.type === "NodeTable" && current.dataset.nodeId) {
        return current;
      }
    }
    current = current.parentNode;
  }

  return null;
}

/**
 * 从 DOM Range 反推当前光标所在表格单元格的坐标
 * 
 * @param range - 当前选区
 * @param tableBlock - NodeTable 块根元素
 * @returns 单元格坐标，或 null（光标不在表格内）
 */
export function rangeToCellCoord(
  range: Range,
  tableBlock: HTMLElement,
): CellCoord | null {
  const table = tableBlock.querySelector("table");
  if (!table) return null;

  const rows = table.querySelectorAll("tr");
  if (rows.length === 0) return null;

  // 从选区获取光标所在的单元格
  const cell = getCellFromRange(range, tableBlock);
  if (!cell) return null;

  // 找到单元格所在行
  let rowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].contains(cell)) {
      rowIdx = i;
      break;
    }
  }
  if (rowIdx === -1) return null;

  // 找到单元格在行中的列位置
  const cells = rows[rowIdx].querySelectorAll("td, th");
  let colIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === cell) {
      colIdx = i;
      break;
    }
  }
  if (colIdx === -1) return null;

  return { row: rowIdx, col: colIdx };
}

/**
 * 从表格单元格坐标反向映射到 DOM Range
 * 
 * @param coord - 单元格坐标
 * @param tableBlock - NodeTable 块根元素
 * @param toStart - 是否定位到单元格内容起始位置（默认 true）
 * @returns Range 或 null
 */
export function cellCoordToRange(
  coord: CellCoord,
  tableBlock: HTMLElement,
  toStart = true,
): Range | null {
  const table = tableBlock.querySelector("table");
  if (!table) return null;

  const rows = table.querySelectorAll("tr");
  if (coord.row < 0 || coord.row >= rows.length) return null;

  const cells = rows[coord.row].querySelectorAll("td, th");
  if (coord.col < 0 || coord.col >= cells.length) return null;

  const cell = cells[coord.col];
  const range = document.createRange();

  if (toStart) {
    // 定位到单元格文本内容起始
    const textNode = getFirstTextNode(cell);
    if (textNode) {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 0);
    } else {
      range.setStart(cell, 0);
      range.setEnd(cell, 0);
    }
  } else {
    range.selectNodeContents(cell);
    range.collapse(false); // 折叠到末尾
  }

  return range;
}

/**
 * 获取选区所在的表格单元格（td 或 th）
 */
export function getCellFromRange(
  range: Range,
  tableBlock: HTMLElement,
): HTMLTableCellElement | null {
  const startContainer = range.startContainer;
  let node: Node | null = startContainer;

  while (node && node !== tableBlock) {
    if (node instanceof HTMLTableCellElement) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

/**
 * 获取元素内第一个文本节点（递归）
 */
function getFirstTextNode(element: Element): Text | null {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
  );
  return walker.nextNode() as Text | null;
}

/**
 * 获取表格的行数（不含分隔行，包含表头）
 * 思源 DOM: thead > tr + tbody > tr
 */
export function getTableRowCount(tableBlock: HTMLElement): number {
  const table = tableBlock.querySelector("table");
  if (!table) return 0;
  return table.querySelectorAll("tr").length;
}

/**
 * 获取表格的列数
 */
export function getTableColCount(tableBlock: HTMLElement): number {
  const table = tableBlock.querySelector("table");
  if (!table) return 0;
  const firstRow = table.querySelector("tr");
  if (!firstRow) return 0;
  return firstRow.querySelectorAll("td, th").length;
}

/**
 * 高亮表格中的当前操作行与列
 * 
 * @param tableBlock - NodeTable 的块根元素，为 null 时清除所有高亮
 * @param coord - 当前单元格坐标，为 null 时清除所有高亮
 */
/**
 * 获取元素在指定根节点下的唯一 CSS 选择器路径（基于 :nth-child）
 */
function getUniqueCssSelector(element: HTMLElement, rootElement: HTMLElement): string {
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== rootElement) {
    const parent = current.parentElement;
    if (!parent) break;

    const index = Array.from(parent.children).indexOf(current);
    const tagName = current.tagName.toLowerCase();
    path.unshift(`${tagName}:nth-child(${index + 1})`);

    current = parent;
  }

  return path.join(" > ");
}

/**
 * 高亮表格中的当前操作行与列
 * 
 * @param tableBlock - NodeTable 的块根元素，为 null 时清除所有高亮
 * @param coord - 当前单元格坐标，为 null 时清除所有高亮
 */
export function highlightActiveRowAndCol(
  tableBlock: HTMLElement | null,
  coord: CellCoord | null,
): void {
  // 1. 获取或创建动态高亮样式标签
  let styleEl = document.getElementById("at-dynamic-highlight-style") as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "at-dynamic-highlight-style";
    document.head.appendChild(styleEl);
  }

  // 2. 如果缺少要素，直接清除样式内容并返回
  if (!tableBlock || !coord) {
    styleEl.innerHTML = "";
    return;
  }

  const blockId = tableBlock.dataset.nodeId;
  if (!blockId) return;

  const table = tableBlock.querySelector("table");
  if (!table) return;

  const rows = table.querySelectorAll("tr");
  if (coord.row < 0 || coord.row >= rows.length) return;

  const activeRow = rows[coord.row] as HTMLElement;
  const cells = activeRow.querySelectorAll("td, th");
  if (coord.col < 0 || coord.col >= cells.length) return;
  const activeCell = cells[coord.col] as HTMLElement;

  // 3. 利用 DOM 树层级自动匹配生成唯一行选择器和交叉单元格选择器
  const rSelector = getUniqueCssSelector(activeRow, tableBlock);
  const cellSelector = getUniqueCssSelector(activeCell, tableBlock);
  const colIndex = coord.col + 1;

  // 行高亮样式：增加 [data-node-id] 限定大幅提高 CSS 特异性，防止被默认样式覆盖
  const rowCss = `[data-node-id="${blockId}"] ${rSelector} td, [data-node-id="${blockId}"] ${rSelector} th {
    background-color: color-mix(in srgb, var(--b3-theme-primary) 6%, transparent) !important;
  }`;

  // 列高亮样式
  const colCss = `[data-node-id="${blockId}"] td:nth-child(${colIndex}), [data-node-id="${blockId}"] th:nth-child(${colIndex}) {
    background-color: color-mix(in srgb, var(--b3-theme-primary) 6%, transparent) !important;
  }`;

  // 交叉活动单元格高亮样式：增加 [data-node-id] 限定大幅提高 CSS 特异性，防止被默认样式覆盖
  const cellCss = `[data-node-id="${blockId}"] ${cellSelector} {
    background-color: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent) !important;
    box-shadow: inset 0 0 0 2px var(--b3-theme-primary) !important;
  }`;

  // 4. 将生成的样式写入到 style 标签中
  styleEl.innerHTML = `
    ${rowCss}
    ${colCss}
    ${cellCss}
  `;
}

// ═══════════════════════════════════════════════════
// 共享工具函数
// ═══════════════════════════════════════════════════

/**
 * HTML 转义，防止 < > & " 破坏 DOM 结构
 * 从 text-to-table、confirm-dialog 等多处统一提取。
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 从表格块中获取单元格的 DOM 坐标 { row, col }。
 * 从 quick-calc.ts / drag-reorder.ts 统一提取。
 *
 * @param cell - 目标 td/th 元素
 * @param tableBlock - NodeTable 块根元素
 * @returns 坐标或 null（不在表格内）
 */
export function getCellCoordFromTable(
  cell: HTMLTableCellElement,
  tableBlock: HTMLElement,
): { row: number; col: number } | null {
  const table = tableBlock.querySelector("table");
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll("tr"));
  const tr = cell.parentElement as HTMLTableRowElement;
  if (!tr) return null;

  const rowIdx = rows.indexOf(tr);
  if (rowIdx === -1) return null;

  const cells = Array.from(tr.querySelectorAll("td, th"));
  const colIdx = cells.indexOf(cell);
  if (colIdx === -1) return null;

  return { row: rowIdx, col: colIdx };
}

