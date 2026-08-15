// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { deleteTableRows, deleteTableColumns, splitTableRow } from "../src/table-model";
import { getSelectedTableRange } from "../src/dom-utils";

describe("deleteTableRows 批量删除行", () => {
  const sampleTable = [
    "| 标题A | 标题B | 标题C |",
    "| :--- | :---: | ---: |",
    "| A1   | B1    | C1   |",
    "| A2   | B2    | C2   |",
    "| A3   | B3    | C3   |",
    "| A4   | B4    | C4   |",
  ];

  it("正确批量删除连续多行数据行 (第 1, 2 行)", () => {
    // DOM row 1 对应 A1，DOM row 2 对应 A2
    const res = deleteTableRows(sampleTable, [1, 2]);
    expect(res.deletedCount).toBe(2);
    expect(res.error).toBeUndefined();

    const lines = res.lines;
    // 应该只剩下表头、分隔行、A3、A4
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("标题A");
    expect(lines[1]).toContain(":---");
    expect(lines[2]).toContain("A3");
    expect(lines[3]).toContain("A4");
  });

  it("正确批量删除不连续多行 (第 1, 3 行)", () => {
    // DOM row 1 对应 A1，DOM row 3 对应 A3
    const res = deleteTableRows(sampleTable, [1, 3]);
    expect(res.deletedCount).toBe(2);

    const lines = res.lines;
    expect(lines.length).toBe(4);
    expect(lines[2]).toContain("A2");
    expect(lines[3]).toContain("A4");
  });

  it("如果仅选中表头行 (0)，应返回 cannot_delete_header 错误且不删除", () => {
    const res = deleteTableRows(sampleTable, [0]);
    expect(res.deletedCount).toBe(0);
    expect(res.error).toBe("cannot_delete_header");
    expect(res.lines.length).toBe(sampleTable.length);
  });

  it("如果同时选中了表头行 (0) 和数据行 (1, 2)，应保护表头只删除数据行", () => {
    const res = deleteTableRows(sampleTable, [0, 1, 2]);
    expect(res.deletedCount).toBe(2);
    expect(res.error).toBeUndefined();

    const lines = res.lines;
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("标题A");
    expect(lines[2]).toContain("A3");
  });

  it("当所有数据行全部被删除时，应自动补充空数据行保持 Markdown 表格合法", () => {
    const res = deleteTableRows(sampleTable, [1, 2, 3, 4]);
    expect(res.deletedCount).toBe(4);
    expect(res.lines.length).toBe(3); // 表头 + 分隔行 + 1 空数据行
    expect(res.lines[0]).toContain("标题A");
    expect(res.lines[1]).toContain(":---");
    const emptyCells = splitTableRow(res.lines[2]);
    expect(emptyCells.length).toBe(3);
    expect(emptyCells.every(c => c === "")).toBe(true);
  });

  it("边界：行数不足 2 行时直接返回", () => {
    const res = deleteTableRows(["| A | B |"], [1]);
    expect(res.deletedCount).toBe(0);
    expect(res.lines.length).toBe(1);
  });
});

describe("deleteTableColumns 批量删除列", () => {
  const sampleTable = [
    "| 姓名 | 年龄 | 性别 | 城市 |",
    "| :--- | :---: | :---: | ---: |",
    "| 张三 | 20   | 男   | 北京 |",
    "| 李四 | 25   | 女   | 上海 |",
  ];

  it("正确批量删除连续多列 (第 1, 2 列：年龄, 性别)", () => {
    const res = deleteTableColumns(sampleTable, [1, 2]);
    expect(res.deletedCount).toBe(2);
    expect(res.error).toBeUndefined();

    const lines = res.lines;
    expect(lines.length).toBe(4);
    const headers = splitTableRow(lines[0]);
    expect(headers).toEqual(["姓名", "城市"]);

    const row1 = splitTableRow(lines[2]);
    expect(row1).toEqual(["张三", "北京"]);

    const row2 = splitTableRow(lines[3]);
    expect(row2).toEqual(["李四", "上海"]);
  });

  it("正确批量删除不连续多列 (第 0, 3 列：姓名, 城市)", () => {
    const res = deleteTableColumns(sampleTable, [0, 3]);
    expect(res.deletedCount).toBe(2);

    const lines = res.lines;
    const headers = splitTableRow(lines[0]);
    expect(headers).toEqual(["年龄", "性别"]);

    const row1 = splitTableRow(lines[2]);
    expect(row1).toEqual(["20", "男"]);
  });

  it("当试图删除所有列时，应返回 cannot_delete_all_columns 错误且不删除", () => {
    const res = deleteTableColumns(sampleTable, [0, 1, 2, 3]);
    expect(res.deletedCount).toBe(0);
    expect(res.error).toBe("cannot_delete_all_columns");
    expect(res.lines.length).toBe(sampleTable.length);
  });

  it("越界列号应自动过滤并正常处理有效列", () => {
    const res = deleteTableColumns(sampleTable, [1, 99, -1]);
    expect(res.deletedCount).toBe(1); // 只有 1 列被删

    const headers = splitTableRow(res.lines[0]);
    expect(headers).toEqual(["姓名", "性别", "城市"]);
  });
});

describe("getSelectedTableRange 选区检测函数", () => {
  it("通过 DOM 单元格 class 检测选区", () => {
    const div = document.createElement("div");
    div.dataset.type = "NodeTable";
    div.dataset.nodeId = "test-node-id";
    div.innerHTML = `
      <table>
        <thead>
          <tr><th>Col0</th><th>Col1</th><th>Col2</th></tr>
        </thead>
        <tbody>
          <tr><td class="protyle-table-control__select">A0</td><td class="protyle-table-control__select">B0</td><td>C0</td></tr>
          <tr><td class="protyle-table-control__select">A1</td><td class="protyle-table-control__select">B1</td><td>C1</td></tr>
          <tr><td>A2</td><td>B2</td><td>C2</td></tr>
        </tbody>
      </table>
    `;

    const range = getSelectedTableRange(div);
    expect(range).not.toBeNull();
    // 数据行在 table 中分别对应的 tr 索引：DOM row 1, 2，列 0, 1
    expect(range?.rows).toEqual([1, 2]);
    expect(range?.cols).toEqual([0, 1]);
  });

  it("tableControl 仅返回最后落点单元格时，仍合并 DOM 中的完整多选范围", () => {
    const div = document.createElement("div");
    div.dataset.type = "NodeTable";
    div.dataset.nodeId = "test-node-id";
    div.innerHTML = `
      <table>
        <thead><tr><th>H0</th><th>H1</th><th>H2</th></tr></thead>
        <tbody>
          <tr><td class="protyle-table-control__select">R1C0</td><td class="protyle-table-control__select">R1C1</td><td>R1C2</td></tr>
          <tr><td class="protyle-table-control__select">R2C0</td><td class="protyle-table-control__select">R2C1</td><td>R2C2</td></tr>
          <tr><td>R3C0</td><td>R3C1</td><td>R3C2</td></tr>
        </tbody>
      </table>
    `;

    // 原生 tableControl 可能只暴露最后落点（右下角）单元格，这是旧的“只删最后一行”根因。
    const lastCell = div.querySelector("tbody tr:nth-child(2) td:nth-child(2)");
    const mockWysiwyg = {
      tableControl: {
        getSelectedCells: () => [lastCell],
      }
    };

    const range = getSelectedTableRange(div, mockWysiwyg);
    expect(range).not.toBeNull();
    expect(range?.rows).toEqual([1, 2]);
    expect(range?.cols).toEqual([0, 1]);
  });

  it("通过 tableControl.getSelectedCells 检测选区", () => {
    const div = document.createElement("div");
    div.dataset.type = "NodeTable";
    div.innerHTML = `
      <table>
        <thead><tr><th>H0</th><th>H1</th></tr></thead>
        <tbody>
          <tr><td>D0</td><td>D1</td></tr>
          <tr><td>E0</td><td>E1</td></tr>
        </tbody>
      </table>
    `;

    const tds = div.querySelectorAll("tbody td");
    const mockWysiwyg = {
      tableControl: {
        selection: { node: div },
        getSelectedCells: () => [tds[0], tds[1]], // 第一行数据行 (DOM row 1) 的两列
      }
    };

    const range = getSelectedTableRange(div, mockWysiwyg);
    expect(range).not.toBeNull();
    expect(range?.rows).toEqual([1]);
    expect(range?.cols).toEqual([0, 1]);
  });

  it("通过 tableControl.selection 直接读取多行多列范围", () => {
    const div = document.createElement("div");
    div.dataset.type = "NodeTable";
    div.innerHTML = `
      <table>
        <thead><tr><th>H0</th><th>H1</th><th>H2</th></tr></thead>
        <tbody>
          <tr><td>R1C0</td><td>R1C1</td><td>R1C2</td></tr>
          <tr><td>R2C0</td><td>R2C1</td><td>R2C2</td></tr>
          <tr><td>R3C0</td><td>R3C1</td><td>R3C2</td></tr>
        </tbody>
      </table>
    `;

    const mockWysiwyg = {
      tableControl: {
        selection: {
          node: div,
          rowStart: 1,
          rowEnd: 2,
          colStart: 0,
          colEnd: 1,
        }
      }
    };

    const range = getSelectedTableRange(div, mockWysiwyg);
    expect(range).not.toBeNull();
    expect(range?.rows).toEqual([1, 2]);
    expect(range?.cols).toEqual([0, 1]);
  });
});

import { TableEditor } from "../src/table-editor";
import { Point, Range as MTERange } from "@tgrosinger/md-advanced-tables";

class MockEditorForBatchDelete {
  public lines: string[];
  public selectedRows: number[] | null = null;
  public selectedCols: number[] | null = null;
  public cursorCoord = { row: 1, col: 0 };
  public dirty = false;

  constructor(text: string, selectedRows?: number[], selectedCols?: number[]) {
    this.lines = text.split("\n");
    this.selectedRows = selectedRows || null;
    this.selectedCols = selectedCols || null;
  }

  async reload() {}
  async flush() {}

  getCursorDomCoord() {
    return this.cursorCoord;
  }

  setPresetCellCoord(coord: any) {
    this.cursorCoord = coord;
  }

  getSelectedRows() {
    return this.selectedRows;
  }

  getSelectedCols() {
    return this.selectedCols;
  }

  getTableLines() {
    return [...this.lines];
  }

  setTableLines(lines: string[]) {
    this.lines = [...lines];
    this.dirty = true;
  }

  // ITextEditor stubs
  getCursorPosition() { return new Point(0, 0); }
  setCursorPosition() {}
  setSelectionRange() {}
  getLastRow() { return this.lines.length - 1; }
  acceptsTableEdit() { return true; }
  getLine(r: number) { return this.lines[r] ?? ""; }
  insertLine(r: number, line: string) { this.lines.splice(r, 0, line); }
  deleteLine(r: number) { this.lines.splice(r, 1); }
  replaceLines(s: number, e: number, l: string[]) { this.lines.splice(s, e - s, ...l); }
  transact(fn: () => void) { fn(); }
}

describe("TableEditor 批量删除集成", () => {
  it("通过 TableEditor.deleteRow 删除选中的多行", async () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |";
    const ctx = new MockEditorForBatchDelete(text, [1, 2]); // 选中第 1, 2 行数据行
    const te = new TableEditor(ctx as any);

    await te.deleteRow();

    expect(ctx.lines.length).toBe(3); // 表头 + 分隔行 + 数据行 5|6
    expect(ctx.lines[2]).toContain("5");
  });

  it("通过 TableEditor.deleteColumn 删除选中的多列", async () => {
    const text = "| A | B | C | D |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |";
    const ctx = new MockEditorForBatchDelete(text, undefined, [0, 2]); // 选中第 0, 2 列 (A, C)
    const te = new TableEditor(ctx as any);

    await te.deleteColumn();

    const headers = splitTableRow(ctx.lines[0]);
    expect(headers).toEqual(["B", "D"]);
    const data = splitTableRow(ctx.lines[2]);
    expect(data).toEqual(["2", "4"]);
  });
});

