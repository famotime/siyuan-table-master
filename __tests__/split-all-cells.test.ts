import { describe, expect, it } from "vitest";
import { TableEditor } from "../src/table-editor";

class MockSiyuanTextEditor {
  public lines: string[];

  constructor(lines: string[]) {
    this.lines = [...lines];
  }

  async reload(): Promise<void> {}
  async flush(): Promise<void> {}

  getLineCount(): number {
    return this.lines.length;
  }

  getLineAt(index: number): string | undefined {
    return this.lines[index];
  }

  setLineAt(index: number, line: string): void {
    this.lines[index] = line;
  }
}

describe("TableEditor.splitAllCells", () => {
  it("移除全表单元格的 colspan 和 rowspan，保留其他属性与内容", async () => {
    const editor = new MockSiyuanTextEditor([
      '| 标题 {: colspan="2" data-type="x"} | C |',
      "| --- | --- |",
      '| 内容 {: rowspan="3" style="color:red"} | B |',
    ]);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.lines).toEqual([
      '| 标题 {: data-type="x"} | C |',
      "| --- | --- |",
      '| 内容 {: style="color:red"} | B |',
    ]);
  });

  it("表格不含合并属性时不修改行内容", async () => {
    const original = [
      '| A {: data-type="x"} | B |',
      "| --- | --- |",
      "| 1 | 2 |",
    ];
    const editor = new MockSiyuanTextEditor(original);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.lines).toEqual(original);
  });
});
