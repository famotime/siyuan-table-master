import { getActiveEditor, showMessage } from "siyuan";
import { isCursorInTable } from "./siyuan-text-editor";
import { TABLE_COMMANDS, executeCommand, TableCommand } from "./commands";
import type AdvancedTablesPlugin from "./index";
import { rangeToCellCoord, CellCoord, highlightActiveRowAndCol } from "./dom-utils";

/** SVG 图标定义 - Lucide 专业线框风格，显式内联阻断 fill 覆写，无填充 */
const SVG_ICONS: Record<string, string> = {
  "next-cell": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" style="fill:none!important"/><path d="m12 5 7 7-7 7" style="fill:none!important"/></svg>`,
  "previous-cell": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" style="fill:none!important"/><path d="m12 19-7-7 7-7" style="fill:none!important"/></svg>`,
  "next-row": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 10-5 5 5 5" style="fill:none!important"/><path d="M20 4.5V15a2 2 0 0 1-2 2H4" style="fill:none!important"/></svg>`,
  "format-table": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" style="fill:none!important"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5 5 3Z" style="fill:none!important"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" style="fill:none!important"/></svg>`,
  "insert-column": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="M16 12h4" style="fill:none!important"/><path d="M18 10v4" style="fill:none!important"/></svg>`,
  "insert-row": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="M12 16h4" style="fill:none!important"/><path d="M14 14v4" style="fill:none!important"/></svg>`,
  "delete-column": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="M14 12h4" style="fill:none!important"/></svg>`,
  "delete-row": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="M12 16h4" style="fill:none!important"/></svg>`,
  "move-column-left": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M14 3v18" style="fill:none!important"/><path d="m10 14-2-2 2-2" style="fill:none!important"/></svg>`,
  "move-column-right": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M10 3v18" style="fill:none!important"/><path d="m14 10 2 2-2 2" style="fill:none!important"/></svg>`,
  "move-row-up": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 14h18" style="fill:none!important"/><path d="m10 10 2-2 2 2" style="fill:none!important"/></svg>`,
  "move-row-down": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 10h18" style="fill:none!important"/><path d="m14 14-2 2-2-2" style="fill:none!important"/></svg>`,
  "left-align-column": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="15" x2="3" y1="12" y2="12" style="fill:none!important"/><line x1="17" x2="3" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "center-align-column": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="17" x2="7" y1="12" y2="12" style="fill:none!important"/><line x1="19" x2="5" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "right-align-column": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6" style="fill:none!important"/><line x1="21" x2="9" y1="12" y2="12" style="fill:none!important"/><line x1="21" x2="7" y1="18" y2="18" style="fill:none!important"/></svg>`,
  "sort-rows-asc": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" style="fill:none!important"/><path d="M7 20V4" style="fill:none!important"/><path d="M11 4h4" style="fill:none!important"/><path d="M11 8h7" style="fill:none!important"/><path d="M11 12h10" style="fill:none!important"/></svg>`,
  "sort-rows-desc": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" style="fill:none!important"/><path d="M7 20V4" style="fill:none!important"/><path d="M11 12h10" style="fill:none!important"/><path d="M11 8h7" style="fill:none!important"/><path d="M11 4h4" style="fill:none!important"/></svg>`,
  "transpose": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" style="fill:none!important"/><path d="M3 3v5h5" style="fill:none!important"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" style="fill:none!important"/><path d="M16 16h5v5" style="fill:none!important"/></svg>`,
  "evaluate-formulas": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" style="fill:none!important"/><line x1="8" x2="16" y1="6" y2="6" style="fill:none!important"/><line x1="16" x2="16" y1="14" y2="18" style="fill:none!important"/><path d="M16 10h.01" style="fill:none!important"/><path d="M12 10h.01" style="fill:none!important"/><path d="M8 10h.01" style="fill:none!important"/><path d="M12 14h.01" style="fill:none!important"/><path d="M8 14h.01" style="fill:none!important"/><path d="M12 18h.01" style="fill:none!important"/><path d="M8 18h.01" style="fill:none!important"/></svg>`,
  "escape-table": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" style="fill:none!important"/><polyline points="16 17 21 12 16 7" style="fill:none!important"/><line x1="21" y1="12" x2="9" y2="12" style="fill:none!important"/></svg>`
};

/** 命令功能分组描述 */
interface CommandGroup {
  title: string;
  commandIds: string[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: "格式与对齐",
    commandIds: ["format-table", "left-align-column", "center-align-column", "right-align-column"],
  },
  {
    title: "行列增删",
    commandIds: ["insert-row", "delete-row", "insert-column", "delete-column"],
  },
  {
    title: "行列移动",
    commandIds: ["move-row-up", "move-row-down", "move-column-left", "move-column-right"],
  },
  {
    title: "高级与导航",
    commandIds: ["sort-rows-asc", "sort-rows-desc", "transpose", "evaluate-formulas", "escape-table"],
  },
];

export function registerDock(plugin: AdvancedTablesPlugin) {
  let selectionListener: (() => void) | null = null;
  let statusCardEl: HTMLElement | null = null;
  let statusTextEl: HTMLElement | null = null;
  let statusDotEl: HTMLElement | null = null;
  let buttonGridContainer: HTMLElement | null = null;
  let tooltipBarEl: HTMLElement | null = null;

  // 缓存最近一次被编辑的表格状态及单元格坐标
  let lastActiveCell: { blockId: string; coord: CellCoord; tableBlock: HTMLElement } | null = null;

  const dockType = "advanced-tables-toolbox";
  const dockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18" style="fill:none!important"/><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 9h18" style="fill:none!important"/><path d="M3 15h18" style="fill:none!important"/></svg>`;

  plugin.addDock({
    config: {
      position: "RightFirst",
      size: { width: 240, height: 0 },
      icon: dockIcon,
      title: "高级表格工具箱",
    },
    data: {},
    type: dockType,
    init() {
      // 构建主容器 DOM
      this.element.innerHTML = `
        <div class="at-dock-panel fn__flex-1 fn__flex-column">
          <!-- 顶部状态卡片 -->
          <div class="at-status-card">
            <div class="at-status-header">
              <span class="at-status-title">高级表格状态</span>
              <span id="at-status-dot" class="at-status-dot"></span>
            </div>
            <div id="at-status-text" class="at-status-text">未检测到聚焦表格</div>
          </div>

          <!-- 按钮分组容器 -->
          <div id="at-button-container" class="at-button-container at-disabled">
            ${COMMAND_GROUPS.map(group => `
              <div class="at-group">
                <div class="at-group-title">${group.title}</div>
                <div class="at-btn-grid">
                  ${group.commandIds.map(cmdId => {
                    const cmd = TABLE_COMMANDS.find(c => c.id === cmdId);
                    if (!cmd) return "";
                    const iconSvg = SVG_ICONS[cmdId] || "";
                    return `
                      <button 
                        class="at-btn ariaLabel" 
                        data-cmd-id="${cmdId}" 
                        aria-label="${cmd.nameZh}"
                        title="${cmd.nameZh}"
                      >
                        <span class="at-btn-icon">${iconSvg}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>
            `).join("")}
          </div>

          <!-- 底部提示栏 -->
          <div class="at-footer-tooltip">
            <div id="at-tooltip-bar" class="at-tooltip-bar">提示：将光标移动至表格中开始编辑</div>
          </div>
        </div>
      `;

      // 绑定元素引用
      statusCardEl = this.element.querySelector(".at-status-card");
      statusTextEl = this.element.querySelector("#at-status-text");
      statusDotEl = this.element.querySelector("#at-status-dot");
      buttonGridContainer = this.element.querySelector("#at-button-container");
      tooltipBarEl = this.element.querySelector("#at-tooltip-bar");

      // 绑定按钮点击事件
      const buttons = this.element.querySelectorAll(".at-btn");
      buttons.forEach((btn: HTMLButtonElement) => {
        const cmdId = btn.getAttribute("data-cmd-id");
        const cmd = TABLE_COMMANDS.find(c => c.id === cmdId);
        
        if (cmd) {
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 获取预设上下文，如果有有效缓存直接使用并旁路 isCursorInTable 检测
            let preset = null;
            if (lastActiveCell) {
              preset = {
                tableBlock: lastActiveCell.tableBlock,
                blockId: lastActiveCell.blockId,
                coord: { ...lastActiveCell.coord },
              };
            }

            // 执行命令，传入预设上下文
            await executeCommand(cmd, plugin.settings, preset);

            // 操作后本地坐标动态演进推演（用于支持高频连续移动操作）
            if (lastActiveCell) {
              const coord = lastActiveCell.coord;
              if (cmd.id === "move-row-up") {
                coord.row = Math.max(0, coord.row - 1);
              } else if (cmd.id === "move-row-down") {
                coord.row = coord.row + 1;
              } else if (cmd.id === "move-column-left") {
                coord.col = Math.max(0, coord.col - 1);
              } else if (cmd.id === "move-column-right") {
                coord.col = coord.col + 1;
              }
              // 立即应用推演后的高亮，加速视觉跟随
              highlightActiveRowAndCol(lastActiveCell.tableBlock, coord);
            }
            
            // 不需要再做强同步 updateStatus()，交给 selectionchange 去平滑刷新
          });

          // Hover 状态显示详细介绍和英文名
          btn.addEventListener("mouseenter", () => {
            if (tooltipBarEl) {
              tooltipBarEl.innerText = `${cmd.nameZh} (${cmd.nameEn})`;
            }
          });

          btn.addEventListener("mouseleave", () => {
            if (tooltipBarEl) {
              // 恢复默认提示
              const activeEditor = getActiveEditor();
              if (activeEditor?.protyle) {
                const { inTable, tableBlock } = isCursorInTable(activeEditor);
                if (inTable && tableBlock) {
                  const size = getTableSize(tableBlock);
                  tooltipBarEl.innerText = `当前表格：${size.rows} 行 × ${size.cols} 列`;
                  return;
                }
              }
              if (lastActiveCell) {
                const size = getTableSize(lastActiveCell.tableBlock);
                tooltipBarEl.innerText = `当前表格：${size.rows} 行 × ${size.cols} 列`;
                return;
              }
              tooltipBarEl.innerText = "提示：将光标移动至表格中开始编辑";
            }
          });
        }
      });

      // 实时状态检测与缓存更新方法
      const updateStatus = () => {
        const activeEditor = getActiveEditor();
        if (!activeEditor?.protyle) {
          lastActiveCell = null;
          highlightActiveRowAndCol(null, null); // 失去编辑器焦点时清除高亮
          setUIState(false);
          return;
        }

        const { inTable, tableBlock } = isCursorInTable(activeEditor);
        if (inTable && tableBlock) {
          // 在表格内，保存并更新最新的光标坐标
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const coord = rangeToCellCoord(range, tableBlock);
            if (coord) {
              lastActiveCell = {
                blockId: tableBlock.dataset.nodeId || "",
                coord,
                tableBlock,
              };
              highlightActiveRowAndCol(tableBlock, coord); // 触发操作行列高亮
            }
          }
          const size = getTableSize(tableBlock);
          setUIState(true, size.rows, size.cols);
        } else {
          // 惰性失焦：如果光标暂时离开了表格（可能是由于点击了 Dock 按钮等）
          // 只要用户并没有把光标明确挪到表格外的其他 Block 块元素上，我们就继续保留面板的激活状态！
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let node = range.startContainer as HTMLElement;
            let otherBlock: HTMLElement | null = null;
            
            // 向上寻找当前选区聚焦的块元素
            while (node && node !== document.body) {
              if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-node-id")) {
                otherBlock = node;
                break;
              }
              node = node.parentNode as HTMLElement;
            }
            
            // 如果明确发现了其他非当前缓存表格的 Block，说明用户确实把光标移走了，此时才真正置灰并清空缓存
            if (otherBlock && (!lastActiveCell || otherBlock !== lastActiveCell.tableBlock)) {
              lastActiveCell = null;
              highlightActiveRowAndCol(null, null); // 确切跳出表格时清空高亮
              setUIState(false);
            }
          }
        }
      };

      // 改变 UI 状态
      const setUIState = (active: boolean, rows = 0, cols = 0) => {
        if (active) {
          if (statusCardEl) statusCardEl.classList.add("at-active");
          if (statusDotEl) {
            statusDotEl.style.backgroundColor = "var(--b3-theme-primary)";
            statusDotEl.classList.add("at-pulse");
          }
          if (statusTextEl) statusTextEl.innerText = `表格编辑中 (${rows} 行 × ${cols} 列)`;
          if (buttonGridContainer) buttonGridContainer.classList.remove("at-disabled");
          if (tooltipBarEl && tooltipBarEl.innerText.startsWith("提示：")) {
            tooltipBarEl.innerText = `当前表格：${rows} 行 × ${cols} 列`;
          }
        } else {
          if (statusCardEl) statusCardEl.classList.remove("at-active");
          if (statusDotEl) {
            statusDotEl.style.backgroundColor = "var(--b3-theme-error, #f44336)";
            statusDotEl.classList.remove("at-pulse");
          }
          if (statusTextEl) statusTextEl.innerText = "未检测到聚焦表格";
          if (buttonGridContainer) buttonGridContainer.classList.add("at-disabled");
          if (tooltipBarEl && !tooltipBarEl.innerText.startsWith("提示：")) {
            tooltipBarEl.innerText = "提示：将光标移动至表格中开始编辑";
          }
        }
      };

      // 监听系统 selectionchange 事件来秒级响应光标位置变化
      selectionListener = () => {
        // 使用 requestAnimationFrame 避免在选区高频变动时造成卡顿
        requestAnimationFrame(() => {
          updateStatus();
        });
      };
      document.addEventListener("selectionchange", selectionListener);

      // 初次加载时运行一次
      updateStatus();
    },
    destroy() {
      if (selectionListener) {
        document.removeEventListener("selectionchange", selectionListener);
        selectionListener = null;
      }
      highlightActiveRowAndCol(null, null); // 面板注销时彻底移除行列高亮类
    },
  });
}

/**
 * 辅助函数：计算 DOM 表格的大小
 */
function getTableSize(tableBlock: HTMLElement): { rows: number; cols: number } {
  try {
    const trs = tableBlock.querySelectorAll("tr");
    const rows = trs.length;
    let cols = 0;
    if (rows > 0) {
      // 统计首个 tr 下 td/th 数量作为列数
      cols = trs[0].querySelectorAll("th, td").length;
    }
    return { rows, cols };
  } catch (e) {
    console.warn("[siyuan-advanced-tables] getTableSize failed:", e);
    return { rows: 0, cols: 0 };
  }
}
