import { describe, it, expect, vi } from "vitest";
import { TableEditor, getTableClipboard } from "../src/table-editor";
import { Point, FormatType } from "@tgrosinger/md-advanced-tables";

// Mock SiyuanTextEditor
class MockSiyuanTextEditor {
  public lines: string[];
  public cursorCoord: { row: number; col: number } | null = null;
  public dirty = false;

  constructor(text: string, cursorCoord?: { row: number; col: number }) {
    this.lines = text.split("\n");
    this.cursorCoord = cursorCoord || null;
  }

  async reload() {
    this.dirty = false;
  }

  async flush() {
    this.dirty = false;
  }

  getCursorDomCoord() {
    return this.cursorCoord;
  }

  getRowCellsAt(lineIndex: number) {
    const line = this.lines[lineIndex] ?? "";
    return this.splitTableRow(line);
  }

  getLineCount() {
    return this.lines.length;
  }

  getLineAt(index: number) {
    return this.lines[index];
  }

  setLineAt(index: number, line: string) {
    this.lines[index] = line;
    this.dirty = true;
  }

  insertLineAt(index: number, line: string) {
    this.lines.splice(index, 0, line);
    this.dirty = true;
  }

  deleteLine(row: number) {
    this.lines.splice(row, 1);
    this.dirty = true;
  }

  getColCells(domCol: number) {
    const result: string[] = [];
    for (const line of this.lines) {
      if (this.isSeparatorLine(line)) continue;
      const cells = this.splitTableRow(line);
      result.push(cells[domCol] ?? "");
    }
    return result;
  }

  // ITextEditor implementation
  getCursorPosition() {
    if (!this.cursorCoord) return new Point(0, 0);
    const modelRow = this.cursorCoord.row === 0 ? 0 : this.cursorCoord.row + 1;
    const line = this.lines[modelRow] ?? "";
    let pipeCount = 0;
    let colIdx = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "|") {
        if (pipeCount === this.cursorCoord.col) {
          colIdx = i + 1;
          break;
        }
        pipeCount++;
      }
    }
    return new Point(modelRow, colIdx);
  }
  setCursorPosition(pos: Point): void {
    // 简单模拟反向同步
    // 核心行 0 是表头，2+是数据行
    const domRow = pos.row <= 0 ? 0 : pos.row - 1;
    // 估算列数
    const line = this.lines[pos.row] ?? "";
    let pipeCount = 0;
    let domCol = 0;
    for (let i = 0; i < pos.column; i++) {
      if (line[i] === "|") {
        pipeCount++;
      }
    }
    domCol = Math.max(0, pipeCount - 1);
    this.cursorCoord = { row: domRow, col: domCol };
  }
  setSelectionRange(): void {}
  getLastRow() {
    return this.lines.length - 1;
  }
  getLine(row: number) {
    return this.lines[row] ?? "";
  }
  insertLine(row: number, line: string) {
    this.lines.splice(row, 0, line);
    this.dirty = true;
  }
  replaceLines(start: number, end: number, lines: string[]) {
    this.lines.splice(start, end - start, ...lines);
    this.dirty = true;
  }
  transact(f: () => void) {
    f();
  }
  acceptsTableEdit() {
    return true;
  }

  private splitTableRow(line: string): string[] {
    return line.split("|").slice(1, -1).map(c => c.trim());
  }

  private isSeparatorLine(line: string): boolean {
    return /^[|\s-:]+$/.test(line) && line.includes("-");
  }
}

describe("剪切行与剪切列", () => {
  it("不允许剪切表头行", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 0, col: 0 });
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);
    const err = await te.cutRow();

    expect(err).toBe("无法剪切表头行");
  });

  it("可以剪切普通数据行，并从表格中删除该行", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 1, col: 0 }); // 选定 A1 (数据行第1行，在DOM中row=1)
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);
    await te.cutRow();

    const clipboard = getTableClipboard();
    expect(clipboard).toEqual({ type: "row", cells: ["A1", "A2"] });

    // 验证行是否被删除
    const expectedMarkdown = [
      "| Col1 | Col2 |",
      "| ---- | ---- |",
      "| B1   | B2   |",
    ].join("\n");
    expect(editor.lines.join("\n")).toBe(expectedMarkdown);
  });

  it("不允许剪切仅存的最后一列", async () => {
    const markdown = [
      "| Col1 |",
      "|---|",
      "| A1 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 1, col: 0 });
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);
    const err = await te.cutColumn();

    expect(err).toBe("无法剪切仅存的最后一列");
  });

  it("可以剪切列，并从表格中删除该列", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 1, col: 1 }); // 选定 A2 (col=1)
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);
    await te.cutColumn();

    const clipboard = getTableClipboard();
    expect(clipboard).toEqual({ type: "column", cells: ["Col2", "A2", "B2"] });

    // 验证列是否被删除
    const expectedMarkdown = [
      "| Col1 |",
      "| ---- |",
      "| A1   |",
      "| B1   |",
    ].join("\n");
    expect(editor.lines.join("\n")).toBe(expectedMarkdown);
  });
});

describe("粘贴行与粘贴列 (Excel 习惯插入模式)", () => {
  it("粘贴行：在数据行上方插入新行", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 2, col: 0 }); // 选定 B1 (数据行第2行，DOM row=2)
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);

    // 模拟剪贴板有行数据
    // 我们先剪切 A1 行
    const editorForCut = new MockSiyuanTextEditor(markdown, { row: 1, col: 0 });
    const teForCut = new TableEditor(editorForCut as any, { formatType: FormatType.NORMAL } as any);
    await teForCut.cutRow();

    // 在 B1 上方粘贴该行
    await te.pasteRow();

    const expectedMarkdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");
    expect(editor.lines.join("\n")).toBe(expectedMarkdown);
  });

  it("粘贴行：在表头行上方插入，需交换分割线位置以维持格式", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 0, col: 0 }); // 选定表头 (DOM row=0)
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);

    // 剪贴板中已存在行数据 (如 A1, A2)
    const editorForCut = new MockSiyuanTextEditor(markdown, { row: 1, col: 0 });
    const teForCut = new TableEditor(editorForCut as any, { formatType: FormatType.NORMAL } as any);
    await teForCut.cutRow();

    // 在表头上方粘贴
    await te.pasteRow();

    // 验证粘贴的内容成为了新表头，原表头变成了第一行数据，分隔行依然在 index 1 处
    const expectedMarkdown = [
      "| A1 | A2 |",
      "|---|---|",
      "| Col1 | Col2 |",
      "| A1 | A2 |",
    ].join("\n");
    expect(editor.lines.join("\n")).toBe(expectedMarkdown);
  });

  it("粘贴列：在当前列的左侧插入新列", async () => {
    const markdown = [
      "| Col1 | Col2 |",
      "|---|---|",
      "| A1 | A2 |",
      "| B1 | B2 |",
    ].join("\n");

    const editor = new MockSiyuanTextEditor(markdown, { row: 1, col: 0 }); // 选定 Col1 (col=0)
    const te = new TableEditor(editor as any, { formatType: FormatType.NORMAL } as any);

    // 模拟剪贴板中有列数据 (从 Col2 列剪切得到)
    const editorForCut = new MockSiyuanTextEditor(markdown, { row: 1, col: 1 });
    const teForCut = new TableEditor(editorForCut as any, { formatType: FormatType.NORMAL } as any);
    await teForCut.cutColumn();

    // 在 Col1 前粘贴
    await te.pasteColumn();

    const expectedMarkdown = [
      "| Col2 | Col1 | Col2 |",
      "| --- | --- | --- |",
      "| A2 | A1 | A2 |",
      "| B2 | B1 | B2 |",
    ].join("\n");
    expect(editor.lines.join("\n")).toBe(expectedMarkdown);
  });
});
