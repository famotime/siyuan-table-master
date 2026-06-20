/**
 * text-to-table.test.ts - 文本转表格纯函数测试
 *
 * 覆盖从 commands.ts 提取到 text-to-table.ts 的纯函数：
 * - parseLines: 多分隔符解析
 * - isBoxDrawingTable: 制图字符表格检测
 * - escapeHtml: HTML 转义
 * - gridToMarkdown: 二维网格 → GFM 表格
 */

import { describe, it, expect } from "vitest";
import {
  parseLines,
  isBoxDrawingTable,
  escapeHtml,
  gridToMarkdown,
  sanitizeValue,
} from "../src/text-to-table-utils";

// ── parseLines ──

describe("parseLines", () => {
  it("英文逗号分隔", () => {
    const lines = ["Name,Age,City", "Alice,30,Beijing", "Bob,25,Shanghai"];
    const result = parseLines(",", lines);
    expect(result).toEqual([
      ["Name", "Age", "City"],
      ["Alice", "30", "Beijing"],
      ["Bob", "25", "Shanghai"],
    ]);
  });

  it("中文逗号分隔", () => {
    const lines = ["姓名，年龄，城市", "张三，25，北京"];
    const result = parseLines("，", lines);
    expect(result).toEqual([
      ["姓名", "年龄", "城市"],
      ["张三", "25", "北京"],
    ]);
  });

  it("Tab 分隔", () => {
    const lines = ["Name\tAge", "Alice\t30"];
    const result = parseLines("\t", lines);
    expect(result).toEqual([
      ["Name", "Age"],
      ["Alice", "30"],
    ]);
  });

  it("空格分隔", () => {
    const lines = ["Name Age", "Alice 30"];
    const result = parseLines(" ", lines);
    expect(result).toEqual([
      ["Name", "Age"],
      ["Alice", "30"],
    ]);
  });

  it("自定义分隔符", () => {
    const lines = ["a|b|c", "d|e|f"];
    const result = parseLines("|", lines);
    expect(result).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("box-drawing 分隔符：过滤边框行", () => {
    const lines = [
      "┌──────┬─────┬────────┐",
      "│ Name │ Age │  City  │",
      "├──────┼─────┼────────┤",
      "│ Alice│ 30  │ Beijing│",
      "│ Bob  │ 25  │Shanghai│",
      "└──────┴─────┴────────┘",
    ];
    const result = parseLines("box-drawing", lines);
    expect(result).toEqual([
      ["Name", "Age", "City"],
      ["Alice", "30", "Beijing"],
      ["Bob", "25", "Shanghai"],
    ]);
  });

  it("box-drawing 分隔符：处理 ┃ 和 ║ 竖线", () => {
    const lines = [
      "┃ Col1 ┃ Col2 ┃",
      "┃ Data ┃ Test ┃",
    ];
    const result = parseLines("box-drawing", lines);
    expect(result).toEqual([
      ["Col1", "Col2"],
      ["Data", "Test"],
    ]);
  });

  it("box-drawing：空结果返回空数组", () => {
    const lines = [
      "┌──────┐",
      "└──────┘",
    ];
    const result = parseLines("box-drawing", lines);
    expect(result).toEqual([]);
  });

  it("逗号分隔：每行 trim", () => {
    const lines = ["  Name , Age  ", " Alice , 30 "];
    const result = parseLines(",", lines);
    expect(result).toEqual([
      ["Name", "Age"],
      ["Alice", "30"],
    ]);
  });
});

// ── isBoxDrawingTable ──

describe("isBoxDrawingTable", () => {
  it("识别含 2+ 行制图字符的文本", () => {
    const lines = [
      "┌────┬────┐",
      "│ A  │ B  │",
      "└────┴────┘",
    ];
    expect(isBoxDrawingTable(lines)).toBe(true);
  });

  it("仅 1 行制图字符返回 false", () => {
    const lines = ["┌────┬────┐", "A,B,C"];
    expect(isBoxDrawingTable(lines)).toBe(false);
  });

  it("无制图字符返回 false", () => {
    const lines = ["Name,Age", "Alice,30"];
    expect(isBoxDrawingTable(lines)).toBe(false);
  });

  it("空数组返回 false", () => {
    expect(isBoxDrawingTable([])).toBe(false);
  });
});

// ── escapeHtml ──

describe("escapeHtml", () => {
  it("转义 & < > \"", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });

  it("无特殊字符原样返回", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("空字符串返回空字符串", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ── gridToMarkdown ──

describe("gridToMarkdown", () => {
  it("生成标准 GFM 表格", () => {
    const grid = [
      ["Name", "Age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ];
    const result = gridToMarkdown(grid);
    expect(result).toBe(
      "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |"
    );
  });

  it("单行（仅表头）生成表头+分隔线", () => {
    const grid = [["A", "B", "C"]];
    const result = gridToMarkdown(grid);
    expect(result).toBe("| A | B | C |\n| --- | --- | --- |");
  });

  it("空网格返回空字符串", () => {
    expect(gridToMarkdown([])).toBe("");
  });

  it("不等长行以最大列数为基准补齐", () => {
    const grid = [
      ["A", "B", "C"],
      ["1"],
    ];
    const result = gridToMarkdown(grid);
    expect(result).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |");
  });
});

// ── sanitizeValue ──

describe("sanitizeValue", () => {
  it("普通正整数", () => {
    expect(sanitizeValue("123")).toBe(123);
    expect(sanitizeValue("  456  ")).toBe(456);
  });

  it("负数和小数", () => {
    expect(sanitizeValue("-123.45")).toBe(-123.45);
    expect(sanitizeValue("+0.12")).toBe(0.12);
  });

  it("百分数清洗", () => {
    expect(sanitizeValue("85%")).toBe(85);
    expect(sanitizeValue("-12.5%")).toBe(-12.5);
  });

  it("千分位和货币符号清洗", () => {
    expect(sanitizeValue("$1,234.56")).toBe(1234.56);
    expect(sanitizeValue("￥-12,345")).toBe(-12345);
  });

  it("非法文本与空单元格", () => {
    expect(sanitizeValue("")).toBe(0);
    expect(sanitizeValue("abc")).toBe(0);
    expect(sanitizeValue("-")).toBe(0);
    expect(sanitizeValue("   ")).toBe(0);
  });
});

