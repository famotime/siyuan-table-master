import { describe, expect, it } from "vitest";
import { TableEditor } from "../src/table-editor";

class MockSiyuanTextEditor {
  public lines: string[];
  public ialLine: string | null = null;
  public rawKramdown: string | null;

  constructor(lines: string[], rawKramdown: string | null = null) {
    this.lines = [...lines];
    this.rawKramdown = rawKramdown;
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

  setTableModel(lines: string[], ialLine: string | null): void {
    this.lines = [...lines];
    this.ialLine = ialLine;
    this.rawKramdown = null;
  }

  getRawKramdown(): string | null {
    return this.rawKramdown;
  }

  setRawKramdown(kramdown: string): void {
    this.rawKramdown = kramdown;
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

  it("支持思源在单元格内容前输出的合并属性", async () => {
    const editor = new MockSiyuanTextEditor([
      '| {: colspan="2"}标题 | C |',
      "| --- | --- |",
      '| {: rowspan="3" custom-id="cell-a"}内容 | B |',
    ]);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.lines).toEqual([
      "| 标题 | C |",
      "| --- | --- |",
      '| {: custom-id="cell-a"}内容 | B |',
    ]);
  });

  it("移除合并属性时保留单元格链接文本中的未转义管道符", async () => {
    const editor = new MockSiyuanTextEditor([
      '| {: colspan="2"}[Producer.ai|AI Music Agent](https://example.com) | C |',
      "| --- | --- |",
      "| A | B |",
    ]);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.lines).toEqual([
      "| [Producer.ai|AI Music Agent](https://example.com) | C |",
      "| --- | --- |",
      "| A | B |",
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

  it("拆分思源导出的 HTML 表格并转换为思源原生 Markdown 表格", async () => {
    const source = [
      '<table custom-table-width-auto="true">',
      "<tbody><tr>",
      '<td colspan="2" rowspan="2">{: colspan="2" rowspan="2"}context<br />ui</td>',
      "<td>tail</td>",
      "</tr>",
      "<tr>",
      "<td>next</td>",
      "</tr></tbody>",
      "</table>",
      '{: id="20260625212423-son6541" custom-table-width-auto="true"}',
    ].join("\n");
    const editor = new MockSiyuanTextEditor([], source);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.rawKramdown).toBeNull();
    expect(editor.lines).toEqual([
      "| context<br />ui |  | tail |",
      "| --- | --- | --- |",
      "|  |  | next |",
    ]);
    expect(editor.ialLine).toBe('{: id="20260625212423-son6541" custom-table-width-auto="true"}');
  });

  it("正确拆分目标表格块 20260726212909-ydlu9eo 的合并单元格", async () => {
    const source = [
      '<table custom-table-width-auto="true">',
      '<colgroup><col /><col /><col /><col /><col /></colgroup>',
      '<thead><tr>',
      '<th>ID</th>',
      '<th>模块名称</th>',
      '<th>测试数</th>',
      '<th>文件数</th>',
      '<th>说明</th>',
      '</tr>',
      '</thead><tbody>',
      '<tr>',
      '<td>2</td>',
      '<td>context</td>',
      '<td>10</td>',
      '<td>12</td>',
      '<td colspan="1" rowspan="2">{: colspan="1" rowspan="2"}24<br />24</td>',
      '</tr>',
      '<tr>',
      '<td>2</td>',
      '<td colspan="2" rowspan="2">{: colspan="2" rowspan="2"}context<br />10<br />ui<br />14</td>',
      '<td>12</td>',
      '</tr>',
      '<tr>',
      '<td>3</td>',
      '<td>10</td>',
      '<td>Vue 组件、composables、主题</td>',
      '</tr>',
      '</tbody>',
      '</table>',
      '{: colgroup="||||" custom-table-width-auto="true" id="20260726212909-ydlu9eo" updated="20260724215956"}',
    ].join("\n");
    const editor = new MockSiyuanTextEditor([], source);

    await new TableEditor(editor as any).splitAllCells();

    expect(editor.rawKramdown).toBeNull();
    expect(editor.lines).toEqual([
      "| ID | 模块名称 | 测试数 | 文件数 | 说明 |",
      "| --- | --- | --- | --- | --- |",
      "| 2 | context | 10 | 12 | 24<br />24 |",
      "| 2 | context<br />10<br />ui<br />14 |  | 12 |  |",
      "| 3 |  |  | 10 | Vue 组件、composables、主题 |",
    ]);
    expect(editor.ialLine).toBe('{: colgroup="||||" custom-table-width-auto="true" id="20260726212909-ydlu9eo" updated="20260724215956"}');
  });
});
