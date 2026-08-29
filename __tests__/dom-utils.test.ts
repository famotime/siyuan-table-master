/**
 * dom-utils.test.ts - DOM 工具纯函数测试
 *
 * 覆盖 dom-utils.ts 中不依赖真实 DOM 的纯逻辑函数。
 * getCellCoord / findTableBlock 等需要真实 DOM，不在本文件测试。
 */

import { describe, it, expect } from "vitest";
import { escapeHtml, getCellCoordFromTable } from "../src/dom-utils";
import { icons } from "../src/utils/icons";
import { SVG_ICONS } from "../src/dock";

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

// ── icons 定义与区分性测试 ──

describe("icons", () => {
  it("应定义 freezeHeader 与 freezeCol 并生成有效 SVG", () => {
    expect(icons.freezeHeader).toBeDefined();
    expect(icons.freezeCol).toBeDefined();

    expect(icons.freezeHeader).toContain("<svg");
    expect(icons.freezeHeader).toContain("</svg>");
    expect(icons.freezeCol).toContain("<svg");
    expect(icons.freezeCol).toContain("</svg>");
  });

  it("freezeHeader 与 freezeCol 图标应具有区分性特征", () => {
    // 两个图标不应相同
    expect(icons.freezeHeader).not.toBe(icons.freezeCol);

    // freezeHeader 为横向表头冻结特征（包含 M3 9h18 水平分割线与顶部 cy="6" 特征）
    expect(icons.freezeHeader).toContain('d="M3 9h18"');
    expect(icons.freezeHeader).toContain('cy="6"');

    // freezeCol 为纵向首列冻结特征（包含 M9 3v18 垂直分割线与首列 cx="6" 特征）
    expect(icons.freezeCol).toContain('d="M9 3v18"');
    expect(icons.freezeCol).toContain('cx="6"');
  });

  it("icons.transpose 应与侧边栏 SVG_ICONS['transpose'] 的图形路径保持一致", () => {
    expect(icons.transpose).toBeDefined();
    expect(icons.transpose).toContain('viewBox="0 0 32 32"');
    expect(icons.transpose).toContain('class="at-svg-fill"');
    // 提取 path d 比较
    const extractD = (svg: string) => svg.match(/d="([^"]+)"/)?.[1];
    expect(extractD(icons.transpose)).toBe(extractD(SVG_ICONS["transpose"]));
  });

  it("所有图标均应为闭合的 SVG 字符串并带有 viewBox", () => {
    for (const [key, svg] of Object.entries(icons)) {
      expect(svg, `图标 ${key} 应包含 <svg 标签`).toContain("<svg");
      expect(svg, `图标 ${key} 应以 </svg> 结尾`).toMatch(/<\/svg>$/);
      expect(svg, `图标 ${key} 应具有标准 viewBox`).toMatch(/viewBox="0 0 \d+ \d+"/);
    }
  });
});
