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
import { logger } from "./logger";
import {
  CellCoord,
  findTableBlock,
  rangeToCellCoord,
  cellCoordToRange,
  getTableRowCount,
  getTableColCount,
  highlightActiveRowAndCol,
  findHtmlTableBlock,
} from "./dom-utils";
import {
  parseTableKramdown,
  serializeTableKramdown,
  domCoordToRowModelIndex,
  getPipePosition,
  fixCJKSeparatorWidth,
  splitTableRow,
  isSeparatorLine,
} from "./table-model";

// 连续操作时的光标坐标全局缓存，用于平抑异步 updateBlock 带来的 DOM Selection 同步延迟
let lastActiveTableId: string | null = null;
let lastActiveCoord: CellCoord | null = null;
let lastActiveTime: number = 0;

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
  public readonly blockId: string;
  private fixCJKWidth: boolean;
  private presetCellCoord: CellCoord | null;

  // ── 内存行模型 ──
  private _lines: string[] = [];
  private _ialLine: string | null = null;
  private _rawKramdown = "";
  private _rawKramdownOverride: string | null = null;
  private _cursor: Point = new Point(0, 0);
  private _dirty = false;
  private _cursorUpdatedByCore = false;

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

      // 终极防线：无论是什么非法类型（undefined、null、object 等），强行转换为 string 兜底
      if (typeof kramdown !== "string") {
        kramdown = String(kramdown ?? "");
      }

      this._rawKramdown = kramdown;
      this._rawKramdownOverride = null;
      const parsed = parseTableKramdown(kramdown);

      this._lines = [...parsed.tableLines];
      this._ialLine = parsed.ialLine;
      this._dirty = false;
      this._cursorUpdatedByCore = false;

      // 从 DOM 读取当前光标位置并映射到行模型坐标
      this._syncCursorFromDOM();
    } catch (err) {
      logger.error("[siyuan-table-mater] reload failed:", err);
    }
  }

  /**
   * 将内存行模型 flush 回思源编辑器
   * 必须在核心库操作后调用
   */
  async flush(): Promise<void> {
    if (!this._dirty) return;

    try {
      let finalKramdown = this._rawKramdownOverride;
      if (finalKramdown === null) {
        const finalLines = this.fixCJKWidth
          ? fixCJKSeparatorWidth(this._lines)
          : this._lines;
        const newKramdown = serializeTableKramdown(finalLines, this._ialLine);

        // 将思源导出的备注上标还原为行内备注 HTML。
        finalKramdown = newKramdown.replace(
          /((?:<[a-zA-Z]+[^>]*?>.*?<\/[a-zA-Z]+>|[^\s|<>{}](?:[^|<>{}]*[^\s|<>{}])?))\s*<sup>[(（](.*?)[)）]<\/sup>/g,
          '<span data-type="inline-memo" data-inline-memo-content="$2">$1</span>'
        );
      }








      // 1. 获取当前的旧 DOM 块，并打上临时标记，以便 MutationObserver 识别 DOM 替换
      const oldBlockEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${this.blockId}"][data-type="NodeTable"]`) || 
                          document.querySelector(`[data-node-id="${this.blockId}"][data-type="NodeTable"]`) as HTMLElement || this.tableBlockEl;
      if (oldBlockEl) {
        oldBlockEl.setAttribute("data-temp-old", "true");
      }

      // 2. 建立 MutationObserver 监听最新的表格 DOM 被挂载
      const wysiwygEl = document.querySelector(".protyle-wysiwyg") || document.body;
      let observer: MutationObserver | null = null;
      let timeoutId: any = null;

      const doRestore = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this._restoreCursor();
      };

      observer = new MutationObserver(() => {
        const latestBlockEl = document.querySelector(`[data-node-id="${this.blockId}"][data-type="NodeTable"]`) as HTMLElement;
        // 只有当查询到最新的块，且它不带 data-temp-old 属性时，说明 DOM 已完成更新并被替换挂载
        if (latestBlockEl && !latestBlockEl.hasAttribute("data-temp-old")) {
          doRestore();
        }
      });

      observer.observe(wysiwygEl, {
        childList: true,
        subtree: true,
      });

      // 兜底超时时间为 800ms，以防在特殊情况下没有触发 DOM 挂载导致光标恢复逻辑被卡死
      timeoutId = setTimeout(() => {
        doRestore();
      }, 800);

      // 3. 使用内核 API 以 markdown 数据类型更新块
      // 这比直接操作 DOM 更可靠，且支持 undo
      await fetchSyncPost("/api/block/updateBlock", {
        id: this.blockId,
        dataType: "markdown",
        data: finalKramdown,
      });

      this._rawKramdown = finalKramdown;
      this._rawKramdownOverride = null;
      this._dirty = false;
    } catch (err) {
      logger.error("[siyuan-table-mater] flush failed:", err);
    }
  }

  /** 获取 reload 时读取的完整 Kramdown。 */
  getRawKramdown(): string {
    return this._rawKramdown;
  }

  /** 使用完整 Kramdown 覆盖下一次 flush 的行模型序列化结果。 */
  setRawKramdown(kramdown: string): void {
    if (kramdown !== this._rawKramdown) {
      this._rawKramdownOverride = kramdown;
      this._dirty = true;
    }
  }

  // ── ITextEditor 实现（同步，操作内存） ──

  getCursorPosition(): Point {
    return this._cursor;
  }

  setCursorPosition(pos: Point): void {
    this._cursor = pos;
    this._cursorUpdatedByCore = true;
    // 同时也更新一下缓存
    const coord = this._rowModelToDomCoord(pos.row, pos.column);
    if (coord) {
      lastActiveTableId = this.blockId;
      lastActiveCoord = coord;
      lastActiveTime = Date.now();
    }
  }

  setSelectionRange(range: Range): void {
    this._cursor = range.end;
    this._cursorUpdatedByCore = true;
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
    // 优先使用预设坐标，其次使用极短时间内的全局缓存坐标（处理连续操作时的 DOM 延迟）
    let coord = this.presetCellCoord;
    if (!coord && lastActiveTableId === this.blockId && (Date.now() - lastActiveTime) < 500) {
      coord = lastActiveCoord;
    }

    // 如果都没有，则从 DOM 的当前 Selection 区域解析
    if (!coord) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        coord = rangeToCellCoord(range, this.tableBlockEl);
      }
    }

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
    // DOM 更新完成后利用 requestAnimationFrame 在下一帧浏览器重绘时恢复光标位置
    requestAnimationFrame(() => {
      try {
        // 动态获取文档中最新的表格 DOM 节点，以防 updateBlock 重绘后节点脱离文档树
        // 使用更具体的选择器，限定在编辑器区域内并指定 [data-type="NodeTable"]，防止误匹配到面包屑等辅助 DOM 节点
        const currentBlockEl = (document.querySelector(`.protyle-wysiwyg [data-node-id="${this.blockId}"][data-type="NodeTable"]`) || 
                                document.querySelector(`[data-node-id="${this.blockId}"][data-type="NodeTable"]`)) as HTMLElement || this.tableBlockEl;
        
        // 如果核心库主动更新了游标，则优先使用更新后的游标坐标来映射 DOM 位置；
        // 否则（如拖拽排序等手动修改模型未更新游标的场景），使用预设坐标。
        const coord = (this._cursorUpdatedByCore ? null : this.presetCellCoord) || 
                      this._rowModelToDomCoord(this._cursor.row, this._cursor.column, currentBlockEl);
        
        if (coord) {
          const range = cellCoordToRange(coord, currentBlockEl, true);
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

              // 重绘完成后立即对新 DOM 节点重新施加行列高亮，确保连续移动过程中高亮不丢失
              highlightActiveRowAndCol(currentBlockEl, coord);

              // 更新活跃缓存
              lastActiveTableId = this.blockId;
              lastActiveCoord = coord;
              lastActiveTime = Date.now();

              // 派发自定义事件，通知相关组件（如拖拽手柄、浮动工具栏）重新定位
              document.dispatchEvent(new CustomEvent("siyuan-table-mater-refresh-ui", {
                detail: { tableBlock: currentBlockEl, coord }
              }));
            }
          }
        }
      } catch (err) {
        // 光标恢复失败不应该是致命错误
      }
    });
  }


  // ═══════════════════════════════════════════════════
  // 公共访问方法 — 供 TableEditor 复制/粘贴功能使用
  // ═══════════════════════════════════════════════════

  /**
   * 返回 reload() 后确定的初始 DOM 单元格坐标。
   * 可用于获取当前光标所在行列号。
   */
  getCursorDomCoord(): CellCoord | null {
    return this._initialCellCoord;
  }

  /**
   * 获取指定行模型行索引处的所有单元格内容（不含首尾 | 及空白）。
   * @param lineIndex - _lines 数组索引（0=表头, 1=分隔行, 2+=数据行）
   */
  getRowCellsAt(lineIndex: number): string[] {
    const line = this._lines[lineIndex] ?? "";
    return splitTableRow(line);
  }

  /**
   * 将给定内容写入指定行模型行，列数以目标行为准。
   * 多余的 cells 截断；不足时剩余列清空。
   * 会将适配器标记为 dirty，flush() 时统一写回思源。
   */
  setRowCellsAt(lineIndex: number, cells: string[]): void {
    const orig = this._lines[lineIndex];
    if (orig === undefined) return;
    const origCells = splitTableRow(orig);
    const numCols = origCells.length;
    // 按目标行列数对齐：多余截断，不足补空字符串
    const newCells = Array.from({ length: numCols }, (_, i) =>
      i < cells.length ? cells[i] : ""
    );
    this._lines[lineIndex] = `| ${newCells.join(" | ")} |`;
    this._dirty = true;
  }

  /**
   * 获取指定 DOM 列索引在所有非分隔行（含表头）中的单元格内容，
   * 按 [表头, 数据行0, 数据行1, ...] 顺序返回。
   */
  getColCells(domCol: number): string[] {
    const result: string[] = [];
    for (const line of this._lines) {
      if (isSeparatorLine(line)) continue;
      const cells = splitTableRow(line);
      result.push(cells[domCol] ?? "");
    }
    return result;
  }

  /**
   * 将 colCells 依次写入指定 DOM 列索引的所有非分隔行。
   * colCells 顺序须与 getColCells() 返回的顺序一致（表头优先）。
   * 行数不匹配时：colCells 多余部分忽略，目标行超出部分保持原值。
   */
  setColCells(domCol: number, colCells: string[]): void {
    let cellIdx = 0;
    for (let i = 0; i < this._lines.length && cellIdx < colCells.length; i++) {
      if (isSeparatorLine(this._lines[i])) continue;
      const cells = splitTableRow(this._lines[i]);
      if (domCol < cells.length) {
        cells[domCol] = colCells[cellIdx];
        this._lines[i] = `| ${cells.join(" | ")} |`;
      }
      cellIdx++;
    }
    this._dirty = true;
  }

  // ═══════════════════════════════════════════════════
  // 扩展公共接口 — 供外部模块直接操作内存行模型
  // ═══════════════════════════════════════════════════

  /** 返回内存行模型的总行数 */
  getLineCount(): number {
    return this._lines.length;
  }

  /** 获取内存行模型的所有行副本 */
  getTableLines(): string[] {
    return [...this._lines];
  }

  /** 设置完整的表格行模型与 IAL，并重置 HTML 覆盖标记 */
  setTableModel(lines: string[], ialLine: string | null): void {
    this._lines = [...lines];
    this._ialLine = ialLine;
    this._rawKramdownOverride = null;
    this._dirty = true;
  }

  /** 按索引直接读取一行（含首尾 | 及空白），越界返回 undefined */
  getLineAt(index: number): string | undefined {
    return this._lines[index];
  }

  /** 按索引直接写入一行，并自动标记 dirty */
  setLineAt(index: number, line: string): void {
    if (index >= 0 && index < this._lines.length) {
      this._lines[index] = line;
      this._dirty = true;
    }
  }

  /**
   * 在指定索引处插入一行，并自动标记 dirty。
   * 常用于外部模块在末尾追加空行。
   */
  insertLineAt(index: number, line: string): void {
    this._lines.splice(index, 0, line);
    this._dirty = true;
  }

  /** 删除指定索引处的一行，并自动标记 dirty */
  removeLine(index: number): void {
    if (index >= 0 && index < this._lines.length) {
      this._lines.splice(index, 1);
      this._dirty = true;
    }
  }

  /** 标记适配器为 dirty，使下次 flush() 时写回思源 */
  markDirty(): void {
    this._dirty = true;
  }

  // ═══════════════════════════════════════════════════
  // 内部私有方法
  // ═══════════════════════════════════════════════════

  /**
   * 将核心库的行模型坐标反向映射为 DOM 单元格坐标
   */
  private _rowModelToDomCoord(row: number, col: number, tableBlockEl?: HTMLElement): CellCoord | null {
    const activeTableBlock = tableBlockEl || this.tableBlockEl;
    // 核心库行 0 = 表头 → DOM 行 0
    // 核心库行 2+ = 数据行 → DOM 行 = row - 1
    const domRow = row <= 0 ? 0 : row - 1;
    const tableCount = getTableRowCount(activeTableBlock);

    if (domRow < 0 || domRow >= tableCount) {
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

    // 已经过管道符的数量 - 1 = 当前单元格索引（0-indexed）
    // 例：游标在 "| A | B |" 的 B 处时，经过了 2 个 |，pipeCount-1=1 即第 1 列
    const domCol = Math.max(0, pipeCount - 1);
    const colCount = getTableColCount(activeTableBlock);
    return { row: domRow, col: Math.min(domCol, colCount - 1) };
  }
}

/**
 * 辅助函数：检查当前 Protyle 光标是否在表格块内
 * 用于命令前置判断
 *
 * 策略：
 * 1. 优先使用 window.getSelection() 精确定位（正常编辑场景）
 * 2. 当 selection 为空（点击 Dock/顶栏按钮后焦点离开编辑器）时，
 *    回退到在 protyle.wysiwyg.element 中搜索聚焦的 NodeTable 块
 */
export function isCursorInTable(protyle: Protyle): {
  inTable: boolean;
  tableBlock: HTMLElement | null;
  blockId: string | null;
} {
  // —— 策略 1：通过 selection 精确定位 ——
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const tableBlock = findTableBlock(range.startContainer);
    if (tableBlock) {
      return {
        inTable: true,
        tableBlock,
        blockId: tableBlock.dataset.nodeId || null,
      };
    }

    const htmlTableInfo = findHtmlTableBlock(range.startContainer);
    if (htmlTableInfo) {
      return {
        inTable: true,
        tableBlock: htmlTableInfo.block,
        blockId: htmlTableInfo.block.dataset.nodeId || null,
      };
    }
  }

  // —— 策略 2：selection 丢失时（如点击 Dock 按钮），扫描 wysiwyg DOM 兜底 ——
  // 尝试通过 protyle.wysiwyg.element 找到编辑器的 DOM 根
  try {
    const wysiwygEl = (protyle as any)?.wysiwyg?.element as HTMLElement | undefined;
    if (wysiwygEl) {
      // 找含 select 类的表格块或 HTML 块
      const focusedBlock = wysiwygEl.querySelector(
        '[data-type="NodeTable"].protyle-wysiwyg--select, [data-type="NodeTable"][select="true"], [data-type="NodeHTMLBlock"].protyle-wysiwyg--select, [data-type="NodeHTMLBlock"][select="true"]'
      ) as HTMLElement | null;
      
      if (focusedBlock) {
        if (focusedBlock.dataset.type === "NodeTable") {
          return {
            inTable: true,
            tableBlock: focusedBlock,
            blockId: focusedBlock.dataset.nodeId || null,
          };
        } else if (focusedBlock.dataset.type === "NodeHTMLBlock") {
          const htmlInfo = findHtmlTableBlock(focusedBlock);
          if (htmlInfo) {
            return {
              inTable: true,
              tableBlock: htmlInfo.block,
              blockId: htmlInfo.block.dataset.nodeId || null,
            };
          }
        }
      }
    }
  } catch (_e) {
    // 兜底失败不影响主流程
  }

  return { inTable: false, tableBlock: null, blockId: null };
}
