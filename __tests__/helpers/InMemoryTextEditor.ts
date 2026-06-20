/**
 * InMemoryTextEditor - 用于测试的内存文本编辑器
 * 
 * 实现 @tgrosinger/md-advanced-tables 的 ITextEditor 接口，
 * 基于字符串数组模拟行式文本编辑。所有方法同步，与核心库设计一致。
 * 
 * 这个夹具有双重用途：
 * 1. 作为 vitest 中的测试替身，验证核心库行为
 * 2. 作为 SiyuanTextEditor 的参照模板（后者是异步的内存行模型）
 */

import type { ITextEditor } from "@tgrosinger/md-advanced-tables";
import { Point } from "@tgrosinger/md-advanced-tables";
import { Range } from "@tgrosinger/md-advanced-tables";

export class InMemoryTextEditor implements ITextEditor {
  private _lines: string[];
  private _cursor: Point;
  private _transactionDepth = 0;

  constructor(text: string, initialCursor?: Point) {
    this._lines = text.split("\n");
    this._cursor = initialCursor ?? new Point(0, 0);
  }

  /** 获取当前文本内容 */
  getText(): string {
    return this._lines.join("\n");
  }

  /** 获取行数组（只读副本） */
  getLines(): readonly string[] {
    return [...this._lines];
  }

  // ── ITextEditor 实现 ──

  getCursorPosition(): Point {
    return this._cursor;
  }

  setCursorPosition(pos: Point): void {
    this._cursor = pos;
  }

  setSelectionRange(range: Range): void {
    // 选中范围后，光标移到末尾
    this._cursor = range.end;
  }

  getLastRow(): number {
    return Math.max(0, this._lines.length - 1);
  }

  acceptsTableEdit(_row: number): boolean {
    // 内存编辑器默认所有行都接受表格编辑
    return true;
  }

  getLine(row: number): string {
    if (row < 0 || row >= this._lines.length) return "";
    return this._lines[row];
  }

  insertLine(row: number, line: string): void {
    this._lines.splice(row, 0, line);
  }

  deleteLine(row: number): void {
    this._lines.splice(row, 1);
  }

  replaceLines(startRow: number, endRow: number, lines: string[]): void {
    // replaceLines(startRow, endRow, lines)：
    // 替换 [startRow, endRow) 范围为 lines
    const removed = this._lines.splice(startRow, endRow - startRow, ...lines);
    return removed.length;
  }

  transact(func: () => void): void {
    this._transactionDepth++;
    try {
      func();
    } finally {
      this._transactionDepth--;
    }
  }

  isTransacting(): boolean {
    return this._transactionDepth > 0;
  }
}
