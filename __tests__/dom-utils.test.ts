/**
 * dom-utils.test.ts - DOM 工具纯函数测试
 *
 * 覆盖 dom-utils.ts 中不依赖真实 DOM 的纯逻辑函数。
 * getCellCoord / findTableBlock 等需要真实 DOM，不在本文件测试。
 */

import { describe, it, expect } from "vitest";
import { escapeHtml, getCellCoordFromTable } from "../src/dom-utils";

// ── escapeHtml ──

describe("escapeHtml", () => {
  it("转义 & < > \"", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });

  it("无特殊字符原样返回", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("空字符串返回空字符串", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("连续特殊字符", () => {
    expect(escapeHtml('<<>>&""')).toBe("&lt;&lt;&gt;&gt;&amp;&quot;&quot;");
  });
});

// ── getCellCoordFromTable（DOM 模拟） ──

describe("getCellCoordFromTable", () => {
  it("返回 null 当 table 不存在", () => {
    // 构造一个没有 table 子元素的 fake tableBlock
    const fakeBlock = { querySelector: () => null } as any;
    const fakeCell = {} as any;
    expect(getCellCoordFromTable(fakeCell, fakeBlock)).toBeNull();
  });
});
