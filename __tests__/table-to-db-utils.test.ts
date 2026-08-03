import { describe, test, expect } from "vitest";
import { inferColumnType, parseTableDataForDb } from "../src/table-to-db-utils";

describe("table-to-db-utils inferColumnType", () => {
  test("Column 0 always defaults to text", () => {
    expect(inferColumnType(0, ["100", "200", "300"])).toBe("text");
    expect(inferColumnType(0, ["true", "false"])).toBe("text");
  });

  test("Infers checkbox type", () => {
    expect(inferColumnType(1, ["true", "false", "true"])).toBe("checkbox");
    expect(inferColumnType(1, ["是", "否", "是"])).toBe("checkbox");
    expect(inferColumnType(1, ["[ ]", "[x]", "[ ]"])).toBe("checkbox");
    expect(inferColumnType(1, ["✓", "✗"])).toBe("checkbox");
  });

  test("Infers url type", () => {
    expect(inferColumnType(1, ["https://siyuan-note.pro", "http://github.com"])).toBe("url");
    expect(inferColumnType(1, ["www.google.com"])).toBe("url");
  });

  test("Infers date type", () => {
    expect(inferColumnType(1, ["2026-08-03", "2024/01/15", "2025.12.31"])).toBe("date");
    expect(inferColumnType(1, ["2026-08-03 14:00"])).toBe("date");
  });

  test("Infers number type", () => {
    expect(inferColumnType(1, ["100", "250.5", "-30"])).toBe("number");
    expect(inferColumnType(1, ["$1,000", "99.5%", "¥500"])).toBe("number");
  });

  test("Infers mSelect type when delimiters are present", () => {
    expect(inferColumnType(1, ["苹果, 香蕉", "葡萄, 桔子"])).toBe("mSelect");
    expect(inferColumnType(1, ["标签A; 标签B", "标签C"])).toBe("mSelect");
  });

  test("Infers select type for repetitive low-cardinality values", () => {
    expect(inferColumnType(1, ["已完成", "进行中", "已完成", "未开始", "进行中"])).toBe("select");
  });

  test("Fallbacks to text for mixed or empty values", () => {
    expect(inferColumnType(1, ["", "   "])).toBe("text");
    expect(inferColumnType(1, ["100", "abc", "2026-01-01"])).toBe("text");
  });
});

describe("table-to-db-utils parseTableDataForDb", () => {
  test("Parses headers, fills missing header names, and infers columns correctly", () => {
    const rawHeaders = ["任务名称", "", "完成度", "完成状态"];
    const rawRows = [
      ["设计原型", "2026-08-01", "100%", "已完成"],
      ["编写代码", "2026-08-02", "50%", "进行中"],
      ["测试功能", "2026-08-03", "0%", "未开始"]
    ];

    const result = parseTableDataForDb(rawHeaders, rawRows);

    expect(result.headers).toEqual(["任务名称", "列 2", "完成度", "完成状态"]);
    expect(result.columns[0].selectedType).toBe("text"); // 第一列为文本
    expect(result.columns[1].selectedType).toBe("date"); // 日期
    expect(result.columns[2].selectedType).toBe("number"); // 数字 (百分比)
    expect(result.columns[3].selectedType).toBe("select"); // 单选
  });
});
