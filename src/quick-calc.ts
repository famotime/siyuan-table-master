import { getActiveEditor } from "siyuan";
import { findTableBlock, getCellCoordFromTable } from "./dom-utils";
import type TableMaterPlugin from "./index";

export class QuickCalc {
  private plugin: TableMaterPlugin;
  private isSelecting = false;
  private startCoord: { row: number; col: number } | null = null;
  private tableBlock: HTMLElement | null = null;
  private calcBar: HTMLElement | null = null;

  // 绑定事件处理器引用以方便卸载
  private onMouseDownRef = this.onMouseDown.bind(this);
  private onMouseMoveRef = this.onMouseMove.bind(this);
  private onMouseUpRef = this.onMouseUp.bind(this);
  private onKeyDownRef = this.onKeyDown.bind(this);
  private onDocClickRef = this.onDocClick.bind(this);

  constructor(plugin: TableMaterPlugin) {
    this.plugin = plugin;
  }

  init() {
    // 监听全局鼠标事件以实现跨单元格框选
    document.addEventListener("mousedown", this.onMouseDownRef, true);
    document.addEventListener("mousemove", this.onMouseMoveRef, true);
    document.addEventListener("mouseup", this.onMouseUpRef, true);
    document.addEventListener("keydown", this.onKeyDownRef, true);
    document.addEventListener("click", this.onDocClickRef, true);
  }

  destroy() {
    document.removeEventListener("mousedown", this.onMouseDownRef, true);
    document.removeEventListener("mousemove", this.onMouseMoveRef, true);
    document.removeEventListener("mouseup", this.onMouseUpRef, true);
    document.removeEventListener("keydown", this.onKeyDownRef, true);
    document.removeEventListener("click", this.onDocClickRef, true);
    this.clearSelection();
  }

  private onMouseDown(e: MouseEvent) {
    if (!this.plugin.settings.enableQuickCalc) return;

    // 只有按住 Alt 键时才触发框选多选计算
    if (!e.altKey) return;

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;

    const block = findTableBlock(cell);
    if (!block) return;

    const coord = getCellCoordFromTable(cell, block);
    if (!coord) return;

    e.preventDefault();
    e.stopPropagation();

    this.isSelecting = true;
    this.startCoord = coord;
    this.tableBlock = block;

    // 清除上一次的高亮
    this.clearSelectionHighLight(block);
    
    // 高亮起点单元格
    cell.classList.add("at-selected-cell");

    this.updateStats();
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isSelecting || !this.startCoord || !this.tableBlock) return;

    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;

    // 确保拖拽在同一个表格内
    const block = findTableBlock(cell);
    if (block !== this.tableBlock) return;

    const currentCoord = getCellCoordFromTable(cell, block);
    if (!currentCoord) return;

    e.preventDefault();
    e.stopPropagation();

    // 计算框选的矩形范围
    const minRow = Math.min(this.startCoord.row, currentCoord.row);
    const maxRow = Math.max(this.startCoord.row, currentCoord.row);
    const minCol = Math.min(this.startCoord.col, currentCoord.col);
    const maxCol = Math.max(this.startCoord.col, currentCoord.col);

    // 遍历表格的所有单元格，更新高亮
    const table = block.querySelector("table");
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll("td, th"));
      cells.forEach((td, cIdx) => {
        if (rIdx >= minRow && rIdx <= maxRow && cIdx >= minCol && cIdx <= maxCol) {
          td.classList.add("at-selected-cell");
        } else {
          td.classList.remove("at-selected-cell");
        }
      });
    });

    this.updateStats();
  }

  private onMouseUp(_e: MouseEvent) {
    if (this.isSelecting) {
      this.isSelecting = false;
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.clearSelection();
    }
  }

  private onDocClick(e: MouseEvent) {
    // 用户点击了表格外部，或没有按 Alt 且不是点击在高亮单元格上，清除多选
    const target = e.target as HTMLElement;
    const cell = target.closest("td, th");
    if (!cell || !cell.classList.contains("at-selected-cell")) {
      if (!e.altKey) {
        this.clearSelection();
      }
    }
  }

  /** 清除多选状态 */
  private clearSelection() {
    this.isSelecting = false;
    this.startCoord = null;
    if (this.tableBlock) {
      this.clearSelectionHighLight(this.tableBlock);
      this.tableBlock = null;
    }
    this.hideCalcBar();
  }

  /** 清除表格内所有单元格的框选高亮 */
  private clearSelectionHighLight(block: HTMLElement) {
    const cells = block.querySelectorAll("td.at-selected-cell, th.at-selected-cell");
    cells.forEach(c => c.classList.remove("at-selected-cell"));
  }

  /** 重新计算并刷新计算条数据 */
  private updateStats() {
    if (!this.tableBlock) return;

    const selectedCells = Array.from(this.tableBlock.querySelectorAll("td.at-selected-cell, th.at-selected-cell"));
    if (selectedCells.length === 0) {
      this.hideCalcBar();
      return;
    }

    let count = selectedCells.length;
    let numCount = 0;
    let sum = 0;

    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;

    selectedCells.forEach(cell => {
      const coord = getCellCoordFromTable(cell as HTMLTableCellElement, this.tableBlock!);
      if (coord) {
        minRow = Math.min(minRow, coord.row);
        maxRow = Math.max(maxRow, coord.row);
        minCol = Math.min(minCol, coord.col);
        maxCol = Math.max(maxCol, coord.col);
      }

      const text = cell.textContent ?? "";
      // 去除 IAL {: colspan="1"} 后提取
      const pureText = text.replace(/\{:[^}]+\}/g, "").trim();
      if (pureText === "") return;

      const num = Number(pureText);
      if (!isNaN(num)) {
        numCount++;
        sum += num;
      }
    });

    const average = numCount > 0 ? Number((sum / numCount).toFixed(4)) : 0;

    this.showCalcBar(count, numCount, sum, average);

    // 联动同步更新右侧 Dock 栏状态卡片内容
    const dockStatusText = document.querySelector("#at-status-text") as HTMLElement;
    const dockStatusCard = document.querySelector(".at-status-card") as HTMLElement;
    if (dockStatusText && dockStatusCard) {
      dockStatusCard.classList.add("at-active");
      const statusDot = document.querySelector("#at-status-dot") as HTMLElement;
      if (statusDot) {
        statusDot.style.backgroundColor = "var(--b3-theme-primary)";
        statusDot.classList.add("at-pulse");
      }

      const sumStr = numCount > 0 ? sum.toString() : "-";
      const avgStr = numCount > 0 ? average.toString() : "-";
      const rangeStr = minRow !== Infinity ? `R${minRow + 1}C${minCol + 1}:R${maxRow + 1}C${maxCol + 1}` : "-";

      dockStatusText.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px; color: var(--b3-theme-primary);">已选中多单元格</div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85;">
          <div>选区范围: <span style="font-weight:600;">${rangeStr}</span> (${count}个)</div>
          <div>数值个数: <span style="font-weight:600;">${numCount}</span></div>
          <div>选区求和: <span style="font-weight:600; color:var(--b3-theme-primary);">${sumStr}</span></div>
          <div>平均数值: <span style="font-weight:600; color:var(--b3-theme-primary);">${avgStr}</span></div>
        </div>
      `;
    }
  }

  /** 创建或显示计算悬浮条 */
  private showCalcBar(count: number, numCount: number, sum: number, average: number) {
    if (!this.calcBar) {
      this.calcBar = document.createElement("div");
      this.calcBar.className = "at-quick-calc-bar";
      document.body.appendChild(this.calcBar);
    }

    // 格式化输出
    const sumStr = numCount > 0 ? sum.toString() : "-";
    const avgStr = numCount > 0 ? average.toString() : "-";

    this.calcBar.innerHTML = `
      <div class="at-calc-item">
        <span class="at-calc-label">已选:</span>
        <span class="at-calc-val">${count}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">数值个数:</span>
        <span class="at-calc-val">${numCount}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">求和:</span>
        <span class="at-calc-val">${sumStr}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">平均值:</span>
        <span class="at-calc-val">${avgStr}</span>
      </div>
    `;

    this.calcBar.style.opacity = "1";
    this.calcBar.style.transform = "translateX(-50%) translateY(0)";
  }

  /** 隐藏并移除计算悬浮条 */
  private hideCalcBar() {
    if (this.calcBar) {
      this.calcBar.remove();
      this.calcBar = null;
    }
    // 隐藏/移除时，向系统分发 selectionchange 事件，迫使 Dock 状态面板自动更新以恢复常规的编辑信息
    document.dispatchEvent(new Event("selectionchange"));
  }
}
