import { describe, it, expect, vi } from "vitest";
import {
  stripMarkdown,
  parseTableGrid,
  generateExportFilename,
  formatCSV,
} from "../src/table-export";

describe("table-export module", () => {
  describe("stripMarkdown", () => {
    it("should strip bold, italic and strikethrough", () => {
      expect(stripMarkdown("**粗体** 与 *斜体* 以及 ~~删除线~~")).toBe("粗体 与 斜体 以及 删除线");
      expect(stripMarkdown("__粗体__ 与 _斜体_")).toBe("粗体 与 斜体");
    });

    it("should strip markdown links and images", () => {
      expect(stripMarkdown("查看 [思源笔记](https://b3log.org/siyuan)")).toBe("查看 思源笔记");
      expect(stripMarkdown("图标 ![logo](https://example.com/logo.png)")).toBe("图标 logo");
    });

    it("should strip inline code and html tags", () => {
      expect(stripMarkdown("代码 `const a = 1;` 标签 <span>Hello</span><br/>World")).toBe("代码 const a = 1; 标签 Hello\nWorld");
    });

    it("should unescape escaped pipes", () => {
      expect(stripMarkdown("单元格\\|包含管道符")).toBe("单元格|包含管道符");
    });
  });

  describe("parseTableGrid", () => {
    it("should parse Kramdown table lines excluding separator line", () => {
      const tableLines = [
        "| 姓名 | **年龄** | [城市](http://example.com) |",
        "| --- | --- | --- |",
        "| 张三 | 25 | 北京 |",
        "| *李四* | ~~30~~ | 上海<br/>浦东 |",
      ];

      const grid = parseTableGrid(tableLines);

      expect(grid).toEqual([
        ["姓名", "年龄", "城市"],
        ["张三", "25", "北京"],
        ["李四", "30", "上海\n浦东"],
      ]);
    });
  });

  describe("generateExportFilename", () => {
    it("should generate timestamped filename with requested extension", () => {
      const mockDate = new Date(2026, 7, 2, 12, 5, 30); // 2026-08-02 12:05:30
      expect(generateExportFilename("csv", mockDate)).toBe("表格导出_20260802_120530.csv");
      expect(generateExportFilename("xlsx", mockDate)).toBe("表格导出_20260802_120530.xlsx");
    });
  });

  describe("formatCSV", () => {
    it("should format 2D grid into UTF-8 BOM CSV text with proper escaping", () => {
      const grid = [
        ["Header 1", "Header 2", "Header 3"],
        ["Normal", 'With "Quotes"', "With, Comma"],
        ["With\nNewline", "Normal 2", "123"],
      ];

      const csv = formatCSV(grid);

      // Check BOM prefix
      expect(csv.startsWith("\uFEFF")).toBe(true);

      const content = csv.slice(1);
      const lines = content.split("\r\n");

      expect(lines[0]).toBe("Header 1,Header 2,Header 3");
      expect(lines[1]).toBe('Normal,"With ""Quotes""","With, Comma"');
      expect(lines[2]).toBe('"With\nNewline",Normal 2,123');
    });
  });
});
