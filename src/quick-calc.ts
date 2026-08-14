import { getActiveEditor } from "siyuan";
import { findTableBlock, getCellCoordFromTable } from "./dom-utils";
import type TableMaterPlugin from "./index";

export class QuickCalc {
  private plugin: TableMaterPlugin;
  private isMouseDown = false;
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

  /** 获取当前思源原生 tableControl 选中的单元格集合 */
  private getNativeSelectedCells(): { cells: HTMLTableCellElement[]; tableBlock: HTMLElement | null } | null {
    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return null;

    const tableControl = (activeEditor.protyle.wysiwyg as any)?.tableControl;
    if (tableControl?.selection && typeof tableControl.getSelectedCells === "function") {
      const cells = tableControl.getSelectedCells() as HTMLTableCellElement[];
      if (cells && cells.length > 0) {
        const tableBlock = (tableControl.selection.node as HTMLElement) || findTableBlock(cells[0]);
        return { cells, tableBlock };
      }
    }
    return null;
  }

  private onMouseDown(e: MouseEvent) {
    if (!this.plugin.settings.enableQuickCalc) return;

    // 1. 如果是右键点击 (e.button === 2)，绝对不执行任何清除或拦截，让思源原生表格控制器的 contextmenu 正常处理
    if (e.button === 2) {
      return;
    }

    // 2. 如果不是鼠标左键 (e.button === 0)，不启动新的拖拽选区
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;

    // 点击在菜单或计算条上不处理
    if (target.closest(".b3-menu") || target.closest(".at-quick-calc-bar")) {
      return;
    }

    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) {
      // 点击在表格外且非右键菜单/计算条，隐藏计算条
      if (this.calcBar) {
        this.clearSelection();
      }
      return;
    }

    const block = findTableBlock(cell);
    if (!block) return;

    const coord = getCellCoordFromTable(cell, block);
    if (!coord) return;

    this.isMouseDown = true;
    this.startCoord = coord;
    this.tableBlock = block;
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

    const isCrossCell = this.startCoord.row !== currentCoord.row || this.startCoord.col !== currentCoord.col;
    if (isCrossCell || e.altKey) {
      const minRow = Math.min(this.startCoord.row, currentCoord.row);
      const maxRow = Math.max(this.startCoord.row, currentCoord.row);
      const minCol = Math.min(this.startCoord.col, currentCoord.col);
      const maxCol = Math.max(this.startCoord.col, currentCoord.col);

      const table = block.querySelector("table");
      if (!table) return;

      const rows = Array.from(table.querySelectorAll("tr"));
      const selectedCells: HTMLTableCellElement[] = [];

      rows.forEach((tr, rIdx) => {
        if (rIdx >= minRow && rIdx <= maxRow) {
          const cells = Array.from(tr.querySelectorAll("td, th")) as HTMLTableCellElement[];
          cells.forEach((td, cIdx) => {
            if (cIdx >= minCol && cIdx <= maxCol) {
              selectedCells.push(td);
            }
          });
        }
      });

      if (selectedCells.length > 1) {
        this.updateStatsByCells(selectedCells, block, {
          minRow,
          maxRow,
          minCol,
          maxCol,
        });
      }
    }
  }

  private onMouseUp(_e: MouseEvent) {
    this.isMouseDown = false;
    this.startCoord = null;

    // 延时检测思源原生 tableControl 是否完成了多选
    setTimeout(() => {
      const native = this.getNativeSelectedCells();
      if (native && native.cells.length > 1) {
        this.tableBlock = native.tableBlock;
        this.updateStatsByCells(native.cells, native.tableBlock);
      } else if (!this.calcBar) {
        this.clearSelection();
      }
    }, 60);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.clearSelection();
      return;
    }

    // 如果当前有计算条，按下任意普通键（排除修饰键）均清除
    if (this.calcBar && !["Alt", "Control", "Shift", "Meta"].includes(e.key)) {
      this.clearSelection();
    }
  }

  private onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // 如果点击在思源右键菜单、计算条或思源原生表格控制手柄上，不清除多选
    if (target.closest(".b3-menu") || target.closest(".at-quick-calc-bar") || target.closest(".protyle-table-control")) {
      return;
    }

    const native = this.getNativeSelectedCells();
    if (!native || native.cells.length <= 1) {
      const cell = target.closest("td, th");
      if (!cell) {
        this.clearSelection();
      }
    }
  }

  /** 清除快捷计算状态 */
  private clearSelection() {
    this.isMouseDown = false;
    this.startCoord = null;
    this.tableBlock = null;
    this.hideCalcBar();
  }

  /** 根据单元格列表重新计算并刷新计算条数据 */
  private updateStatsByCells(
    selectedCells: HTMLTableCellElement[],
    tableBlock: HTMLElement | null,
    rangeCoords?: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ) {
    if (selectedCells.length === 0) {
      this.hideCalcBar();
      return;
    }

    let count = selectedCells.length;
    let numCount = 0;
    let sum = 0;
    let percentCount = 0;
    let commaCount = 0;

    let minRow = rangeCoords?.minRow ?? Infinity;
    let maxRow = rangeCoords?.maxRow ?? -Infinity;
    let minCol = rangeCoords?.minCol ?? Infinity;
    let maxCol = rangeCoords?.maxCol ?? -Infinity;

    selectedCells.forEach(cell => {
      if (!rangeCoords && tableBlock) {
        const coord = getCellCoordFromTable(cell, tableBlock);
        if (coord) {
          minRow = Math.min(minRow, coord.row);
          maxRow = Math.max(maxRow, coord.row);
          minCol = Math.min(minCol, coord.col);
          maxCol = Math.max(maxCol, coord.col);
        }
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

      const rangeStr = (minRow !== Infinity && minRow !== -Infinity && maxRow !== -Infinity) ? `R${minRow + 1}C${minCol + 1}:R${maxRow + 1}C${maxCol + 1}` : "-";

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

