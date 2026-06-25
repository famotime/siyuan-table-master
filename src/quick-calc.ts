import { getActiveEditor } from "siyuan";
import { findTableBlock, getCellCoordFromTable } from "./dom-utils";
import type TableMaterPlugin from "./index";

export class QuickCalc {
  private plugin: TableMaterPlugin;
  private isSelecting = false;
  private isMouseDown = false;
  private wasSelecting = false;
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

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;

    const block = findTableBlock(cell);
    if (!block) return;

    const coord = getCellCoordFromTable(cell, block);
    if (!coord) return;

    // 如果先前已经有了多选状态，且本次又在表格中按下，先清除上一次的多选
    if (this.tableBlock) {
      this.clearSelection();
    }

    this.isMouseDown = true;
    this.startCoord = coord;
    this.tableBlock = block;

    // 如果按住了 Alt 键，则直接启动框选，并拦截默认事件
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      this.isSelecting = true;
      this.clearSelectionHighLight(block);
      cell.classList.add("at-selected-cell");
      this.updateStats();
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isMouseDown || !this.startCoord || !this.tableBlock) return;

    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;

    const block = findTableBlock(cell);
    if (block !== this.tableBlock) return;

    const currentCoord = getCellCoordFromTable(cell, block);
    if (!currentCoord) return;

    // 尚未触发框选模式时，如果跨单元格拖拽，自动激活框选模式
    if (!this.isSelecting) {
      const isCrossCell = this.startCoord.row !== currentCoord.row || this.startCoord.col !== currentCoord.col;
      if (isCrossCell) {
        this.isSelecting = true;
        // 清除浏览器临时文本选区，防止蓝色底色选区干扰
        window.getSelection()?.removeAllRanges();
        this.clearSelectionHighLight(block);

        // 高亮起点单元格
        const table = block.querySelector("table");
        if (table) {
          const rows = Array.from(table.querySelectorAll("tr"));
          const startTr = rows[this.startCoord.row];
          if (startTr) {
            const startCells = Array.from(startTr.querySelectorAll("td, th"));
            const startCell = startCells[this.startCoord.col];
            if (startCell) {
              startCell.classList.add("at-selected-cell");
            }
          }
        }
      }
    }

    // 处于框选模式下，拦截默认事件并更新高亮矩形和即时计算条
    if (this.isSelecting) {
      e.preventDefault();
      e.stopPropagation();

      const minRow = Math.min(this.startCoord.row, currentCoord.row);
      const maxRow = Math.max(this.startCoord.row, currentCoord.row);
      const minCol = Math.min(this.startCoord.col, currentCoord.col);
      const maxCol = Math.max(this.startCoord.col, currentCoord.col);

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
  }

  private onMouseUp(e: MouseEvent) {
    this.wasSelecting = this.isSelecting;
    if (this.isSelecting) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.isMouseDown = false;
    this.isSelecting = false;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.clearSelection();
      return;
    }

    // 如果当前有多选计算状态，按下任意普通键（排除修饰键）均清除多选，以支持方向键或输入直接收起高亮
    if (this.tableBlock && !["Alt", "Control", "Shift", "Meta"].includes(e.key)) {
      this.clearSelection();
    }
  }

  private onDocClick(e: MouseEvent) {
    if (this.wasSelecting) {
      e.preventDefault();
      e.stopPropagation();
      this.wasSelecting = false;
      return;
    }

    // 用户点击了已选框外的其它任意区域（非高亮单元格），清除多选状态
    const target = e.target as HTMLElement;
    const cell = target.closest("td, th");
    if (!cell || !cell.classList.contains("at-selected-cell")) {
      this.clearSelection();
    }
  }

  /** 清除多选状态 */
  private clearSelection() {
    this.isMouseDown = false;
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
    let percentCount = 0;
    let commaCount = 0;

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
      
      const parsed = this.parseNumber(pureText);
      if (parsed !== null) {
        numCount++;
        sum += parsed.value;
        if (parsed.hasPercent) percentCount++;
        if (parsed.hasComma) commaCount++;
      }
    });

    const allPercent = numCount > 0 && percentCount === numCount;
    const anyComma = commaCount > 0;
    const average = numCount > 0 ? sum / numCount : 0;

    const sumStr = numCount > 0 ? this.formatResult(sum, allPercent, anyComma) : "-";
    const avgStr = numCount > 0 ? this.formatResult(average, allPercent, anyComma) : "-";

    this.showCalcBar(count, numCount, sumStr, avgStr);

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

      const rangeStr = minRow !== Infinity ? `R${minRow + 1}C${minCol + 1}:R${maxRow + 1}C${maxCol + 1}` : "-";

      dockStatusText.innerHTML = `
        <div class="at-dock-calc-title">${this.plugin.i18n.quickCalcSelected || "已选中多单元格"}</div>
        <div class="at-dock-calc-container">
          <div class="at-dock-calc-item">
            <span class="at-dock-calc-label">${this.plugin.i18n.quickCalcRange || "选区范围"}:</span>
            <span class="at-dock-calc-val">${rangeStr} (${count})</span>
          </div>
          <div class="at-dock-calc-item">
            <span class="at-dock-calc-label">${this.plugin.i18n.quickCalcCount || "数值个数"}:</span>
            <span class="at-dock-calc-val">${numCount}</span>
          </div>
          <div class="at-dock-calc-item">
            <span class="at-dock-calc-label">${this.plugin.i18n.quickCalcSum || "选区求和"}:</span>
            <span class="at-dock-calc-val">${sumStr}</span>
          </div>
          <div class="at-dock-calc-item">
            <span class="at-dock-calc-label">${this.plugin.i18n.quickCalcAverage || "平均数值"}:</span>
            <span class="at-dock-calc-val">${avgStr}</span>
          </div>
        </div>
      `;
    }
  }

  /** 创建或显示计算悬浮条 */
  private showCalcBar(count: number, numCount: number, sumStr: string, avgStr: string) {
    if (!this.calcBar) {
      this.calcBar = document.createElement("div");
      this.calcBar.className = "at-quick-calc-bar";
      document.body.appendChild(this.calcBar);
    }

    this.calcBar.innerHTML = `
      <div class="at-calc-item">
        <span class="at-calc-label">${this.plugin.i18n.quickCalcSelectedBar || "已选"}:</span>
        <span class="at-calc-val">${count}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">${this.plugin.i18n.quickCalcCount || "数值个数"}:</span>
        <span class="at-calc-val">${numCount}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">${this.plugin.i18n.quickCalcSumBar || "求和"}:</span>
        <span class="at-calc-val">${sumStr}</span>
      </div>
      <div class="at-calc-divider"></div>
      <div class="at-calc-item">
        <span class="at-calc-label">${this.plugin.i18n.quickCalcAverageBar || "平均值"}:</span>
        <span class="at-calc-val">${avgStr}</span>
      </div>
    `;

    this.calcBar.style.opacity = "1";
    this.calcBar.style.transform = "translateX(-50%) translateY(0)";
  }

  /** 隐藏并移除计算悬浮条 */
  private hideCalcBar() {
    if (this.calcBar) {
      const bar = this.calcBar;
      this.calcBar = null; // 立即置空，以防在动画期间重复调用
      bar.style.opacity = "0";
      bar.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(() => {
        bar.remove();
      }, 200);
    }
    // 隐藏/移除时，向系统分发 selectionchange 事件，迫使 Dock 状态面板自动更新以恢复常规的编辑信息
    document.dispatchEvent(new Event("selectionchange"));
  }

  private parseNumber(text: string): { value: number; hasPercent: boolean; hasComma: boolean } | null {
    let cleanText = text.trim();
    if (cleanText === "") return null;

    let hasPercent = false;
    if (cleanText.endsWith("%")) {
      hasPercent = true;
      cleanText = cleanText.slice(0, -1).trim();
    }

    let hasComma = false;
    if (cleanText.includes(",")) {
      hasComma = true;
      cleanText = cleanText.replace(/,/g, "");
    }

    const num = Number(cleanText);
    if (isNaN(num)) return null;

    return {
      value: hasPercent ? num / 100 : num,
      hasPercent,
      hasComma,
    };
  }

  private formatResult(value: number, allPercent: boolean, anyComma: boolean): string {
    if (allPercent) {
      const valPercent = Number((value * 100).toFixed(4));
      if (anyComma) {
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(valPercent) + "%";
      }
      return valPercent.toString() + "%";
    }

    if (anyComma) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
    }

    return Number(value.toFixed(4)).toString();
  }
}
