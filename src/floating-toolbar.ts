import { getActiveEditor } from "siyuan";
import { isCursorInTable } from "./siyuan-text-editor";
import { rangeToCellCoord, getCellFromRange, CellCoord, getTableColCount, getTableRowCount } from "./dom-utils";
import { TABLE_COMMANDS, executeCommand } from "./commands";
import { SVG_ICONS } from "./dock";
import { getTableClipboard } from "./table-editor";
import type AdvancedTablesPlugin from "./index";

export class FloatingToolbar {
  private plugin: AdvancedTablesPlugin;
  private container: HTMLElement | null = null;
  private activeCell: { blockId: string; coord: CellCoord; tableBlock: HTMLElement } | null = null;
  private selectionListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;
  private isExecuting = false;
  private executeTimeoutId: any = null;

  constructor(plugin: AdvancedTablesPlugin) {
    this.plugin = plugin;
  }

  init() {
    this.createContainer();

    // 监听 selectionchange 事件以跟随光标位置变化
    this.selectionListener = () => {
      requestAnimationFrame(() => {
        this.update();
      });
    };
    document.addEventListener("selectionchange", this.selectionListener);

    // 监听 scroll 与 resize 事件以在视口变化时重新定位工具栏
    this.scrollListener = () => {
      requestAnimationFrame(() => {
        this.reposition();
      });
    };
    document.addEventListener("scroll", this.scrollListener, true);
    window.addEventListener("resize", this.scrollListener);
  }

  destroy() {
    if (this.selectionListener) {
      document.removeEventListener("selectionchange", this.selectionListener);
      this.selectionListener = null;
    }
    if (this.scrollListener) {
      document.removeEventListener("scroll", this.scrollListener, true);
      window.removeEventListener("resize", this.scrollListener);
      this.scrollListener = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.executeTimeoutId) {
      clearTimeout(this.executeTimeoutId);
    }
  }

  private createContainer() {
    this.container = document.createElement("div");
    this.container.className = "at-floating-toolbar at-floating-hidden";
    document.body.appendChild(this.container);
  }

  public update() {
    if (this.isExecuting) return;

    if (!this.plugin.settings.showFloatingToolbar) {
      this.hide();
      return;
    }

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) {
      this.hide();
      return;
    }

    const { inTable, tableBlock } = isCursorInTable(activeEditor);
    if (!inTable || !tableBlock) {
      this.hide();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    const coord = rangeToCellCoord(range, tableBlock);
    if (!coord) {
      this.hide();
      return;
    }

    // 记录并更新当前活动单元格的上下文
    this.activeCell = {
      blockId: tableBlock.dataset.nodeId || "",
      coord,
      tableBlock,
    };

    this.renderButtons(coord.row);
    this.show();
    this.reposition();
  }

  private reposition() {
    if (!this.container || this.container.classList.contains("at-floating-hidden") || !this.activeCell) {
      return;
    }

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) {
      this.hide();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    // 获取活动单元格 DOM
    const cellEl = getCellFromRange(range, this.activeCell.tableBlock);
    if (!cellEl) {
      this.hide();
      return;
    }

    const cellRect = cellEl.getBoundingClientRect();
    const toolbarRect = this.container.getBoundingClientRect();

    // 1. 计算 X 轴：居中对齐，并做视口边缘保护（左右至少留 8px）
    let left = cellRect.left + (cellRect.width - toolbarRect.width) / 2;
    const viewportWidth = window.innerWidth;
    if (left < 8) left = 8;
    if (left + toolbarRect.width > viewportWidth - 8) {
      left = viewportWidth - toolbarRect.width - 8;
    }

    // 2. 计算 Y 轴：默认处于单元格正上方，若上方空间不够则移至正下方
    let top = cellRect.top - toolbarRect.height - 8;
    if (top < 8) {
      top = cellRect.bottom + 8;
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  private renderButtons(rowIdx: number) {
    if (!this.container) return;

    let cmdIds: string[] = [];
    if (rowIdx === 0) {
      // 光标在表头时，工具栏按钮：左对齐、居中、右对齐、升序、降序、转置
      cmdIds = [
        "left-align-column",
        "center-align-column",
        "right-align-column",
        "sort-rows-asc",
        "sort-rows-desc",
        "transpose",
      ];
    } else {
      // 光标在非表头行时，工具栏按钮：上移行、下移行，左移列、右移列、复制行、复制列
      cmdIds = [
        "move-row-up",
        "move-row-down",
        "move-column-left",
        "move-column-right",
        "copy-row",
        "copy-column",
      ];
      // 如果已有复制行列内容，增加对应按钮：粘贴行、粘贴列
      const clipboard = getTableClipboard();
      if (clipboard) {
        if (clipboard.type === "row") {
          cmdIds.push("paste-row");
        } else if (clipboard.type === "column") {
          cmdIds.push("paste-column");
        }
      }

      // 额外的求和判断
      if (this.activeCell) {
        const colCount = getTableColCount(this.activeCell.tableBlock);
        const rowCount = getTableRowCount(this.activeCell.tableBlock);
        const { col, row } = this.activeCell.coord;

        // 光标在非表头行且在最右侧列时，浮动工具栏增加“行求和”按钮
        if (col === colCount - 1) {
          cmdIds.push("row-sum");
        }
        // 光标在非表头行且在最下一行时，浮动工具栏增加“列求和”按钮
        if (row === rowCount - 1) {
          cmdIds.push("column-sum");
        }
      }
    }

    this.container.innerHTML = "";

    cmdIds.forEach((cmdId) => {
      const cmd = TABLE_COMMANDS.find((c) => c.id === cmdId);
      if (!cmd) return;

      const btn = document.createElement("button");
      btn.className = "at-floating-btn ariaLabel";
      btn.setAttribute("aria-label", cmd.nameZh);
      btn.innerHTML = SVG_ICONS[cmdId] || "";

      // mousedown 时阻止默认行为，防止编辑器失去焦点
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.isExecuting) return;

        this.isExecuting = true;
        if (this.executeTimeoutId) clearTimeout(this.executeTimeoutId);

        // 使用缓存的单元格上下文，确保表格在短时间内快速刷新重绘时，不发生节点脱轨
        let preset = null;
        if (this.activeCell) {
          const latestEl = document.querySelector(`[data-node-id="${this.activeCell.blockId}"]`) as HTMLElement;
          if (latestEl) {
            this.activeCell.tableBlock = latestEl;
          }
          preset = {
            tableBlock: this.activeCell.tableBlock,
            blockId: this.activeCell.blockId,
            coord: { ...this.activeCell.coord },
          };
        }

        try {
          await executeCommand(cmd, this.plugin.settings, preset);

          // 手动推演操作坐标，支持高频连续行/列移动时视觉高亮/定位的即时跟随
          if (this.activeCell) {
            const coord = this.activeCell.coord;
            if (cmd.id === "move-row-up") {
              coord.row = Math.max(0, coord.row - 1);
            } else if (cmd.id === "move-row-down") {
              coord.row = coord.row + 1;
            } else if (cmd.id === "move-column-left") {
              coord.col = Math.max(0, coord.col - 1);
            } else if (cmd.id === "move-column-right") {
              coord.col = coord.col + 1;
            }
          }
        } finally {
          // 锁定 350ms 防抖更新，允许思源及 DOM 选区归位，随后主动获取最新位置进行重绘同步
          this.executeTimeoutId = setTimeout(() => {
            this.isExecuting = false;
            this.update();
          }, 350);
        }
      });

      this.container!.appendChild(btn);
    });
  }

  private show() {
    if (this.container) {
      this.container.classList.remove("at-floating-hidden");
    }
  }

  private hide() {
    if (this.container) {
      this.container.classList.add("at-floating-hidden");
      this.activeCell = null;
    }
  }
}
