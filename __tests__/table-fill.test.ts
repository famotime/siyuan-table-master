import { describe, it, expect } from "vitest";
import {
  smartIncrement,
  fillColumnDown,
  fillRowRight,
  fillTable,
  domRowToLineIndex,
  getTotalDomRows,
} from "../src/table-fill-utils";

describe("table-fill-utils 智能填充纯函数测试", () => {
  describe("smartIncrement 递增规则", () => {
    it("处理空字符串与空白", () => {
      expect(smartIncrement("", 1)).toBe("");
      expect(smartIncrement("   ", 1)).toBe("");
    });

    it("纯正整数递增", () => {
      expect(smartIncrement("1", 1)).toBe("2");
      expect(smartIncrement("1", 2)).toBe("3");
      expect(smartIncrement("10", 1)).toBe("11");
      expect(smartIncrement("10", 5)).toBe("15");
    });

    it("带符号整数递增", () => {
      expect(smartIncrement("-5", 1)).toBe("-4");
      expect(smartIncrement("-5", 5)).toBe("0");
      expect(smartIncrement("-5", 6)).toBe("1");
      expect(smartIncrement("+3", 1)).toBe("4");
    });

    it("带前导零的整数递增并保持格式宽度", () => {
      expect(smartIncrement("01", 1)).toBe("02");
      expect(smartIncrement("01", 9)).toBe("10");
      expect(smartIncrement("001", 1)).toBe("002");
      expect(smartIncrement("001", 9)).toBe("010");
      expect(smartIncrement("001", 99)).toBe("100");
      expect(smartIncrement("0007", 3)).toBe("0010");
    });

    it("浮点数递增并保持小数位数", () => {
      expect(smartIncrement("1.5", 1)).toBe("2.5");
      expect(smartIncrement("1.5", 2)).toBe("3.5");
      expect(smartIncrement("0.05", 1)).toBe("1.05");
      expect(smartIncrement("3.14", 1)).toBe("4.14");
      expect(smartIncrement("-1.5", 1)).toBe("-0.5");
    });

    it("序号类混合文本智能递增", () => {
      expect(smartIncrement("第1期", 1)).toBe("第2期");
      expect(smartIncrement("第1期", 2)).toBe("第3期");
      expect(smartIncrement("Task-01", 1)).toBe("Task-02");
      expect(smartIncrement("Task-01", 9)).toBe("Task-10");
      expect(smartIncrement("Item 1 (draft)", 1)).toBe("Item 2 (draft)");
      expect(smartIncrement("A001B", 1)).toBe("A002B");
      expect(smartIncrement("2024-Q1", 1)).toBe("2024-Q2");
      expect(smartIncrement("步骤 1：准备", 1)).toBe("步骤 2：准备");
    });

    it("纯文本原样复制", () => {
      expect(smartIncrement("苹果", 1)).toBe("苹果");
      expect(smartIncrement("Hello World", 1)).toBe("Hello World");
      expect(smartIncrement("待办事项", 2)).toBe("待办事项");
      expect(smartIncrement("---", 1)).toBe("---");
    });
  });

  describe("DOM 行号与行模型索引映射", () => {
    it("正确计算 domRowToLineIndex", () => {
      expect(domRowToLineIndex(0)).toBe(0); // 表头
      expect(domRowToLineIndex(1)).toBe(2); // 第一行数据（跳过分隔行1）
      expect(domRowToLineIndex(2)).toBe(3);
    });

    it("正确计算 getTotalDomRows", () => {
      const sampleLines = [
        "| 表头1 | 表头2 |",
        "| :--- | :--- |",
        "| 数据1 | 数据2 |",
        "| 数据3 | 数据4 |",
      ];
      expect(getTotalDomRows(sampleLines)).toBe(3); // 表头 + 2行数据
    });
  });

  describe("fillColumnDown 向下填充", () => {
    const tableLines = [
      "| 序号 | 任务 | 状态 |",
      "| :--- | :--- | :--- |",
      "| 1 | Task-01 | 待处理 |",
      "| | | |",
      "| | | |",
    ];

    it("数字列向下填充递增", () => {
      const res = fillColumnDown(tableLines, 1, 0); // 从第1行数据（DOM row 1，即第0列为 "1"）向下填充
      expect(res[2]).toBe("| 1 | Task-01 | 待处理 |");
      expect(res[3]).toBe("| 2 |  |  |");
      expect(res[4]).toBe("| 3 |  |  |");
    });

    it("序号文本向下填充递增", () => {
      const res = fillColumnDown(tableLines, 1, 1); // 第1列 "Task-01"
      expect(res[2]).toBe("| 1 | Task-01 | 待处理 |");
      expect(res[3]).toBe("|  | Task-02 |  |");
      expect(res[4]).toBe("|  | Task-03 |  |");
    });

    it("纯文本向下填充原样复制", () => {
      const res = fillColumnDown(tableLines, 1, 2); // 第2列 "待处理"
      expect(res[2]).toBe("| 1 | Task-01 | 待处理 |");
      expect(res[3]).toBe("|  |  | 待处理 |");
      expect(res[4]).toBe("|  |  | 待处理 |");
    });

    it("到达末尾行时调用不做任何修改", () => {
      const res = fillColumnDown(tableLines, 3, 0); // DOM row 3 是最末行（数据行第3行）
      expect(res).toEqual(tableLines);
    });
  });

  describe("fillRowRight 向右填充", () => {
    const tableLines = [
      "| 季度1 | | |",
      "| :--- | :--- | :--- |",
      "| 100 | 200 | 300 |",
      "| 计划 | | |",
    ];

    it("表头序号向右填充递增", () => {
      const res = fillRowRight(tableLines, 0, 0); // 表头 "季度1"
      expect(res[0]).toBe("| 季度1 | 季度2 | 季度3 |");
    });

    it("纯文本行向右填充复制", () => {
      const res = fillRowRight(tableLines, 2, 0); // DOM row 2 为第2行数据 "计划"
      expect(res[3]).toBe("| 计划 | 计划 | 计划 |");
    });

    it("到达最右列时调用不做任何修改", () => {
      const res = fillRowRight(tableLines, 0, 2);
      expect(res).toEqual(tableLines);
    });
  });

  describe("fillTable 综合填充", () => {
    const baseTable = [
      "| 序号 | 编码 | 分类 |",
      "| :--- | :--- | :--- |",
      "| 001 | A-1 | 类别A |",
      "| | | |",
      "| | | |",
      "| | | |",
    ];

    it("无多选区单光标向下填充至表格底部", () => {
      const res = fillTable(baseTable, { row: 1, col: 0 }, null, null, "down");
      expect(res[2]).toBe("| 001 | A-1 | 类别A |");
      expect(res[3]).toBe("| 002 |  |  |");
      expect(res[4]).toBe("| 003 |  |  |");
      expect(res[5]).toBe("| 004 |  |  |");
    });

    it("有多行选区时仅向下填充至选区结束行", () => {
      // 选中第 1, 2 行（DOM row 1, 2），第 3 行不应被填充
      const res = fillTable(baseTable, { row: 1, col: 0 }, [1, 2], [0], "down");
      expect(res[2]).toBe("| 001 | A-1 | 类别A |");
      expect(res[3]).toBe("| 002 |  |  |");
      expect(res[4]).toBe("| | | |");
      expect(res[5]).toBe("| | | |");
    });

    it("多列选中时批量向下填充", () => {
      // 选中第 1, 2, 3 行，第 0, 1 列
      const res = fillTable(baseTable, { row: 1, col: 0 }, [1, 2, 3], [0, 1], "down");
      expect(res[2]).toBe("| 001 | A-1 | 类别A |");
      expect(res[3]).toBe("| 002 | A-2 |  |");
      expect(res[4]).toBe("| 003 | A-3 |  |");
      expect(res[5]).toBe("| | | |");
    });

    it("多行选中时批量向右填充", () => {
      const rowBase = [
        "| 项目 | | |",
        "| :--- | :--- | :--- |",
        "| 1 | | |",
        "| 10 | | |",
      ];
      const res = fillTable(rowBase, { row: 1, col: 0 }, [1, 2], [0, 1, 2], "right");
      expect(res[2]).toBe("| 1 | 2 | 3 |");
      expect(res[3]).toBe("| 10 | 11 | 12 |");
    });
  });
});
