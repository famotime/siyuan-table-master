import { getActiveEditor } from "siyuan";
import { findTableBlock, getCellFromRange, getCellCoordFromTable } from "./dom-utils";
import { SiyuanTextEditor } from "./siyuan-text-editor";
import { splitTableRow } from "./table-model";
import type AdvancedTablesPlugin from "./index";

export class DragReorder {
  private plugin: AdvancedTablesPlugin;
  private rowHandle: HTMLElement | null = null;
  private colHandle: HTMLElement | null = null;
  private indicator: HTMLElement | null = null;

  // 拖拽状态
  private isDraggingRow = false;
  private isDraggingCol = false;
  private startMouseX = 0;
  private startMouseY = 0;
  private activeTableBlock: HTMLElement | null = null;
  private activeCellEl: HTMLTableCellElement | null = null;
  private fromIndex = -1;
  private targetIndex = -1;
  private cursorCoord: { row: number; col: number } | null = null;

  // 绑定事件处理器引用以方便卸载
  private selectionListener = this.onSelectionChange.bind(this);
  private scrollListener = this.onScroll.bind(this);
  private mouseMoveListener = this.onMouseMove.bind(this);
  private mouseUpListener = this.onMouseUp.bind(this);

  constructor(plugin: AdvancedTablesPlugin) {
    this.plugin = plugin;
  }

  init() {
    this.createHandles();

    // 监听选区和滚动以动态更新手柄位置
    document.addEventListener("selectionchange", this.selectionListener);
    document.addEventListener("scroll", this.scrollListener, true);
    window.addEventListener("resize", this.scrollListener);

    // 全局拖动事件监听
    document.addEventListener("mousemove", this.mouseMoveListener);
    document.addEventListener("mouseup", this.mouseUpListener);
  }

  destroy() {
    document.removeEventListener("selectionchange", this.selectionListener);
    document.removeEventListener("scroll", this.scrollListener, true);
    window.removeEventListener("resize", this.scrollListener);
    document.removeEventListener("mousemove", this.mouseMoveListener);
    document.removeEventListener("mouseup", this.mouseUpListener);

    this.removeHandles();
  }

  private createHandles() {
    // 1. 行拖拽手柄
    this.rowHandle = document.createElement("div");
    this.rowHandle.className = "at-drag-handle at-drag-handle-row fn__hidden";
    // 类似于六点拖拽手柄图标 ⋮⋮
    this.rowHandle.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6-10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
      </svg>
    `;
    this.rowHandle.addEventListener("mousedown", (e) => this.startDragRow(e));

    // 2. 列拖拽手柄
    this.colHandle = document.createElement("div");
    this.colHandle.className = "at-drag-handle at-drag-handle-col fn__hidden";
    // 类似于六点水平拖拽手柄图标
    this.colHandle.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" style="transform: rotate(90deg);">
        <path d="M5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6-10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
      </svg>
    `;
    this.colHandle.addEventListener("mousedown", (e) => this.startDragCol(e));

    // 3. 拖拽指示线
    this.indicator = document.createElement("div");
    this.indicator.className = "at-drag-indicator fn__hidden";

    document.body.appendChild(this.rowHandle);
    document.body.appendChild(this.colHandle);
    document.body.appendChild(this.indicator);
  }

  private removeHandles() {
    this.rowHandle?.remove();
    this.colHandle?.remove();
    this.indicator?.remove();
    this.rowHandle = null;
    this.colHandle = null;
    this.indicator = null;
  }

  private onSelectionChange() {
    requestAnimationFrame(() => {
      this.repositionHandles();
    });
  }

  private onScroll() {
    requestAnimationFrame(() => {
      this.repositionHandles();
    });
  }

  private repositionHandles() {
    if (!this.plugin.settings.enableDragReorder || this.isDraggingRow || this.isDraggingCol) {
      return;
    }

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) {
      this.hideHandles();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      this.hideHandles();
      return;
    }

    const range = sel.getRangeAt(0);
    const tableBlock = findTableBlock(range.startContainer);
    if (!tableBlock) {
      this.hideHandles();
      return;
    }

    const cellEl = getCellFromRange(range, tableBlock);
    if (!cellEl) {
      this.hideHandles();
      return;
    }

    this.activeTableBlock = tableBlock;
    this.activeCellEl = cellEl;

    const cellRect = cellEl.getBoundingClientRect();
    const tableRect = tableBlock.querySelector("table")!.getBoundingClientRect();

    // 1. 定位行拖拽手柄：靠着表格最左侧外部，与当前行单元格垂直居中
    if (this.rowHandle) {
      const left = tableRect.left - 24; // 靠着表格左边界
      const top = cellRect.top + (cellRect.height - 24) / 2;
      this.rowHandle.style.left = `${left}px`;
      this.rowHandle.style.top = `${top}px`;
      this.rowHandle.classList.remove("fn__hidden");
    }

    // 2. 定位列拖拽手柄：靠着最后一行当前列单元格底部边缘下方（避开上方浮动工具栏）
    if (this.colHandle) {
      const table = tableBlock.querySelector("table")!;
      const rows = table.querySelectorAll("tr");
      const currentTr = cellEl.parentElement as HTMLTableRowElement;
      const colIdx = Array.from(currentTr.querySelectorAll("td, th")).indexOf(cellEl);

      if (rows.length > 0 && colIdx !== -1) {
        const lastRow = rows[rows.length - 1];
        const lastRowCells = lastRow.querySelectorAll("td, th");
        const lastCellOfCol = lastRowCells[colIdx] as HTMLElement;
        if (lastCellOfCol) {
          const lastCellRect = lastCellOfCol.getBoundingClientRect();
          const left = lastCellRect.left + (lastCellRect.width - 24) / 2;
          const top = lastCellRect.bottom + 4; // 靠着最后一行底部分界线下方，完美避开最后一行内容重叠与上方浮动工具栏
          this.colHandle.style.left = `${left}px`;
          this.colHandle.style.top = `${top}px`;
          this.colHandle.classList.remove("fn__hidden");
        }
      }
    }
  }

  public hideHandles() {
    this.rowHandle?.classList.add("fn__hidden");
    this.colHandle?.classList.add("fn__hidden");
  }

  private startDragRow(e: MouseEvent) {
    if (!this.activeTableBlock || !this.activeCellEl) return;

    e.preventDefault();
    e.stopPropagation();

    const tr = this.activeCellEl.parentElement as HTMLTableRowElement;
    const table = this.activeTableBlock.querySelector("table")!;
    const rows = Array.from(table.querySelectorAll("tr"));
    const rowIndex = rows.indexOf(tr);
    if (rowIndex === -1) return;

    this.isDraggingRow = true;
    this.startMouseY = e.clientY;
    this.fromIndex = rowIndex;
    this.targetIndex = rowIndex;

    // 缓存拖拽前的光标坐标
    this.cursorCoord = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const cell = getCellFromRange(range, this.activeTableBlock);
      if (cell) {
        this.cursorCoord = getCellCoordFromTable(cell, this.activeTableBlock);
      }
    }

    // 显示指示线
    if (this.indicator) {
      const tableRect = table.getBoundingClientRect();
      const trRect = tr.getBoundingClientRect();

      this.indicator.className = "at-drag-indicator at-drag-indicator-horizontal";
      this.indicator.style.width = `${tableRect.width}px`;
      this.indicator.style.height = ""; // 清空拖拽列时遗留的 height 限制
      this.indicator.style.left = `${tableRect.left}px`;
      this.indicator.style.top = `${trRect.top}px`;
      this.indicator.classList.remove("fn__hidden");
    }
  }

  private startDragCol(e: MouseEvent) {
    if (!this.activeTableBlock || !this.activeCellEl) return;

    e.preventDefault();
    e.stopPropagation();

    const tr = this.activeCellEl.parentElement as HTMLTableRowElement;
    const cells = Array.from(tr.querySelectorAll("td, th"));
    const colIndex = cells.indexOf(this.activeCellEl);
    if (colIndex === -1) return;

    this.isDraggingCol = true;
    this.startMouseX = e.clientX;
    this.fromIndex = colIndex;
    this.targetIndex = colIndex;

    // 缓存拖拽前的光标坐标
    this.cursorCoord = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const cell = getCellFromRange(range, this.activeTableBlock);
      if (cell) {
        this.cursorCoord = getCellCoordFromTable(cell, this.activeTableBlock);
      }
    }

    // 显示指示线
    if (this.indicator) {
      const table = this.activeTableBlock.querySelector("table")!;
      const tableRect = table.getBoundingClientRect();
      const cellRect = this.activeCellEl.getBoundingClientRect();

      this.indicator.className = "at-drag-indicator at-drag-indicator-vertical";
      this.indicator.style.width = ""; // 清空拖拽行时遗留的 width 限制
      this.indicator.style.height = `${tableRect.height}px`;
      this.indicator.style.top = `${tableRect.top}px`;
      this.indicator.style.left = `${cellRect.left}px`;
      this.indicator.classList.remove("fn__hidden");
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isDraggingRow && this.activeTableBlock && this.indicator) {
      const table = this.activeTableBlock.querySelector("table")!;
      const rows = Array.from(table.querySelectorAll("tr"));
      const tableRect = table.getBoundingClientRect();

      // 寻当前鼠标 Y 坐标所处行界线
      let targetY = tableRect.top;
      let targetRowIdx = 0;
      let minDistance = Infinity;

      // 遍历所有可能的缝隙线：行 top 或是底部的 bottom
      rows.forEach((tr, index) => {
        const rect = tr.getBoundingClientRect();
        // 行上边界
        const topDist = Math.abs(e.clientY - rect.top);
        if (topDist < minDistance) {
          minDistance = topDist;
          targetY = rect.top;
          targetRowIdx = index;
        }
        // 行下边界
        const bottomDist = Math.abs(e.clientY - rect.bottom);
        if (bottomDist < minDistance) {
          minDistance = bottomDist;
          targetY = rect.bottom;
          targetRowIdx = index + 1;
        }
      });

      // 约束：如果把数据行插到表头行（行 0）上方，是不符合常理的，设为至少插在行 1 后面或最上也是行 1 缝
      if (this.fromIndex > 0 && targetRowIdx === 0) {
        targetRowIdx = 1;
        const rect1 = rows[0].getBoundingClientRect();
        targetY = rect1.bottom;
      }

      this.targetIndex = targetRowIdx;
      this.indicator.style.top = `${targetY}px`;
    }

    if (this.isDraggingCol && this.activeTableBlock && this.indicator) {
      const table = this.activeTableBlock.querySelector("table")!;
      const tableRect = table.getBoundingClientRect();
      const rows = table.querySelectorAll("tr");
      if (rows.length === 0) return;

      const cells = Array.from(rows[0].querySelectorAll("td, th"));
      let targetX = tableRect.left;
      let targetColIdx = 0;
      let minDistance = Infinity;

      cells.forEach((cell, index) => {
        const rect = cell.getBoundingClientRect();
        // 列左边界
        const leftDist = Math.abs(e.clientX - rect.left);
        if (leftDist < minDistance) {
          minDistance = leftDist;
          targetX = rect.left;
          targetColIdx = index;
        }
        // 列右边界
        const rightDist = Math.abs(e.clientX - rect.right);
        if (rightDist < minDistance) {
          minDistance = rightDist;
          targetX = rect.right;
          targetColIdx = index + 1;
        }
      });

      this.targetIndex = targetColIdx;
      this.indicator.style.left = `${targetX}px`;
    }
  }

  private async onMouseUp(_e: MouseEvent) {
    if (this.isDraggingRow) {
      this.isDraggingRow = false;
      this.indicator?.classList.add("fn__hidden");

      if (this.fromIndex !== -1 && this.targetIndex !== -1 && this.activeTableBlock) {
        // 计算行模型上的目标重排索引位置
        // DOM 行缝 toIndex 换算为 lines 模型插入位置。
        // 注意：lines 结构中，lines[0] 是 header, lines[1] 是分隔行, 数据行从 lines[2] 开始
        let fromLineIdx = this.fromIndex === 0 ? 0 : this.fromIndex + 1;
        let toLineIdx = this.targetIndex === 0 ? 0 : (this.targetIndex <= 1 ? 2 : this.targetIndex + 1);

        if (this.fromIndex > 0 && this.targetIndex > 0 && this.fromIndex !== this.targetIndex && this.fromIndex + 1 !== this.targetIndex) {
          // 由于 fromLineIdx 和 toLineIdx 是在同一个数组中移动，
          // 如果 toLineIdx 大于 fromLineIdx，将其插入后数组长度会变，插入位置需要向下偏移
          if (toLineIdx > fromLineIdx) {
            toLineIdx--;
          }

          // 2. 推演移动后的光标坐标
          let newCursorCoord = null;
          if (this.cursorCoord) {
            const finalDestRow = this.targetIndex > this.fromIndex ? this.targetIndex - 1 : this.targetIndex;
            let targetRow = this.cursorCoord.row;

            if (this.cursorCoord.row === this.fromIndex) {
              targetRow = finalDestRow;
            } else {
              if (this.fromIndex < finalDestRow) {
                if (this.cursorCoord.row > this.fromIndex && this.cursorCoord.row <= finalDestRow) {
                  targetRow = this.cursorCoord.row - 1;
                }
              } else if (this.fromIndex > finalDestRow) {
                if (this.cursorCoord.row >= finalDestRow && this.cursorCoord.row < this.fromIndex) {
                  targetRow = this.cursorCoord.row + 1;
                }
              }
            }
            newCursorCoord = { row: targetRow, col: this.cursorCoord.col };
          }
          await this.executeRowMove(fromLineIdx, toLineIdx, newCursorCoord);
        }
      }

      this.fromIndex = -1;
      this.targetIndex = -1;
      this.cursorCoord = null;
      this.repositionHandles();
    }

    if (this.isDraggingCol) {
      this.isDraggingCol = false;
      this.indicator?.classList.add("fn__hidden");

      if (this.fromIndex !== -1 && this.targetIndex !== -1 && this.fromIndex !== this.targetIndex && this.fromIndex + 1 !== this.targetIndex && this.activeTableBlock) {
        let toCol = this.targetIndex;
        if (toCol > this.fromIndex) {
          toCol--;
        }

        // 推演移动后的光标坐标
        let newCursorCoord = null;
        if (this.cursorCoord) {
          let targetCol = this.cursorCoord.col;
          if (this.cursorCoord.col === this.fromIndex) {
            targetCol = toCol;
          } else {
            if (this.fromIndex < toCol) {
              if (this.cursorCoord.col > this.fromIndex && this.cursorCoord.col <= toCol) {
                targetCol = this.cursorCoord.col - 1;
              }
            } else if (this.fromIndex > toCol) {
              if (this.cursorCoord.col >= toCol && this.cursorCoord.col < this.fromIndex) {
                targetCol = this.cursorCoord.col + 1;
              }
            }
          }
          newCursorCoord = { row: this.cursorCoord.row, col: targetCol };
        }

        await this.executeColMove(this.fromIndex, toCol, newCursorCoord);
      }

      this.fromIndex = -1;
      this.targetIndex = -1;
      this.cursorCoord = null;
      this.repositionHandles();
    }
  }

  /** 执行行重排写入 */
  private async executeRowMove(fromLineIdx: number, toLineIdx: number, presetCoord: { row: number; col: number } | null) {
    if (!this.activeTableBlock) return;
    const blockId = this.activeTableBlock.dataset.nodeId;
    if (!blockId) return;

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    try {
      const editorCtx = new SiyuanTextEditor({
        protyle: activeEditor.protyle,
        tableBlockEl: this.activeTableBlock,
        blockId,
        fixCJKWidth: this.plugin.settings.fixCJKWidth,
        presetCellCoord: presetCoord,
      });

      await editorCtx.reload();

      const lineCount = editorCtx.getLineCount();
      if (fromLineIdx < lineCount && toLineIdx < lineCount) {
        // 读取要移动的行，删除后插入到目标位置
        const movedLine = editorCtx.getLineAt(fromLineIdx)!;
        editorCtx.removeLine(fromLineIdx);
        editorCtx.insertLineAt(toLineIdx, movedLine);

        await editorCtx.flush();
      }
    } catch (err) {
      console.error("[siyuan-advanced-tables] row drag-reorder failed:", err);
    }
  }

  /** 执行列重排写入 */
  private async executeColMove(fromCol: number, toCol: number, presetCoord: { row: number; col: number } | null) {
    if (!this.activeTableBlock) return;
    const blockId = this.activeTableBlock.dataset.nodeId;
    if (!blockId) return;

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    try {
      const editorCtx = new SiyuanTextEditor({
        protyle: activeEditor.protyle,
        tableBlockEl: this.activeTableBlock,
        blockId,
        fixCJKWidth: this.plugin.settings.fixCJKWidth,
        presetCellCoord: presetCoord,
      });

      await editorCtx.reload();

      for (let i = 0; i < editorCtx.getLineCount(); i++) {
        const line = editorCtx.getLineAt(i) ?? "";
        if (line.trim().startsWith("{:")) continue; // 跳过 IAL

        const cells = splitTableRow(line);
        if (fromCol < cells.length && toCol <= cells.length) {
          // 移动单元格
          const [movedCell] = cells.splice(fromCol, 1);
          cells.splice(toCol, 0, movedCell);

          editorCtx.setLineAt(i, `| ${cells.join(" | ")} |`);
        }
      }

      editorCtx.markDirty();
      await editorCtx.flush();
    } catch (err) {
      console.error("[siyuan-advanced-tables] col drag-reorder failed:", err);
    }
  }
}
