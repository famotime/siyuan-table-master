/**
 * SiyuanTextEditor.ts - 思源 Protyle 编辑器适配器
 * 
 * 实现 @tgrosinger/md-advanced-tables 的 ITextEditor 接口。
 * 这是本插件最核心的文件。
 * 
 * 设计策略（内存行模型 + 异步预读/统一 flush）：
 * 1. 构造时通过 getBlockKramdown 预读表格文本到内存行模型
 * 2. 核心库的所有 getLine/replaceLines 操作直接操作内存
 * 3. transact 结束时统一 flush：行模型 → markdown → updateTransactionElement
 * 4. 异步性被吸收在 reload/flush 中，核心库代码无需改动
 * 
 * 注意：核心库的 ITextEditor 接口方法是同步的，而思源 API 是异步的。
 * 我们通过"预读到内存"策略解决：在每次操作前先 reload，操作全在内存进行。
 */

import type { Protyle } from "siyuan";
import { fetchSyncPost } from "siyuan";
import {
  Point,
  Range,
  ITextEditor,
} from "@tgrosinger/md-advanced-tables";
import {
  CellCoord,
  findTableBlock,
  rangeToCellCoord,
  cellCoordToRange,
  getTableRowCount,
} from "./dom-utils";
import {
  parseTableKramdown,
  serializeTableKramdown,
  domCoordToRowModelIndex,
  getPipePosition,
  fixCJKSeparatorWidth,
} from "./table-model";

/** 适配器构造选项 */
export interface SiyuanTextEditorOptions {
  /** Protyle 编辑器实例 */
  protyle: Protyle;
  /** NodeTable 块的 DOM 根元素 */
  tableBlockEl: HTMLElement;
  /** 表格块 ID */
  blockId: string;
  /** 是否启用 CJK 分隔行宽度校正 */
  fixCJKWidth?: boolean;
  /** 预设单元格坐标，防止点击 Dock 按钮后选区丢失 */
  presetCellCoord?: CellCoord | null;
}

export class SiyuanTextEditor implements ITextEditor {
  private protyle: Protyle;
  private tableBlockEl: HTMLElement;
  private blockId: string;
  private fixCJKWidth: boolean;
  private presetCellCoord: CellCoord | null;

  // ── 内存行模型 ──
  private _lines: string[] = [];
  private _ialLine: string | null = null;
  private _cursor: Point = new Point(0, 0);
  private _dirty = false;

  // ── DOM 坐标缓存（用于光标恢复） ──
  private _initialCellCoord: CellCoord | null = null;

  constructor(options: SiyuanTextEditorOptions) {
    this.protyle = options.protyle;
    this.tableBlockEl = options.tableBlockEl;
    this.blockId = options.blockId;
    this.fixCJKWidth = options.fixCJKWidth ?? true;
    this.presetCellCoord = options.presetCellCoord ?? null;
  }

  /**
   * 预读表格 kramdown 到内存行模型
   * 必须在核心库操作前调用
   */
  async reload(): Promise<void> {
    try {
      const res = await fetchSyncPost("/api/block/getBlockKramdown", {
        id: this.blockId,
      });

      // 提取 kramdown，默认空字符串
      let kramdown: any = "";
      if (res && res.code === 0 && res.data) {
        if (typeof res.data === "string") {
          kramdown = res.data;
        } else if (typeof res.data === "object" && res.data !== null) {
          kramdown = (res.data as any).kramdown;
        }
      }

      // 终极防线：无论是什么非法类型（undefined、null、object 等），强行转换为 string 兜底，并打印详细 warn
      if (typeof kramdown !== "string") {
        console.warn(
          "[siyuan-advanced-tables] Non-string kramdown detected in reload, type:",
          typeof kramdown,
          "val:",
          kramdown,
          "response:",
          res
        );
        kramdown = String(kramdown ?? "");
      }

      const parsed = parseTableKramdown(kramdown);

      this._lines = [...parsed.tableLines];
      this._ialLine = parsed.ialLine;
      this._dirty = false;

      // 从 DOM 读取当前光标位置并映射到行模型坐标
      this._syncCursorFromDOM();
    } catch (err) {
      console.error("[siyuan-advanced-tables] reload failed:", err);
    }
  }

  /**
   * 将内存行模型 flush 回思源编辑器
   * 必须在核心库操作后调用
   */
  async flush(): Promise<void> {
    if (!this._dirty) return;

    try {
      // CJK 分隔行宽度校正
      const finalLines = this.fixCJKWidth
        ? fixCJKSeparatorWidth(this._lines)
        : this._lines;

      // 重新组合为 kramdown
      const newKramdown = serializeTableKramdown(finalLines, this._ialLine);

      // 通过 updateTransactionElement 更新块 DOM
      const oldHTML = this.tableBlockEl.outerHTML;
      // 使用内核 API 以 markdown 数据类型更新块
      // 这比直接操作 DOM 更可靠，且支持 undo
      await fetchSyncPost("/api/block/updateBlock", {
        id: this.blockId,
        dataType: "markdown",
        data: newKramdown,
      });

      this._dirty = false;

      // 恢复光标位置
      this._restoreCursor();
    } catch (err) {
      console.error("[siyuan-advanced-tables] flush failed:", err);
    }
  }

  // ── ITextEditor 实现（同步，操作内存） ──

  getCursorPosition(): Point {
    return this._cursor;
  }

  setCursorPosition(pos: Point): void {
    this._cursor = pos;
  }

  setSelectionRange(range: Range): void {
    this._cursor = range.end;
  }

  getLastRow(): number {
    return Math.max(0, this._lines.length - 1);
  }

  acceptsTableEdit(_row: number): boolean {
    // 已经限定在 NodeTable 块内，始终返回 true
    return true;
  }

  getLine(row: number): string {
    if (row < 0 || row >= this._lines.length) return "";
    return this._lines[row];
  }

  insertLine(row: number, line: string): void {
    this._lines.splice(row, 0, line);
    this._dirty = true;
  }

  deleteLine(row: number): void {
    this._lines.splice(row, 1);
    this._dirty = true;
  }

  replaceLines(startRow: number, endRow: number, lines: string[]): void {
    this._lines.splice(startRow, endRow - startRow, ...lines);
    this._dirty = true;
  }

  transact(func: () => void): void {
    // 核心库期望 transact 是同步的，我们的实现：
    // reload 已在构造后调用，func 操作内存，flush 在外部调用
    func();
  }

  // ── 私有方法 ──

  /**
   * 从 DOM 选区同步光标到行模型坐标
   */
  private _syncCursorFromDOM(): void {
    // 优先使用预设坐标
    const coord = this.presetCellCoord || (() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      return rangeToCellCoord(range, this.tableBlockEl);
    })();

    if (coord) {
      this._initialCellCoord = coord;
      const { row, approxCol } = domCoordToRowModelIndex(
        coord.row,
        coord.col,
        this._lines,
      );
      this._cursor = new Point(row, approxCol);
    }
  }

  /**
   * 操作后将行模型坐标恢复为 DOM 选区
   */
  private _restoreCursor(): void {
    // 需要等 DOM 更新后才能恢复光标
    // 使用 requestAnimationFrame 确保 DOM 已重渲染
    requestAnimationFrame(() => {
      try {
        const coord = this._rowModelToDomCoord(this._cursor.row, this._cursor.column);
        if (coord) {
          const range = cellCoordToRange(coord, this.tableBlockEl, true);
          if (range) {
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);

              // 强行把焦点还给编辑器，使光标能保持闪烁且支持连续点击操作
              const focusEl = range.startContainer.nodeType === Node.ELEMENT_NODE
                ? (range.startContainer as HTMLElement)
                : range.startContainer.parentElement;
              if (focusEl) {
                focusEl.focus();
              }
            }
          }
        }
      } catch (err) {
        // 光标恢复失败不应该是致命错误
        console.warn("[siyuan-advanced-tables] cursor restore failed:", err);
      }
    });
  }

  /**
   * 将核心库的行模型坐标反向映射为 DOM 单元格坐标
   */
  private _rowModelToDomCoord(row: number, col: number): CellCoord | null {
    // 核心库行 0 = 表头 → DOM 行 0
    // 核心库行 2+ = 数据行 → DOM 行 = row - 1
    const domRow = row <= 0 ? 0 : row - 1;

    if (domRow < 0 || domRow >= getTableRowCount(this.tableBlockEl)) {
      return null;
    }

    // 列：从行文本中计算该列的单元格索引
    const line = this._lines[row] || "";
    let pipeCount = 0;
    let escaped = false;

    for (let i = 0; i < line.length && i <= col; i++) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (line[i] === "\\") {
        escaped = true;
        continue;
      }
      if (line[i] === "|") {
        pipeCount++;
      }
    }

    const domCol = Math.max(0, pipeCount - 2); // 减去首尾两个 |
    return { row: domRow, col: Math.min(domCol, getTableRowCount(this.tableBlockEl) - 1) };
  }
}

/**
 * 辅助函数：检查当前 Protyle 光标是否在表格块内
 * 用于命令前置判断
 */
export function isCursorInTable(protyle: Protyle): {
  inTable: boolean;
  tableBlock: HTMLElement | null;
  blockId: string | null;
} {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { inTable: false, tableBlock: null, blockId: null };
  }

  const range = sel.getRangeAt(0);
  const tableBlock = findTableBlock(range.startContainer);

  if (!tableBlock) {
    return { inTable: false, tableBlock: null, blockId: null };
  }

  return {
    inTable: true,
    tableBlock,
    blockId: tableBlock.dataset.nodeId || null,
  };
}
