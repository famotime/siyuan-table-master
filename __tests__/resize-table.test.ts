import { describe, it, expect } from "vitest";
import { TableEditor } from "../src/table-editor";

// 构造一个满足 SiyuanTextEditor 核心公共 API 的 Mock 类，用于逻辑测试
class MockSiyuanTextEditor {
  public _lines: string[] = [];

  constructor(lines: string[]) {
    this._lines = [...lines];
  }

  async reload() {
    // Mock reload 无需操作
  }

  async flush() {
    // Mock flush 无需操作
  }

  getLineCount(): number {
    return this._lines.length;
  }

  getLineAt(index: number): string | undefined {
    return this._lines[index];
  }

  setLineAt(index: number, line: string): void {
    if (index >= 0 && index < this._lines.length) {
      this._lines[index] = line;
    }
  }

  insertLineAt(index: number, line: string): void {
    this._lines.splice(index, 0, line);
  }
}

describe("TableEditor.resizeTable", () => {
  it("应该能够向下向右扩展行列", async () => {
    // 初始表格：3列，3行（1表头 + 2数据）
    const initialLines = [
      "| Col1 | Col2 | Col3 |",
      "| --- | --- | --- |",
      "| a1 | a2 | a3 |",
      "| b1 | b2 | b3 |",
    ];

    const mockCtx = new MockSiyuanTextEditor(initialLines);
    const te = new TableEditor(mockCtx as any);

    // 扩展至 4列，5行（1表头 + 4数据）
    await te.resizeTable(4, 5);

    expect(mockCtx._lines).toEqual([
      "| Col1 | Col2 | Col3 |  |",
      "| --- | --- | --- | --- |",
      "| a1 | a2 | a3 |  |",
      "| b1 | b2 | b3 |  |",
      "|  |  |  |  |",
      "|  |  |  |  |",
    ]);
  });

  it("当目标列数/行数小于当前值时，不应缩减行列（只允许向下向右扩展）", async () => {
    const initialLines = [
      "| Col1 | Col2 |",
      "| --- | --- |",
      "| a1 | a2 |",
    ];

    const mockCtx = new MockSiyuanTextEditor(initialLines);
    const te = new TableEditor(mockCtx as any);

    // 尝试 resize 到 1列，1行
    await te.resizeTable(1, 1);

    expect(mockCtx._lines).toEqual(initialLines);
  });
});
