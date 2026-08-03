import { getActiveEditor, showMessage } from "siyuan";
import { isCursorInTable } from "./siyuan-text-editor";
import { TABLE_COMMANDS, executeCommand, TableCommand } from "./commands";
import { rangeToCellCoord, CellCoord, findTableBlock, findHtmlTableBlock } from "./dom-utils";
import { saveSettings } from "./settings";
import { HTML_TABLE_COMMANDS, executeHtmlCommand } from "./html-commands";

/** SVG 图标定义 - Lucide 专业线框风格，显式内联阻断 fill 覆写，无填充 */
export const SVG_ICONS: Record<string, string> = {
  "next-cell": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" style="fill:none!important"/><path d="m12 5 7 7-7 7" style="fill:none!important"/></svg>`,
  "previous-cell": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" style="fill:none!important"/><path d="m12 19-7-7 7-7" style="fill:none!important"/></svg>`,
  "next-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 10-5 5 5 5" style="fill:none!important"/><path d="M20 4.5V15a2 2 0 0 1-2 2H4" style="fill:none!important"/></svg>`,
  "format-table": `<svg class="at-svg-fill" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="20" height="20"><path d="M24 33.5h152c-1.8 0-3.2-1.4-3.2-3.2v139.4c0-1.8 1.4-3.2 3.2-3.2H24c1.8 0 3.2 1.4 3.2 3.2V30.4c0 1.6-1.3 3.1-3.2 3.1zm-6.4 133.7c0 5.1 4.1 9.2 9.2 9.2h146.5c5.1 0 9.2-4.1 9.2-9.2V32.8c0-5.1-4.1-9.2-9.2-9.2H26.8c-5.1 0-9.2 4.1-9.2 9.2v134.4z" fill="currentColor"/><path d="M125.9 107.6v-8.8l-16.4 11 16.4 11V112zM153.3 87.9v25.7h-27.4v-7.4H146V87.9zM48.9 77h63.2v11H48.9zM48.9 105.3h48.6v11H48.9zM48.9 48.8h99.8v11H48.9zM48.9 133.6h99.8v11H48.9z" fill="currentColor"/></svg>`,
  "insert-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M9 3v18" style="fill:none!important"/><path d="M12 12h6" style="fill:none!important"/><path d="M15 9v6" style="fill:none!important"/></svg>`,
  "insert-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 9h18" style="fill:none!important"/><path d="M9 15h6" style="fill:none!important"/><path d="M12 12v6" style="fill:none!important"/></svg>`,
  "delete-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="M14 12h4" style="fill:none!important"/></svg>`,
  "delete-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="M12 16h4" style="fill:none!important"/></svg>`,
  "move-column-left": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M14 3v18" style="fill:none!important"/><path d="m10 14-2-2 2-2" style="fill:none!important"/></svg>`,
  "move-column-right": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="m14 10 2 2-2 2" style="fill:none!important"/></svg>`,
  "move-row-up": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 14h18" style="fill:none!important"/><path d="m10 10 2-2 2 2" style="fill:none!important"/></svg>`,
  "move-row-down": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="m14 14-2 2-2-2" style="fill:none!important"/></svg>`,
  "left-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="15" x2="3" y1="12" y2="12" style="fill:none!important"/><line x1="17" x2="3" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "center-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="17" x2="7" y1="12" y2="12" style="fill:none!important"/><line x1="19" x2="5" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "right-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="21" x2="9" y1="12" y2="12" style="fill:none!important"/><line x1="21" x2="7" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "sort-rows-asc": `<svg viewBox="0 0 48 48" width="20" height="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M23 9H43"/><path d="M5 16L13 8"/><path d="M13 8V42"/><path d="M23 19H39"/><path d="M23 29H35"/><path d="M23 39H31"/></svg>`,
  "sort-rows-desc": `<svg viewBox="0 0 48 48" width="20" height="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M23 8H43"/><path d="M14 41L6 33"/><path d="M14 7V41"/><path d="M23 18H39"/><path d="M23 28H35"/><path d="M23 38H31"/></svg>`,
  "transpose": `<svg class="at-svg-fill" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32"><path fill="currentColor" d="M19 26h-5v-2h5a5.006 5.006 0 0 0 5-5v-5h2v5a7.01 7.01 0 0 1-7 7M8 30H4a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2M4 14v14h4V14zm24-4H14a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M14 4v4h14V4z"/></svg>`,

  "cut-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" stroke-dasharray="3" style="fill:none!important"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" style="fill:none!important"/><line x1="9" x2="22" y1="13" y2="13" style="fill:none!important"/><line x1="9" x2="22" y1="17" y2="17" style="fill:none!important"/></svg>`,
  "cut-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" stroke-dasharray="3" style="fill:none!important"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" style="fill:none!important"/><line x1="13" x2="13" y1="9" y2="22" style="fill:none!important"/><line x1="17" x2="17" y1="9" y2="22" style="fill:none!important"/></svg>`,
  "paste-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" style="fill:none!important"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" style="fill:none!important"/><path d="M9 13h6" style="fill:none!important"/></svg>`,
  "paste-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" style="fill:none!important"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" style="fill:none!important"/><path d="M12 10v6" style="fill:none!important"/></svg>`,
  "row-sum": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H4v2.5l3.5 4.5-3.5 4.5V19h5" style="fill:none!important"/><path d="M12 12h8" style="fill:none!important"/><path d="M17 9l3 3-3 3" style="fill:none!important"/></svg>`,
  "column-sum": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H4v2.5l3.5 4.5-3.5 4.5V19h5" style="fill:none!important"/><path d="M16 5v14" style="fill:none!important"/><path d="M13 16l3 3 3-3" style="fill:none!important"/></svg>`,
  "split-all-cells": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" style="fill:none!important"/><path d="M12 3v18M3 12h18" style="fill:none!important"/><path d="m8 8 2 2m4 4 2 2m0-8-2 2m-4 4-2 2" style="fill:none!important"/></svg>`,
  "table-to-chart": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" style="fill:none!important"/><path d="m19 9-5 5-4-4-3 3" style="fill:none!important"/></svg>`,
  "fit-content-width": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16" style="fill:none!important"/><path d="m16 8 4 4-4 4" style="fill:none!important"/><path d="m8 8-4 4 4 4" style="fill:none!important"/></svg>`,
  "text-to-table": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 9h18" style="fill:none!important"/><path d="M3 15h18" style="fill:none!important"/><path d="M12 3v18" style="fill:none!important"/></svg>`,
  "export-csv": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" style="fill:none!important"/><polyline points="14 2 14 8 20 8" style="fill:none!important"/><path d="M8 13h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H8v-4z" style="fill:none!important"/><path d="M16 13h-2v4h2" style="fill:none!important"/></svg>`,
  "export-xlsx": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" style="fill:none!important"/><polyline points="14 2 14 8 20 8" style="fill:none!important"/><path d="M8 13l4 4" style="fill:none!important"/><path d="M12 13l-4 4" style="fill:none!important"/><path d="M16 13v4" style="fill:none!important"/></svg>`,
  "create-sample-md": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M7 16V8l5 5 5-5v8" style="fill:none!important"/></svg>`,
  "create-sample-html": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 9h18" style="fill:none!important"/><path d="M6 13v4M6 15h2.5M8.5 13v4M10.5 13h3M12 13v4M15.5 13v4h2.5" style="fill:none!important"/></svg>`,
  "html-open-dialog-editor": `<svg class="at-svg-fill" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="m21.7 13.35l-1 1l-2.05-2.05l1-1c.21-.22.56-.22.77 0l1.28 1.28c.22.21.22.56 0 .77M12 18.94l6.07-6.06l2.05 2.05L14.06 21H12zM4 2h14a2 2 0 0 1 2 2v4.17L16.17 12H12v4.17L10.17 18H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m0 4v4h6V6zm8 0v4h6V6zm-8 6v4h6v-4z"/></svg>`,
  "html-to-md": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" style="fill:none!important"/><path d="M7 15V9l3 3 3-3v6" style="fill:none!important"/><path d="M17 9v6" style="fill:none!important"/><path d="M15 12h4" style="fill:none!important"/></svg>`
};

// ═══════════════════════════════════════════════════
// 模块级工具函数
// ═══════════════════════════════════════════════════

/** Dock 状态缓存类型 */
interface ActiveCellState {
  blockId: string;
  coord: CellCoord;
  tableBlock: HTMLElement;
}

/** 命令功能分组描述 */
interface CommandGroup {
  title: string;
  commandIds: string[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  { title: "创建与导出", commandIds: ["create-sample-md", "create-sample-html", "empty-placeholder", "empty-placeholder", "text-to-table", "export-csv", "export-xlsx"] },
  { title: "格式与对齐", commandIds: ["left-align-column", "center-align-column", "right-align-column", "empty-placeholder", "format-table", "fit-content-width"] },
  { title: "行列操作", commandIds: [
    "insert-row", "delete-row", "insert-column", "delete-column",
    "move-row-up", "move-row-down", "move-column-left", "move-column-right",
    "cut-row", "cut-column", "paste-row", "paste-column"
  ] },
  { title: "高级操作", commandIds: ["sort-rows-asc", "sort-rows-desc", "transpose", "row-sum", "column-sum", "split-all-cells", "table-to-chart"] },
];

const HTML_COMMAND_GROUP = {
  title: "HTML 表格编辑",
  commandIds: ["html-open-dialog-editor", "html-to-md"]
};

/** 计算 DOM 表格的大小 */
function getTableSize(tableBlock: HTMLElement): { rows: number; cols: number } {
  try {
    const trs = tableBlock.querySelectorAll("tr");
    const rows = trs.length;
    let cols = 0;
    if (rows > 0) {
      cols = trs[0].querySelectorAll("th, td").length;
    }
    return { rows, cols };
  } catch (e) {
    return { rows: 0, cols: 0 };
  }
}

/** Dock 面板 UI 元素引用 */
interface DockUIElements {
  statusCardEl: HTMLElement | null;
  statusTextEl: HTMLElement | null;
  statusDotEl: HTMLElement | null;
  buttonGridContainer: HTMLElement | null;
  tooltipBarEl: HTMLElement | null;
}

/** 切换 Dock 面板的激活/非激活 UI 状态 */
function setDockUIState(
  plugin: TableMaterPlugin,
  elements: DockUIElements,
  dockElement: HTMLElement,
  active: boolean,
  rows = 0,
  cols = 0,
  isHtmlTable = false,
): void {
  const { statusCardEl, statusDotEl, statusTextEl, buttonGridContainer, tooltipBarEl } = elements;
  if (active) {
    statusCardEl?.classList.add("at-active");
    if (statusDotEl) {
      statusDotEl.style.backgroundColor = "var(--b3-theme-primary)";
      statusDotEl.classList.add("at-pulse");
    }
    if (statusTextEl) {
      const template = plugin.i18n.dockActive || "表格编辑中 (${rows} 行 × ${cols} 列)";
      statusTextEl.innerText = template
        .replace("${rows}", String(rows))
        .replace("${cols}", String(cols));
    }
    buttonGridContainer?.classList.remove("at-disabled");
    if (tooltipBarEl && (tooltipBarEl.innerText.startsWith("提示：") || tooltipBarEl.innerText.startsWith("Tip:"))) {
      const template = plugin.i18n.dockActive || "表格编辑中 (${rows} 行 × ${cols} 列)";
      tooltipBarEl.innerText = template
        .replace("${rows}", String(rows))
        .replace("${cols}", String(cols));
    }

    const buttons = buttonGridContainer?.querySelectorAll<HTMLButtonElement>(".at-btn");
    buttons?.forEach(btn => {
      const cmdId = btn.getAttribute("data-cmd-id");
      if (cmdId) {
        const isHtmlCmd = cmdId.startsWith("html-");
        const shouldEnable = isHtmlTable ? isHtmlCmd : !isHtmlCmd;
        if (shouldEnable) {
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.style.cursor = "pointer";
        } else {
          btn.disabled = true;
          btn.style.opacity = "0.3";
          btn.style.cursor = "not-allowed";
        }
      }
    });

  } else {
    statusCardEl?.classList.remove("at-active");
    if (statusDotEl) {
      statusDotEl.style.backgroundColor = "var(--b3-theme-error, #f44336)";
      statusDotEl.classList.remove("at-pulse");
    }
    if (statusTextEl) statusTextEl.innerText = plugin.i18n.noActiveTable || "未检测到聚焦表格";
    buttonGridContainer?.classList.add("at-disabled");
    if (tooltipBarEl && !(tooltipBarEl.innerText.startsWith("提示：") || tooltipBarEl.innerText.startsWith("Tip:"))) {
      tooltipBarEl.innerText = plugin.i18n.dockTipDefault || "提示：将光标移动至表格中开始编辑。按住 Alt + 鼠标拖选可多选计算。";
    }

    const buttons = buttonGridContainer?.querySelectorAll<HTMLButtonElement>(".at-btn");
    buttons?.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    });
  }
}

/**
 * 实时检测光标所在表格状态，更新 lastActiveCell 缓存和 UI。
 * 从 init() 闭包中提取为独立函数。
 */
function updateDockStatus(
  plugin: TableMaterPlugin,
  dockOperationActive: boolean,
  lastActiveCell: ActiveCellState | null,
  elements: DockUIElements,
  dockElement: HTMLElement,
  updateLastActiveCell: (cell: ActiveCellState | null) => void,
): void {
  // 如果 Dock 连续操作中，仅更新 Dock UI，不再重复调用高亮渲染
  if (dockOperationActive && lastActiveCell) {
    const size = getTableSize(lastActiveCell.tableBlock);
    const isHtmlTable = lastActiveCell.tableBlock?.dataset?.type === "NodeHTMLBlock";
    setDockUIState(plugin, elements, dockElement, true, size.rows, size.cols, isHtmlTable);
    return;
  }

  let inTable = false;
  let tableBlock: HTMLElement | null = null;

  // 1. 优先通过 Selection API 检测
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    tableBlock = findTableBlock(range.startContainer);
    if (!tableBlock) {
       const htmlTableInfo = findHtmlTableBlock(range.startContainer);
       if (htmlTableInfo) {
         tableBlock = htmlTableInfo.block;
       }
    }
    if (tableBlock) inTable = true;
  }

  // 2. 兜底：通过编辑器 API
  if (!inTable) {
    const activeEditor = getActiveEditor();
    if (activeEditor?.protyle) {
      const res = isCursorInTable(activeEditor);
      if (res.inTable && res.tableBlock) {
        inTable = true;
        tableBlock = res.tableBlock;
      }
    }
  }

  if (inTable && tableBlock) {
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const coord = rangeToCellCoord(range, tableBlock);
      if (coord) {
        updateLastActiveCell({
          blockId: tableBlock.dataset.nodeId || "",
          coord,
          tableBlock,
        });
      }
    }
    const size = getTableSize(tableBlock);
    const isHtmlTable = tableBlock?.dataset?.type === "NodeHTMLBlock";
    setDockUIState(plugin, elements, dockElement, true, size.rows, size.cols, isHtmlTable);
  } else {
    // 惰性失焦检测
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let node = range.startContainer as HTMLElement;
      let otherBlock: HTMLElement | null = null;
      while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-node-id")) {
          otherBlock = node;
          break;
        }
        node = node.parentNode as HTMLElement;
      }
      const otherBlockId = otherBlock ? (otherBlock.dataset.nodeId || "") : "";
      if (otherBlock && (!lastActiveCell || otherBlockId !== lastActiveCell.blockId)) {
        updateLastActiveCell(null);
        setDockUIState(plugin, elements, dockElement, false);
      }
    }
  }
}

// ═══════════════════════════════════════════════════
// 注册入口
// ═══════════════════════════════════════════════════

export function registerDock(plugin: TableMaterPlugin) {
  let selectionListener: (() => void) | null = null;

  // DOM 引用
  const elements: DockUIElements = {
    statusCardEl: null,
    statusTextEl: null,
    statusDotEl: null,
    buttonGridContainer: null,
    tooltipBarEl: null,
  };

  let lastActiveCell: ActiveCellState | null = null;
  let dockOperationActive = false;
  let dockOperationTimeoutId: any = null;

  const dockType = "table-mater-toolbox";
  const dockIcon = "iconAdvancedTables";

  plugin.addDock({
    config: {
      position: "RightFirst",
      size: { width: 240, height: 0 },
      icon: dockIcon,
      title: plugin.i18n.dockTitle || "表哥工具箱",
    },
    data: {},
    type: dockType,
    init() {
      this.element.innerHTML = `
        <div class="at-dock-panel fn__flex-1 fn__flex-column">
          <div class="at-dock-header">
            <img class="at-dock-logo" src="/plugins/${plugin.name}/icon.png?v=transparent" alt="Table Master Logo" />
            <div class="at-dock-intro">
              <div class="at-dock-title">表哥<span class="at-dock-subtitle">Table Master</span></div>
              <div class="at-dock-slogan">专治Markdown表格的各种不爽</div>
            </div>
          </div>

          <div class="at-quick-settings">
            <div class="at-quick-setting-item">
              <span class="at-setting-label">${plugin.i18n.quickShowFloatingToolbar || "显示浮动工具栏"}</span>
              <input id="at-toggle-floating-toolbar" type="checkbox" class="b3-switch fn__flex-center" />
            </div>
          </div>
          <div id="at-button-container" class="at-button-container at-disabled">
            ${[...COMMAND_GROUPS, HTML_COMMAND_GROUP].map(group => `
              <div class="at-group">
                <div class="at-group-title">${group.title}</div>
                <div class="at-btn-grid">
                  ${group.commandIds.map(cmdId => {
                    if (cmdId === "empty-placeholder") {
                      return `<div class="at-btn-item at-placeholder"></div>`;
                    }
                    const cmd = TABLE_COMMANDS.find(c => c.id === cmdId) || HTML_TABLE_COMMANDS.find(c => c.id === cmdId);
                    if (!cmd) return "";
                    let iconSvg = SVG_ICONS[cmdId];
                    if (!iconSvg && cmd.icon && SVG_ICONS[cmd.icon]) {
                       iconSvg = SVG_ICONS[cmd.icon];
                    }
                    if (!iconSvg) {
                       iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`;
                    }
                    return `<div class="at-btn-item"><button class="at-btn ariaLabel" data-cmd-id="${cmdId}" aria-label="${plugin.i18n[cmdId] || cmd.nameZh}"><span class="at-btn-icon">${iconSvg}</span></button><span class="at-btn-label">${plugin.i18n["kw-" + cmdId] || cmd.nameZh}</span></div>`;
                  }).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="at-status-card">
            <div class="at-status-header">
              <span class="at-status-title">${plugin.i18n.dockStatus || "高级表格状态"}</span>
              <span id="at-status-dot" class="at-status-dot"></span>
            </div>
            <div id="at-status-text" class="at-status-text">${plugin.i18n.noActiveTable || "未检测到聚焦表格"}</div>
          </div>
          <div class="at-shortcut-panel">
            <div class="at-shortcut-header">${plugin.i18n.shortcutTitle || "快捷键指南"}</div>
            
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutDragCalc || "拖选单元格计算"}</span>
              <span class="at-shortcut-keys"><kbd>Alt</kbd> + 拖选</span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutNextCell || "聚焦下一单元格"}</span>
              <span class="at-shortcut-keys"><kbd>Tab</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutNextRow || "折行至下一行"}</span>
              <span class="at-shortcut-keys"><kbd>Enter</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutAlignLeft || "水平居左对齐"}</span>
              <span class="at-shortcut-keys"><kbd>Alt</kbd> + <kbd>L</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutAlignCenter || "水平居中对齐"}</span>
              <span class="at-shortcut-keys"><kbd>Alt</kbd> + <kbd>C</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutAlignRight || "水平居右对齐"}</span>
              <span class="at-shortcut-keys"><kbd>Alt</kbd> + <kbd>R</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutMoveRowUp || "向上移动整行"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutMoveRowDown || "向下移动整行"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutMoveColLeft || "向左移动整列"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutMoveColRight || "向右移动整列"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutDeleteCol || "删除当前整列"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>-</kbd></span>
            </div>
            <div class="at-shortcut-item">
              <span class="at-shortcut-desc">${plugin.i18n.shortcutDeleteRow || "删除当前整行"}</span>
              <span class="at-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>-</kbd></span>
            </div>
          </div>
        </div>
      `;

      // 初始化 DOM 引用
      elements.statusCardEl = this.element.querySelector(".at-status-card") as HTMLElement;
      elements.statusTextEl = this.element.querySelector("#at-status-text") as HTMLElement;
      elements.statusDotEl = this.element.querySelector("#at-status-dot") as HTMLElement;
      elements.buttonGridContainer = this.element.querySelector("#at-button-container") as HTMLElement;
      elements.tooltipBarEl = this.element.querySelector("#at-tooltip-bar") as HTMLElement;

      // 初始化快捷设置开关状态及事件监听
      const toggleFloatingToolbarEl = this.element.querySelector("#at-toggle-floating-toolbar") as HTMLInputElement;
      if (toggleFloatingToolbarEl) {
        toggleFloatingToolbarEl.checked = plugin.settings.showFloatingToolbar;
        toggleFloatingToolbarEl.addEventListener("change", async (e) => {
          plugin.settings.showFloatingToolbar = (e.target as HTMLInputElement).checked;
          await saveSettings(plugin, plugin.settings);
          if (plugin.floatingToolbar) {
            plugin.floatingToolbar.update();
          }
        });
      }

      // 绑定按钮点击事件
      const buttons = this.element.querySelectorAll(".at-btn");
      buttons.forEach((btn: HTMLButtonElement) => {
        const cmdId = btn.getAttribute("data-cmd-id");
        
        let cmd = null;
        if (cmdId) {
          cmd = TABLE_COMMANDS.find(c => c.id === cmdId) || HTML_TABLE_COMMANDS.find(c => c.id === cmdId);
        }
        
        if (!cmd) return;

        // 让对应的 label 的点击也转发给 btn
        const label = btn.nextElementSibling as HTMLElement;
        if (label && label.classList.contains("at-btn-label")) {
          label.addEventListener("mousedown", (e) => {
            e.preventDefault();
            btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          });
          label.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          });
        }

        btn.addEventListener("mousedown", () => {
          const activeEditor = getActiveEditor();
          if (!activeEditor?.protyle) return;
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = sel.getRangeAt(0);
          let node: Node | null = range.startContainer;
          let capturedTableBlock: HTMLElement | null = null;
          while (node && node !== document.body) {
            if (node instanceof HTMLElement && node.dataset.type === "NodeTable" && node.dataset.nodeId) {
              capturedTableBlock = node;
              break;
            }
            node = node.parentNode;
          }
          if (!capturedTableBlock) return;
          const coord = rangeToCellCoord(range, capturedTableBlock);
          if (!coord) return;

          // 连续点击按钮时，如果正在对同一个表格执行 Dock 连续操作，不要用当前未渲染完毕的 DOM 选区覆盖掉已经精确推演出的缓存状态
          const blockId = capturedTableBlock.dataset.nodeId || "";
          if (lastActiveCell && lastActiveCell.blockId === blockId && dockOperationActive) {
            return;
          }

          lastActiveCell = { blockId, coord, tableBlock: capturedTableBlock };
        });

        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          dockOperationActive = true;
          if (dockOperationTimeoutId) clearTimeout(dockOperationTimeoutId);

          let preset = null;
          if (lastActiveCell) {
            preset = { tableBlock: lastActiveCell.tableBlock, blockId: lastActiveCell.blockId, coord: { ...lastActiveCell.coord } };
          }

          // 命令执行期间，阻断悬浮工具栏重绘并立即隐藏
          if (plugin.floatingToolbar) {
            plugin.floatingToolbar.isExecuting = true;
            plugin.floatingToolbar.hide();
          }

          try {
            if (cmd) {
              if (cmdId && cmdId.startsWith("html-")) {
                 await executeHtmlCommand(cmd, plugin, plugin.i18n);
              } else {
                 await executeCommand(cmd, plugin.settings, preset, plugin.i18n);
              }
            }
          } finally {
            if (plugin.floatingToolbar) {
              setTimeout(() => {
                if (plugin.floatingToolbar) {
                  plugin.floatingToolbar.isExecuting = false;
                  plugin.floatingToolbar.update();
                }
              }, 350);
            }
          }

          if (lastActiveCell) {
            const coord = lastActiveCell.coord;
            if (cmd.id === "move-row-up") coord.row = Math.max(0, coord.row - 1);
            else if (cmd.id === "move-row-down") coord.row = coord.row + 1;
            else if (cmd.id === "move-column-left") coord.col = Math.max(0, coord.col - 1);
            else if (cmd.id === "move-column-right") coord.col = coord.col + 1;

            const latestEl = document.querySelector(`[data-node-id="${lastActiveCell.blockId}"]`) as HTMLElement;
            if (latestEl) lastActiveCell.tableBlock = latestEl;

            setTimeout(() => {
              if (lastActiveCell) {
                const finalLatestEl = document.querySelector(`[data-node-id="${lastActiveCell.blockId}"]`) as HTMLElement;
                if (finalLatestEl) {
                  lastActiveCell.tableBlock = finalLatestEl;
                }
              }
            }, 50);

          }

          dockOperationTimeoutId = setTimeout(() => { dockOperationActive = false; }, 350);
        });

        btn.addEventListener("mouseenter", () => {
          if (elements.tooltipBarEl) {
            if (cmd) {
              const name = plugin.i18n[cmd.id] || cmd.nameZh;
              elements.tooltipBarEl.innerText = `${name} (${cmd.nameEn})`;
            }
          }
        });

        btn.addEventListener("mouseleave", () => {
          if (elements.tooltipBarEl) {
            const activeEditor = getActiveEditor();
            if (activeEditor?.protyle) {
              const { inTable, tableBlock } = isCursorInTable(activeEditor);
              if (inTable && tableBlock) {
                const size = getTableSize(tableBlock);
                const activeTemplate = plugin.i18n.dockActive || "当前表格：${rows} 行 × ${cols} 列";
                elements.tooltipBarEl.innerText = activeTemplate
                  .replace("${rows}", String(size.rows))
                  .replace("${cols}", String(size.cols));
                return;
              }
            }
            if (lastActiveCell) {
              const size = getTableSize(lastActiveCell.tableBlock);
              const activeTemplate = plugin.i18n.dockActive || "当前表格：${rows} 行 × ${cols} 列";
              elements.tooltipBarEl.innerText = activeTemplate
                .replace("${rows}", String(size.rows))
                .replace("${cols}", String(size.cols));
              return;
            }
            elements.tooltipBarEl.innerText = plugin.i18n.dockTipDefault || "提示：将光标移动至表格中开始编辑";
          }
        });
      });

      // 状态更新回调
      const refreshStatus = () => {
        requestAnimationFrame(() => {
          updateDockStatus(
            plugin,
            dockOperationActive,
            lastActiveCell,
            elements,
            this.element,
            (cell) => { lastActiveCell = cell; },
          );
        });
      };

      selectionListener = refreshStatus;
      document.addEventListener("selectionchange", selectionListener);
      refreshStatus();
    },
    destroy() {
      if (selectionListener) {
        document.removeEventListener("selectionchange", selectionListener);
        selectionListener = null;
      }
    },
  });
}
