/**
 * 烟雾测试：验证 @tgrosinger/md-advanced-tables 核心库可被正确 import 和调用
 * 
 * 这些测试覆盖：
 * - 核心库类型导出完整性
 * - InMemoryTextEditor 夹具正确性
 * - TableEditor 基本操作（格式化、导航、行列操作）
 * - 表格识别（cursorIsInTable）
 */

import { describe, it, expect } from "vitest";
import {
  TableEditor,
  Options,
  optionsWithDefaults,
  FormatType,
  Point,
  Range,
  Alignment,
  SortOrder,
  // 类型导入验证
  ITextEditor,
} from "@tgrosinger/md-advanced-tables";

import { InMemoryTextEditor } from "./helpers/InMemoryTextEditor";

// ── 1. 导入验证 ──

describe("M0.1 核心库导入与类型", () => {
  it("TableEditor 类可实例化", () => {
    const editor = new InMemoryTextEditor("");
    const te = new TableEditor(editor);
    expect(te).toBeDefined();
  });

  it("关键类型可使用", () => {
    const pt = new Point(1, 2);
    expect(pt.row).toBe(1);
    expect(pt.column).toBe(2);
    expect(pt.equals(new Point(1, 2))).toBe(true);

    const range = new Range(new Point(0, 0), new Point(1, 5));
    expect(range.start.row).toBe(0);
    expect(range.end.column).toBe(5);
  });

  it("optionsWithDefaults 可生成配置", () => {
    const opts = optionsWithDefaults({ formatType: FormatType.NORMAL });
    expect(opts.formatType).toBe(FormatType.NORMAL);
  });
});

// ── 2. InMemoryTextEditor 夹具验证 ──

describe("InMemoryTextEditor 夹具", () => {
  it("初始化文本并按行读取", () => {
    const editor = new InMemoryTextEditor("aaa\nbbb\nccc");
    expect(editor.getLine(0)).toBe("aaa");
    expect(editor.getLine(1)).toBe("bbb");
    expect(editor.getLine(2)).toBe("ccc");
    expect(editor.getLastRow()).toBe(2);
  });

  it("光标读写正确", () => {
    const editor = new InMemoryTextEditor("line1\nline2", new Point(1, 3));
    expect(editor.getCursorPosition().row).toBe(1);
    expect(editor.getCursorPosition().column).toBe(3);

    editor.setCursorPosition(new Point(0, 0));
    expect(editor.getCursorPosition().row).toBe(0);
  });

  it("replaceLines 正确替换范围", () => {
    const editor = new InMemoryTextEditor("a\nb\nc\nd");
    editor.replaceLines(1, 3, ["X", "Y"]);
    expect(editor.getText()).toBe("a\nX\nY\nd");
  });

  it("insertLine 和 deleteLine 正确", () => {
    const editor = new InMemoryTextEditor("a\nc");
    editor.insertLine(1, "b");
    expect(editor.getText()).toBe("a\nb\nc");

    editor.deleteLine(1);
    expect(editor.getText()).toBe("a\nc");
  });

  it("transact 包装无副作用", () => {
    const editor = new InMemoryTextEditor("hello");
    editor.transact(() => {
      editor.replaceLines(0, 1, ["world"]);
    });
    expect(editor.getText()).toBe("world");
  });
});

// ── 3. 表格识别 ──

describe("TableEditor.cursorIsInTable", () => {
  const opts = optionsWithDefaults({});

  it("光标在表格行内返回 true", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 2));
    const te = new TableEditor(editor);
    expect(te.cursorIsInTable(opts)).toBe(true);
  });

  it("光标在表格外的普通文本返回 false", () => {
    const text = "some text\n| A | B |\n|---|---|";
    const editor = new InMemoryTextEditor(text, new Point(0, 3));
    const te = new TableEditor(editor);
    expect(te.cursorIsInTable(opts)).toBe(false);
  });

  it("光标在分隔行（|---|---|）返回 true", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(1, 2));
    const te = new TableEditor(editor);
    expect(te.cursorIsInTable(opts)).toBe(true);
  });
});

// ── 4. 格式化 ──

describe("TableEditor.format", () => {
  it("格式化对齐不整齐的表格", () => {
    const text = "| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 3));
    const te = new TableEditor(editor);
    const opts = optionsWithDefaults({ formatType: FormatType.NORMAL });

    te.format(opts);

    const result = editor.getText();
    // 格式化后应该仍然是有效的 Markdown 表格
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3); // 至少保留原行数
    // 所有行应该包含 | 且宽度一致
    for (const line of lines) {
      expect(line).toContain("|");
    }
    // 第一行（表头）和分隔行长度一致
    expect(lines[0].length).toBe(lines[1].length);
  });

  it("格式化后光标保持合理位置", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 2));
    const te = new TableEditor(editor);
    const opts = optionsWithDefaults({});

    te.format(opts);

    const cursor = editor.getCursorPosition();
    // 光标仍在表格范围内
    expect(cursor.row).toBeGreaterThanOrEqual(0);
    expect(cursor.row).toBeLessThanOrEqual(editor.getLastRow());
  });
});

// ── 5. 行列操作 ──

describe("TableEditor 行列操作", () => {
  function createEditor(text: string, cursorRow = 2, cursorCol = 2) {
    return new InMemoryTextEditor(text, new Point(cursorRow, cursorCol));
  }
  const opts = optionsWithDefaults({});

  it("insertColumn 在光标列左侧插入空列", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = createEditor(text);
    const te = new TableEditor(editor);

    te.insertColumn(opts);

    const result = editor.getText();
    // 验证格式仍然是有效表格
    const lines = result.split("\n");
    for (const line of lines) {
      expect(line).toMatch(/^\|/);
    }
    // 分隔行应该多一个 --- 段
    const separatorLine = lines[1];
    const colCount = separatorLine.split("|").filter(s => s.trim().length > 0).length;
    expect(colCount).toBe(3); // 原来 2 列 → 3 列
  });

  it("insertRow 在光标行上方插入空行", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = createEditor(text);
    const te = new TableEditor(editor);

    te.insertRow(opts);

    const result = editor.getText();
    const lines = result.split("\n");
    expect(lines.length).toBe(4); // 原来是 3 行，插入后 4 行
  });

  it("deleteColumn 删除光标所在列", () => {
    const text = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |";
    const editor = createEditor(text);
    const te = new TableEditor(editor);

    te.deleteColumn(opts);

    const result = editor.getText();
    const headerCells = result.split("\n")[0].split("|").filter(s => s.trim() !== "");
    expect(headerCells.length).toBe(2); // 原来 3 列，删除后 2 列
  });

  it("deleteRow 删除光标所在行", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const editor = createEditor(text, 2, 2);
    const te = new TableEditor(editor);

    te.deleteRow(opts);

    const result = editor.getText();
    const lines = result.split("\n");
    expect(lines.length).toBe(3); // 原来 4 行，删除后 3 行
  });
});

// ── 6. 导航 ──

describe("TableEditor 导航", () => {
  const opts = optionsWithDefaults({});

  it("nextCell 在行末跳到下一行首列", () => {
    const text = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 4)); // "1 |"
    const te = new TableEditor(editor);

    te.nextCell(opts);

    const cursor = editor.getCursorPosition();
    // 应该移到下一列的单元格内容起始位置
    expect(cursor.row).toBe(2);
    expect(cursor.column).toBeGreaterThan(4);
  });

  it("nextRow 在最后一行新增行", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 2));
    const te = new TableEditor(editor);

    te.nextRow(opts);

    const result = editor.getText();
    const lines = result.split("\n");
    expect(lines.length).toBe(4); // 新增了一行
  });
});

// ── 7. 对齐 ──

describe("TableEditor 对齐", () => {
  const opts = optionsWithDefaults({});

  it("leftAlignColumn 设置列左对齐", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 2));
    const te = new TableEditor(editor);

    te.alignColumn(Alignment.LEFT, opts);

    const result = editor.getText();
    const separatorLine = result.split("\n")[1];
    expect(separatorLine).toContain(":---"); // 左对齐标记
  });

  it("centerAlignColumn 设置列居中对齐", () => {
    const text = "| A | B |\n|---|---|\n| 1 | 2 |";
    const editor = new InMemoryTextEditor(text, new Point(2, 4)); // B 列
    const te = new TableEditor(editor);

    te.alignColumn(Alignment.CENTER, opts);

    const result = editor.getText();
    const separatorLine = result.split("\n")[1];
    // 居中对齐标记为 :---: 或 :--:
    expect(separatorLine).toMatch(/:.*:/);
  });
});
