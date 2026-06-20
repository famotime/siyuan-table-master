/**
 * table-model.ts 纯函数单元测试
 */

import { describe, it, expect } from "vitest";
import {
  parseTableKramdown,
  serializeTableKramdown,
  isSeparatorLine,
  splitTableRow,
  getColumnCount,
  getPipePosition,
  displayWidth,
  fixCJKSeparatorWidth,
  domCoordToRowModelIndex,
} from "../src/table-model";

describe("parseTableKramdown", () => {
  it("解析纯表格（无 IAL）", () => {
    const kramdown = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = parseTableKramdown(kramdown);

    expect(result.tableLines).toEqual([
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
    ]);
    expect(result.ialLine).toBeNull();
    expect(result.ialLineIndex).toBeNull();
  });

  it("解析带 IAL 的表格（思源特征）", () => {
    const kramdown =
      '| A | B |\n|---|---|\n| 1 | 2 |\n{: id="20240101-abc" data-node-id="20240101-abc"}';
    const result = parseTableKramdown(kramdown);

    expect(result.tableLines).toEqual([
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
    ]);
    expect(result.ialLine).toBe('{: id="20240101-abc" data-node-id="20240101-abc"}');
    expect(result.ialLineIndex).toBe(3);
  });

  it("解析带前后空行的表格", () => {
    const kramdown = "\n| A | B |\n|---|---|\n\n";
    const result = parseTableKramdown(kramdown);

    expect(result.tableLines).toEqual(["| A | B |", "|---|---|"]);
    expect(result.ialLine).toBeNull();
  });

  it("解析时自动过滤数据行中仅为单个短横杠 - 的单元格", () => {
    const kramdown = "| A | B |\n|---|---|\n| - | 2 |";
    const result = parseTableKramdown(kramdown);

    expect(result.tableLines).toEqual([
      "| A | B |",
      "|---|---|",
      "|  | 2 |",
    ]);
  });
});

describe("serializeTableKramdown", () => {
  it("表格行 + IAL 重新组合", () => {
    const tableLines = ["| A | B |", "|---|---|", "| 1 | 2 |"];
    const ialLine = '{: id="x"}';
    const result = serializeTableKramdown(tableLines, ialLine);

    expect(result).toBe('| A | B |\n|---|---|\n| 1 | 2 |\n{: id="x"}');
  });

  it("无 IAL 时不附加 IAL 行", () => {
    const tableLines = ["| A | B |", "|---|---|", "| 1 | 2 |"];
    const result = serializeTableKramdown(tableLines, null);

    expect(result).toBe("| A | B |\n|---|---|\n| 1 | 2 |");
  });

  it("往返一致性：parse → serialize 还原", () => {
    const original =
      '| A | B |\n|---|---|\n| 1 | 2 |\n{: id="20240101-abc" data-node-id="20240101-abc"}';
    const parsed = parseTableKramdown(original);
    const serialized = serializeTableKramdown(parsed.tableLines, parsed.ialLine);

    expect(serialized).toBe(original);
  });
});

describe("isSeparatorLine", () => {
  it("识别标准分隔行", () => {
    expect(isSeparatorLine("|---|---|")).toBe(true);
    expect(isSeparatorLine("| --- | --- |")).toBe(true);
  });

  it("识别带对齐的分隔行", () => {
    expect(isSeparatorLine("|:---|:---:|---:|")).toBe(true);
  });

  it("拒绝非分隔行", () => {
    expect(isSeparatorLine("| A | B |")).toBe(false);
    expect(isSeparatorLine("| 1 | 2 |")).toBe(false);
    expect(isSeparatorLine("普通文本")).toBe(false);
  });
});

describe("splitTableRow", () => {
  it("分割标准表格行", () => {
    expect(splitTableRow("| A | B | C |")).toEqual(["A", "B", "C"]);
  });

  it("处理转义管道符", () => {
    expect(splitTableRow("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });

  it("处理空单元格", () => {
    expect(splitTableRow("| A | | C |")).toEqual(["A", "", "C"]);
  });

  it("处理首尾空格", () => {
    expect(splitTableRow("|  A  |  B  |")).toEqual(["A", "B"]);
  });
});

describe("getColumnCount", () => {
  it("从表头行获取列数", () => {
    expect(getColumnCount(["| A | B | C |", "|---|---|---|"])).toBe(3);
    expect(getColumnCount(["| 只有一列 |", "|---|"])).toBe(1);
  });

  it("空数组返回 0", () => {
    expect(getColumnCount([])).toBe(0);
  });
});

describe("getPipePosition", () => {
  it("找到第 n 个管道符后的位置", () => {
    const line = "| A | B | C |";
    // 第 1 个 | 在位置 0，其后位置是 1
    expect(getPipePosition(line, 1)).toBe(1);
    // 第 2 个 | 在位置 4，其后位置是 5
    expect(getPipePosition(line, 2)).toBe(5);
  });

  it("跳过转义管道符", () => {
    const line = "| a \\| b | c |";
    // 第 1 个 | 位置 0 → 1
    expect(getPipePosition(line, 1)).toBe(1);
    // 第 2 个 |（跳过 \|）位置 9 → 10
    expect(getPipePosition(line, 2)).toBe(10);
  });

  it("超出数量返回行尾", () => {
    const line = "| A |";
    expect(getPipePosition(line, 10)).toBe(line.length);
  });
});

describe("displayWidth", () => {
  it("ASCII 字符宽度为 1", () => {
    expect(displayWidth("hello")).toBe(5);
    expect(displayWidth("ABC123")).toBe(6);
  });

  it("CJK 字符宽度为 2", () => {
    expect(displayWidth("你好")).toBe(4);
    expect(displayWidth("张三")).toBe(4);
  });

  it("中英混排", () => {
    expect(displayWidth("hi你好")).toBe(6); // 2 + 4
    expect(displayWidth("A张")).toBe(3); // 1 + 2
  });

  it("全角符号宽度为 2", () => {
    expect(displayWidth("，")).toBe(2);
    expect(displayWidth("。")).toBe(2);
  });
});

describe("fixCJKSeparatorWidth", () => {
  it("修正中文表头导致分隔行过宽", () => {
    const tableLines = [
      "| 姓名 | 年龄 |",
      "| ---- | ---- |",
      "| 张三 | 25   |",
    ];
    const result = fixCJKSeparatorWidth(tableLines);

    // CJK 对齐目标：显示宽度一致（而非字符长度一致）
    // 表头 "姓名" 显示宽度 4，分隔行破折号也应 4 个（显示宽度 4）
    // 数据 "张三" 显示宽度 4，"25" 显示宽度 2
    const headerCells = splitTableRow(result[0]);
    const sepCells = result[1].split("|").filter(s => s.trim() !== "");
    const dataCells = splitTableRow(result[2]);

    // 每列：表头显示宽度 = 分隔行破折号数 = 数据行 padding 后显示宽度
    for (let i = 0; i < headerCells.length; i++) {
      const headerW = displayWidth(headerCells[i]);
      const sepW = sepCells[i] ? sepCells[i].trim().length : 0;
      const dataW = displayWidth(dataCells[i]);

      // 分隔行破折号数应等于该列最大显示宽度
      expect(sepW).toBe(Math.max(headerW, dataW, 3));
    }
  });

  it("无 CJK 内容时不改变", () => {
    const tableLines = [
      "| Name | Age |",
      "| ---- | --- |",
      "| Bob  | 25  |",
    ];
    const result = fixCJKSeparatorWidth(tableLines);
    // ASCII 内容保持原样（宽度计算一致）
    expect(result[1]).toContain("---");
  });

  it("保留分隔行的居中对齐标记 :---:", () => {
    const tableLines = [
      "| Name | Score |",
      "|:----:|:-----:|",
      "| Alice| 100   |",
    ];
    const result = fixCJKSeparatorWidth(tableLines);
    const sepCells = splitTableRow(result[1]);
    // 每个分隔单元格都应以 : 开头并以 : 结尾
    for (const cell of sepCells) {
      expect(cell.trim().startsWith(":")).toBe(true);
      expect(cell.trim().endsWith(":")).toBe(true);
    }
  });

  it("保留分隔行的右对齐标记 ---:", () => {
    const tableLines = [
      "| Value |",
      "| ----: |",
      "| 12345 |",
    ];
    const result = fixCJKSeparatorWidth(tableLines);
    const sepCell = splitTableRow(result[1])[0].trim();
    expect(sepCell.startsWith(":")).toBe(false);
    expect(sepCell.endsWith(":")).toBe(true);
  });

  it("CJK 内容下保留对齐标记，同时修正宽度", () => {
    const tableLines = [
      "| 名称 | 分数 |",
      "|:---:|---:|",
      "| 爱丽丝 | 100 |",
    ];
    const result = fixCJKSeparatorWidth(tableLines);
    const sepCells = splitTableRow(result[1]);
    // 第 0 列：居中对齐，两侧都有冒号
    expect(sepCells[0].trim().startsWith(":")).toBe(true);
    expect(sepCells[0].trim().endsWith(":")).toBe(true);
    // 第 1 列：右对齐，仅右侧有冒号
    expect(sepCells[1].trim().startsWith(":")).toBe(false);
    expect(sepCells[1].trim().endsWith(":")).toBe(true);
  });

  it("非分隔行表格不处理", () => {
    const tableLines = ["| A | B |", "| 1 | 2 |"]; // 无分隔行
    const result = fixCJKSeparatorWidth(tableLines);
    expect(result).toEqual(tableLines);
  });
});

describe("domCoordToRowModelIndex", () => {
  it("表头行映射到核心库行 0", () => {
    const tableLines = ["| A | B |", "|---|---|", "| 1 | 2 |"];
    const result = domCoordToRowModelIndex(0, 0, tableLines);
    expect(result.row).toBe(0); // DOM 行 0 = 核心库行 0
  });

  it("第一行数据映射到核心库行 2（跳过分隔行）", () => {
    const tableLines = ["| A | B |", "|---|---|", "| 1 | 2 |"];
    const result = domCoordToRowModelIndex(1, 0, tableLines);
    expect(result.row).toBe(2); // DOM 行 1 = 核心库行 2
  });

  it("第二行数据映射到核心库行 3", () => {
    const tableLines = ["| A | B |", "|---|---|", "| 1 | 2 |", "| 3 | 4 |"];
    const result = domCoordToRowModelIndex(2, 0, tableLines);
    expect(result.row).toBe(3);
  });

  it("列偏移近似计算", () => {
    const tableLines = ["| A | B | C |", "|---|---|---|", "| 1 | 2 | 3 |"];
    // DOM 行 1 (tbody tr[0]) → 核心库行 2，DOM 列 0 → 第 2 个 | 后
    const result = domCoordToRowModelIndex(1, 0, tableLines);
    expect(result.row).toBe(2);
    expect(result.approxCol).toBeGreaterThan(0);
  });
});
