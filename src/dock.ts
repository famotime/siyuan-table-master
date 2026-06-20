import { getActiveEditor, showMessage } from "siyuan";
import { isCursorInTable } from "./siyuan-text-editor";
import { TABLE_COMMANDS, executeCommand, TableCommand } from "./commands";
import type TableMaterPlugin from "./index";
import { rangeToCellCoord, CellCoord, findTableBlock } from "./dom-utils";

/** SVG 图标定义 - Lucide 专业线框风格，显式内联阻断 fill 覆写，无填充 */
export const SVG_ICONS: Record<string, string> = {
  "next-cell": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" style="fill:none!important"/><path d="m12 5 7 7-7 7" style="fill:none!important"/></svg>`,
  "previous-cell": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" style="fill:none!important"/><path d="m12 19-7-7 7-7" style="fill:none!important"/></svg>`,
  "next-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 10-5 5 5 5" style="fill:none!important"/><path d="M20 4.5V15a2 2 0 0 1-2 2H4" style="fill:none!important"/></svg>`,
  "format-table": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" style="fill:none!important"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5 5 3Z" style="fill:none!important"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" style="fill:none!important"/></svg>`,
  "insert-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="M16 12h4" style="fill:none!important"/><path d="M18 10v4" style="fill:none!important"/></svg>`,
  "insert-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="M12 16h4" style="fill:none!important"/><path d="M14 14v4" style="fill:none!important"/></svg>`,
  "delete-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="M14 12h4" style="fill:none!important"/></svg>`,
  "delete-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="M12 16h4" style="fill:none!important"/></svg>`,
  "move-column-left": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M14 3v18" style="fill:none!important"/><path d="m10 14-2-2 2-2" style="fill:none!important"/></svg>`,
  "move-column-right": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="m14 10 2 2-2 2" style="fill:none!important"/></svg>`,
  "move-row-up": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 14h18" style="fill:none!important"/><path d="m10 10 2-2 2 2" style="fill:none!important"/></svg>`,
  "move-row-down": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="m14 14-2 2-2-2" style="fill:none!important"/></svg>`,
  "left-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="15" x2="3" y1="12" y2="12" style="fill:none!important"/><line x1="17" x2="3" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "center-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="17" x2="7" y1="12" y2="12" style="fill:none!important"/><line x1="19" x2="5" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "right-align-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="21" x2="9" y1="12" y2="12" style="fill:none!important"/><line x1="21" x2="7" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "sort-rows-asc": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" style="fill:none!important"/><path d="M7 20V4" style="fill:none!important"/><path d="M11 4h4" style="fill:none!important"/><path d="M11 8h7" style="fill:none!important"/><path d="M11 12h10" style="fill:none!important"/></svg>`,
  "sort-rows-desc": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" style="fill:none!important"/><path d="M7 20V4" style="fill:none!important"/><path d="M11 12h10" style="fill:none!important"/><path d="M11 8h7" style="fill:none!important"/><path d="M11 4h4" style="fill:none!important"/></svg>`,
  "transpose": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" style="fill:none!important"/><path d="M3 3v5h5" style="fill:none!important"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" style="fill:none!important"/><path d="M16 16h5v5" style="fill:none!important"/></svg>`,
  "evaluate-formulas": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" style="fill:none!important"/><line x1="8" x2="16" y1="6" y2="6" style="fill:none!important"/><line x1="16" x2="16" y1="14" y2="18" style="fill:none!important"/><path d="M16 10h.01" style="fill:none!important"/><path d="M12 10h.01" style="fill:none!important"/><path d="M8 10h.01" style="fill:none!important"/><path d="M12 14h.01" style="fill:none!important"/><path d="M8 14h.01" style="fill:none!important"/><path d="M12 18h.01" style="fill:none!important"/><path d="M8 18h.01" style="fill:none!important"/></svg>`,
  "escape-table": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" style="fill:none!important"/><polyline points="16 17 21 12 16 7" style="fill:none!important"/><line x1="21" y1="12" x2="9" y2="12" style="fill:none!important"/></svg>`,
  "copy-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" style="fill:none!important"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" style="fill:none!important"/><line x1="9" x2="22" y1="13" y2="13" style="fill:none!important"/><line x1="9" x2="22" y1="17" y2="17" style="fill:none!important"/></svg>`,
  "copy-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" style="fill:none!important"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" style="fill:none!important"/><line x1="13" x2="13" y1="9" y2="22" style="fill:none!important"/><line x1="17" x2="17" y1="9" y2="22" style="fill:none!important"/></svg>`,
  "paste-row": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" style="fill:none!important"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" style="fill:none!important"/><line x1="8" x2="16" y1="12" y2="12" style="fill:none!important"/><path d="m9 15 3 3 3-3" style="fill:none!important"/></svg>`,
  "paste-column": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" style="fill:none!important"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" style="fill:none!important"/><line x1="12" x2="12" y1="10" y2="18" style="fill:none!important"/><path d="m15 15-3 3-3-3" style="fill:none!important"/></svg>`,
  "row-sum": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H6v4l4 4-4 4v4h10" style="fill:none!important"/><path d="M6 12h12" style="fill:none!important"/><path d="m14 8 4 4-4 4" style="fill:none!important"/></svg>`,
  "column-sum": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H6v4l4 4-4 4v4h10" style="fill:none!important"/><path d="M12 6v12" style="fill:none!important"/><path d="m8 14 4 4 4-4" style="fill:none!important"/></svg>`,
  "table-to-chart": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" style="fill:none!important"/><path d="m19 9-5 5-4-4-3 3" style="fill:none!important"/></svg>`
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
  { title: "格式与对齐", commandIds: ["format-table", "left-align-column", "center-align-column", "right-align-column"] },
  { title: "行列增删", commandIds: ["insert-row", "delete-row", "insert-column", "delete-column"] },
  { title: "行列移动", commandIds: ["move-row-up", "move-row-down", "move-column-left", "move-column-right"] },
  { title: "高级与导航", commandIds: ["sort-rows-asc", "sort-rows-desc", "transpose", "evaluate-formulas", "escape-table"] },
  { title: "复制与粘贴", commandIds: ["copy-row", "copy-column", "paste-row", "paste-column"] },
  { title: "求和与图表", commandIds: ["row-sum", "column-sum", "table-to-chart"] },
];

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
    console.warn("[siyuan-table-mater] getTableSize failed:", e);
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
  elements: DockUIElements,
  dockElement: HTMLElement,
  active: boolean,
  rows = 0,
  cols = 0,
): void {
  const { statusCardEl, statusDotEl, statusTextEl, buttonGridContainer, tooltipBarEl } = elements;
  const textToTableBtn = dockElement.querySelector("#at-dock-text-to-table-btn") as HTMLElement;

  if (active) {
    statusCardEl?.classList.add("at-active");
    if (statusDotEl) {
      statusDotEl.style.backgroundColor = "var(--b3-theme-primary)";
      statusDotEl.classList.add("at-pulse");
    }
    if (statusTextEl) statusTextEl.innerText = `表格编辑中 (${rows} 行 × ${cols} 列)`;
    buttonGridContainer?.classList.remove("at-disabled");
    if (tooltipBarEl && tooltipBarEl.innerText.startsWith("提示：")) {
      tooltipBarEl.innerText = `当前表格：${rows} 行 × ${cols} 列`;
    }
    if (textToTableBtn) textToTableBtn.style.display = "none";
  } else {
    statusCardEl?.classList.remove("at-active");
    if (statusDotEl) {
      statusDotEl.style.backgroundColor = "var(--b3-theme-error, #f44336)";
      statusDotEl.classList.remove("at-pulse");
    }
    if (statusTextEl) statusTextEl.innerText = "未检测到聚焦表格";
    buttonGridContainer?.classList.add("at-disabled");
    if (tooltipBarEl && !tooltipBarEl.innerText.startsWith("提示：")) {
      tooltipBarEl.innerText = "提示：将光标移动至表格中开始编辑";
    }
    if (textToTableBtn) textToTableBtn.style.display = "flex";
  }
}

/**
 * 实时检测光标所在表格状态，更新 lastActiveCell 缓存和 UI。
 * 从 init() 闭包中提取为独立函数。
 */
function updateDockStatus(
  dockOperationActive: boolean,
  lastActiveCell: ActiveCellState | null,
  elements: DockUIElements,
  dockElement: HTMLElement,
  updateLastActiveCell: (cell: ActiveCellState | null) => void,
): void {
  // 如果 Dock 连续操作中，仅更新 Dock UI，不再重复调用高亮渲染
  if (dockOperationActive && lastActiveCell) {
    const size = getTableSize(lastActiveCell.tableBlock);
    setDockUIState(elements, dockElement, true, size.rows, size.cols);
    return;
  }

  let inTable = false;
  let tableBlock: HTMLElement | null = null;

  // 1. 优先通过 Selection API 检测
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    tableBlock = findTableBlock(range.startContainer);
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
    setDockUIState(elements, dockElement, true, size.rows, size.cols);
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
        setDockUIState(elements, dockElement, false);
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
      title: "表哥工具箱",
    },
    data: {},
    type: dockType,
    init() {
      this.element.innerHTML = `
        <div class="at-dock-panel fn__flex-1 fn__flex-column">
          <div class="at-status-card">
            <div class="at-status-header">
              <span class="at-status-title">高级表格状态</span>
              <span id="at-status-dot" class="at-status-dot"></span>
            </div>
            <div id="at-status-text" class="at-status-text">未检测到聚焦表格</div>
            <button id="at-dock-text-to-table-btn" class="b3-button b3-button--text fn__flex-center" style="width: 100%; margin-top: 10px; display: none; gap: 6px; justify-content: center; align-items: center; height: 32px; border: 1px solid var(--b3-theme-primary); color: var(--b3-theme-primary); background: transparent;">
              <span style="display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
                  <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                  <path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M12 3v18"></path>
                </svg>
              </span>
              将文本转换为表格
            </button>
          </div>
          <div id="at-button-container" class="at-button-container at-disabled">
            ${COMMAND_GROUPS.map(group => `
              <div class="at-group">
                <div class="at-group-title">${group.title}</div>
                <div class="at-btn-grid">
                  ${group.commandIds.map(cmdId => {
                    const cmd = TABLE_COMMANDS.find(c => c.id === cmdId);
                    if (!cmd) return "";
                    const iconSvg = SVG_ICONS[cmdId] || "";
                    return `<button class="at-btn ariaLabel" data-cmd-id="${cmdId}" aria-label="${cmd.nameZh}"><span class="at-btn-icon">${iconSvg}</span></button>`;
                  }).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="at-footer-tooltip">
            <div id="at-tooltip-bar" class="at-tooltip-bar">提示：将光标移动至表格中开始编辑</div>
          </div>
        </div>
      `;

      // 初始化 DOM 引用
      elements.statusCardEl = this.element.querySelector(".at-status-card") as HTMLElement;
      elements.statusTextEl = this.element.querySelector("#at-status-text") as HTMLElement;
      elements.statusDotEl = this.element.querySelector("#at-status-dot") as HTMLElement;
      elements.buttonGridContainer = this.element.querySelector("#at-button-container") as HTMLElement;
      elements.tooltipBarEl = this.element.querySelector("#at-tooltip-bar") as HTMLElement;

      // 绑定"将文本转换为表格"按钮
      const textToTableBtn = this.element.querySelector("#at-dock-text-to-table-btn") as HTMLElement;
      if (textToTableBtn) {
        textToTableBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const cmd = TABLE_COMMANDS.find(c => c.id === "text-to-table");
          if (cmd) await executeCommand(cmd, plugin.settings);
        });
      }

      // 绑定按钮点击事件
      const buttons = this.element.querySelectorAll(".at-btn");
      buttons.forEach((btn: HTMLButtonElement) => {
        const cmdId = btn.getAttribute("data-cmd-id");
        const cmd = TABLE_COMMANDS.find(c => c.id === cmdId);
        if (!cmd) return;

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
          lastActiveCell = { blockId: capturedTableBlock.dataset.nodeId || "", coord, tableBlock: capturedTableBlock };
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
            await executeCommand(cmd, plugin.settings, preset);
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

            dockOperationTimeoutId = setTimeout(() => { dockOperationActive = false; }, 350);
          }
        });

        btn.addEventListener("mouseenter", () => {
          if (elements.tooltipBarEl) {
            elements.tooltipBarEl.innerText = `${cmd.nameZh} (${cmd.nameEn})`;
          }
        });

        btn.addEventListener("mouseleave", () => {
          if (elements.tooltipBarEl) {
            const activeEditor = getActiveEditor();
            if (activeEditor?.protyle) {
              const { inTable, tableBlock } = isCursorInTable(activeEditor);
              if (inTable && tableBlock) {
                const size = getTableSize(tableBlock);
                elements.tooltipBarEl.innerText = `当前表格：${size.rows} 行 × ${size.cols} 列`;
                return;
              }
            }
            if (lastActiveCell) {
              const size = getTableSize(lastActiveCell.tableBlock);
              elements.tooltipBarEl.innerText = `当前表格：${size.rows} 行 × ${size.cols} 列`;
              return;
            }
            elements.tooltipBarEl.innerText = "提示：将光标移动至表格中开始编辑";
          }
        });
      });

      // 状态更新回调
      const refreshStatus = () => {
        requestAnimationFrame(() => {
          updateDockStatus(
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
