import { getActiveEditor } from "siyuan";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import { rangeToCellCoord, getCellFromRange, CellCoord, getTableColCount, getTableRowCount } from "./dom-utils";
import { TABLE_COMMANDS, executeCommand } from "./commands";
import { SVG_ICONS } from "./dock";
import { getTableClipboard, TableEditor } from "./table-editor";
import type TableMaterPlugin from "./index";
import { saveSettings } from "./settings";

export class FloatingToolbar {
  private plugin: TableMaterPlugin;
  private container: HTMLElement | null = null;
  private contextTag: HTMLElement | null = null;
  private buttonsWrapper: HTMLElement | null = null;
  private lastRowIdx: number | null = null;
  private activeCell: { blockId: string; coord: CellCoord; tableBlock: HTMLElement } | null = null;
  private selectionListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;
  private refreshListener: (() => void) | null = null;
  public isExecuting = false;
  private executeTimeoutId: any = null;
  private dropdownContainer: HTMLElement | null = null;
  private globalClickCloseListener: ((e: MouseEvent) => void) | null = null;

  constructor(plugin: TableMaterPlugin) {
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

    // 监听统一刷新 UI 事件以在光标异步恢复后定位
    this.refreshListener = () => {
      requestAnimationFrame(() => {
        this.update();
      });
    };
    document.addEventListener("siyuan-table-mater-refresh-ui", this.refreshListener);

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
    if (this.refreshListener) {
      document.removeEventListener("siyuan-table-mater-refresh-ui", this.refreshListener);
      this.refreshListener = null;
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
    this.closeDropdown();
  }

  private createContainer() {
    this.container = document.createElement("div");
    this.container.className = "at-floating-toolbar at-floating-hidden";
    this.container.setAttribute("role", "toolbar");
    this.container.setAttribute("aria-label", "Table Master Floating Toolbar");

    this.contextTag = document.createElement("div");
    this.contextTag.className = "at-floating-context";
    this.container.appendChild(this.contextTag);

    this.buttonsWrapper = document.createElement("div");
    this.buttonsWrapper.className = "at-floating-buttons";
    this.buttonsWrapper.setAttribute("role", "group");
    this.container.appendChild(this.buttonsWrapper);

    document.body.appendChild(this.container);
  }

  public update() {
    if (this.isExecuting) return;

    // 如果当前页面有活动的思源 Dialog，不显示浮动工具栏以防遮挡
    if (document.querySelector(".b3-dialog")) {
      this.hide();
      return;
    }

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

    // 拖选多个单元格计算时，不出现浮动工具栏
    if (tableBlock.querySelector(".at-selected-cell")) {
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

    const isContextChanged = this.lastRowIdx !== coord.row;
    this.lastRowIdx = coord.row;

    if (isContextChanged) {
      this.closeDropdown();
    }

    if (isContextChanged && !this.container.classList.contains("at-floating-hidden") && this.buttonsWrapper && this.contextTag) {
      // 触发切换过渡动画 (方案 B)
      this.contextTag.style.opacity = "0";
      this.buttonsWrapper.style.opacity = "0";
      this.buttonsWrapper.style.transform = "scale(0.98)";
      setTimeout(() => {
        if (!this.activeCell) return;
        this.renderContext(coord.row, coord.col);
        this.renderButtons(coord.row);
        this.reposition();
        if (this.contextTag && this.buttonsWrapper) {
          this.contextTag.style.opacity = "1";
          this.buttonsWrapper.style.opacity = "1";
          this.buttonsWrapper.style.transform = "scale(1)";
        }
      }, 120);
    } else {
      this.renderContext(coord.row, coord.col);
      this.renderButtons(coord.row);
      this.show();
      this.reposition();
    }
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

  private renderContext(row: number, col: number) {
    if (!this.contextTag) return;
    if (row === 0) {
      this.contextTag.innerText = this.plugin.i18n.toolbarHeader || "Header";
    } else {
      const template = this.plugin.i18n.toolbarRow || "Row ${row} Col ${col}";
      this.contextTag.innerText = template
        .replace("${row}", String(row))
        .replace("${col}", String(col + 1));
    }
  }

  private renderButtons(rowIdx: number) {
    if (!this.container) return;

    let cmdIds: string[] = [];
    if (rowIdx === 0) {
      // 光标在表头时，工具栏按钮：调整表格、左对齐、居中、右对齐、升序、降序、转置、粘性表头、图表化
      cmdIds = [
        "resize-table",
        "left-align-column",
        "center-align-column",
        "right-align-column",
        "sort-rows-asc",
        "sort-rows-desc",
        "transpose",
        "table-to-chart",
        "toggle-sticky-header",
      ];
    } else {
      // 光标在非表头行时，工具栏按钮：上移行、下移行，左移列、右移列、剪切行、剪切列
      cmdIds = [
        "move-row-up",
        "move-row-down",
        "move-column-left",
        "move-column-right",
        "cut-row",
        "cut-column",
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

    if (this.buttonsWrapper) {
      this.buttonsWrapper.innerHTML = "";
    }

    cmdIds.forEach((cmdId) => {
      if (cmdId === "resize-table") {
        const btn = document.createElement("button");
        btn.className = "at-floating-btn";
        btn.setAttribute("aria-label", this.plugin.i18n.resizeTable || "调整表格");
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 12h18" style="fill:none!important"/><path d="M12 3v18" style="fill:none!important"/></svg>`;

        const tooltipEl = document.createElement("div");
        tooltipEl.className = "at-custom-tooltip";
        tooltipEl.innerText = this.plugin.i18n.resizeTable || "调整表格";
        btn.appendChild(tooltipEl);

        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.dropdownContainer) {
            this.closeDropdown();
          } else {
            this.showDropdown(btn);
          }
        });

        this.buttonsWrapper?.appendChild(btn);
        return;
      }

      if (cmdId === "toggle-sticky-header") {
        const btn = document.createElement("button");
        const isSticky = this.plugin.enableStickyHeader;
        btn.className = "at-floating-btn" + (isSticky ? " at-active-toggle" : "");
        const labelText = isSticky ? (this.plugin.i18n.closeStickyHeader || "Disable Sticky Header") : (this.plugin.i18n.openStickyHeader || "Enable Sticky Header");
        btn.setAttribute("aria-label", labelText);
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="17" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.91a8 8 0 0 1-1.23-4.13V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2.96a8 8 0 0 1-1.23 4.13l-2.33 2.91a2 2 0 0 0-.44 1.24V17Z"></path></svg>`;

        const tooltipEl = document.createElement("div");
        tooltipEl.className = "at-custom-tooltip";
        tooltipEl.innerText = labelText;
        btn.appendChild(tooltipEl);

        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.plugin.enableStickyHeader = !this.plugin.enableStickyHeader;
          this.plugin.updateStickyHeaderClass();
          this.renderButtons(0);
        });

        this.buttonsWrapper?.appendChild(btn);
        return;
      }

      const cmd = TABLE_COMMANDS.find((c) => c.id === cmdId);
      if (!cmd) return;

      const btn = document.createElement("button");
      btn.className = "at-floating-btn";
      btn.setAttribute("aria-label", this.plugin.i18n[cmd.id] || cmd.nameZh);
      btn.innerHTML = SVG_ICONS[cmdId] || "";

      const tooltipEl = document.createElement("div");
      tooltipEl.className = "at-custom-tooltip";
      tooltipEl.innerText = this.plugin.i18n[cmd.id] || cmd.nameZh;
      btn.appendChild(tooltipEl);

      // mousedown 时阻止默认行为，防止编辑器失去焦点
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.isExecuting) return;

        if (cmd.id === "table-to-chart") {
          this.hide();
        }

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
          await executeCommand(cmd, this.plugin.settings, preset, this.plugin.i18n);

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

      this.buttonsWrapper?.appendChild(btn);
    });
  }

  private show() {
    if (this.container) {
      this.container.classList.remove("at-floating-hidden");
    }
  }

  private hide() {
    this.closeDropdown();
    if (this.container) {
      this.container.classList.add("at-floating-hidden");
      this.activeCell = null;
    }
  }

  private closeDropdown() {
    if (this.dropdownContainer) {
      this.dropdownContainer.remove();
      this.dropdownContainer = null;
    }
    if (this.globalClickCloseListener) {
      document.removeEventListener("click", this.globalClickCloseListener, true);
      this.globalClickCloseListener = null;
    }
  }

  private showDropdown(btn: HTMLElement) {
    this.closeDropdown();

    if (!this.activeCell) return;
    const tableBlock = this.activeCell.tableBlock;
    const currentCols = getTableColCount(tableBlock);
    const currentRows = getTableRowCount(tableBlock);

    // 计算网格尺寸：最少为 6x10，如果要超过现有表格则动态拓宽
    const gridCols = Math.max(6, currentCols + 1);
    const gridRows = Math.max(10, currentRows + 2);

    const dropdown = document.createElement("div");
    dropdown.className = "at-resize-dropdown";
    dropdown.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const gridContainer = document.createElement("div");
    gridContainer.className = "at-resize-grid";
    gridContainer.style.gridTemplateColumns = `repeat(${gridCols}, 16px)`;
    gridContainer.style.gridTemplateRows = `repeat(${gridRows}, 16px)`;

    const label = document.createElement("div");
    label.className = "at-resize-label";
    label.innerText = `${currentCols} x ${currentRows}`;

    const updateGridHighlight = (hoverCol: number, hoverRow: number) => {
      const targetCols = Math.max(currentCols, hoverCol);
      const targetRows = Math.max(currentRows, hoverRow);
      label.innerText = `${targetCols} x ${targetRows}`;

      const cells = gridContainer.querySelectorAll(".at-resize-grid-cell");
      cells.forEach((cell: any) => {
        const c = parseInt(cell.dataset.col || "0", 10);
        const r = parseInt(cell.dataset.row || "0", 10);

        cell.classList.remove("at-grid-cell-selected");
        cell.classList.remove("at-grid-cell-existing");

        if (c <= targetCols && r <= targetRows) {
          cell.classList.add("at-grid-cell-selected");
        } else if (c <= currentCols && r <= currentRows) {
          cell.classList.add("at-grid-cell-existing");
        }
      });
    };

    const resetGridHighlight = () => {
      label.innerText = `${currentCols} x ${currentRows}`;
      const cells = gridContainer.querySelectorAll(".at-resize-grid-cell");
      cells.forEach((cell: any) => {
        const c = parseInt(cell.dataset.col || "0", 10);
        const r = parseInt(cell.dataset.row || "0", 10);

        cell.classList.remove("at-grid-cell-selected");
        cell.classList.remove("at-grid-cell-existing");

        if (c <= currentCols && r <= currentRows) {
          cell.classList.add("at-grid-cell-existing");
        }
      });
    };

    for (let r = 1; r <= gridRows; r++) {
      for (let c = 1; c <= gridCols; c++) {
        const cell = document.createElement("div");
        cell.className = "at-resize-grid-cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        if (c <= currentCols && r <= currentRows) {
          cell.classList.add("at-grid-cell-existing");
        }

        cell.addEventListener("mouseenter", () => {
          updateGridHighlight(c, r);
        });

        cell.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const targetCols = Math.max(currentCols, c);
          const targetRows = Math.max(currentRows, r);

          if (targetCols > currentCols || targetRows > currentRows) {
            this.isExecuting = true;
            if (this.executeTimeoutId) clearTimeout(this.executeTimeoutId);

            const preset = {
              tableBlock: this.activeCell!.tableBlock,
              blockId: this.activeCell!.blockId,
              coord: { ...this.activeCell!.coord },
            };

            try {
              const activeEditor = getActiveEditor();
              if (activeEditor?.protyle) {
                const ctx = new SiyuanTextEditor({
                  protyle: activeEditor.protyle,
                  tableBlockEl: preset.tableBlock,
                  blockId: preset.blockId,
                  fixCJKWidth: this.plugin.settings.fixCJKWidth,
                  presetCellCoord: preset.coord,
                });
                const te = new TableEditor(ctx, this.plugin.settings, this.plugin.i18n);
                await te.resizeTable(targetCols, targetRows);
              }
            } finally {
              this.executeTimeoutId = setTimeout(() => {
                this.isExecuting = false;
                this.update();
              }, 350);
            }
          }

          this.closeDropdown();
        });

        gridContainer.appendChild(cell);
      }
    }

    gridContainer.addEventListener("mouseleave", () => {
      resetGridHighlight();
    });

    dropdown.appendChild(gridContainer);
    dropdown.appendChild(label);

    if (this.container) {
      this.container.appendChild(dropdown);
      this.dropdownContainer = dropdown;

      // 定位 dropdown
      const btnRect = btn.getBoundingClientRect();
      const toolbarRect = this.container.getBoundingClientRect();
      const leftOffset = btnRect.left - toolbarRect.left;
      dropdown.style.left = `${leftOffset}px`;
    }

    this.globalClickCloseListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (dropdown && !dropdown.contains(target) && !btn.contains(target)) {
        this.closeDropdown();
      }
    };
    document.addEventListener("click", this.globalClickCloseListener, true);
  }
}
