// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import {
  elementToMarkdown,
  getCellAlignment,
  htmlToNodeTable,
} from "../src/html-to-md";

describe("html-to-md 单元测试", () => {
  describe("elementToMarkdown 内联样式转换", () => {
    it("加粗 <b> 和 <strong>", () => {
      const div = document.createElement("div");
      div.innerHTML = "<b>Bold 1</b> and <strong>Bold 2</strong>";
      expect(elementToMarkdown(div)).toBe("**Bold 1** and **Bold 2**");
    });

    it("斜体 <i> 和 <em>", () => {
      const div = document.createElement("div");
      div.innerHTML = "<i>Italic 1</i> and <em>Italic 2</em>";
      expect(elementToMarkdown(div)).toBe("*Italic 1* and *Italic 2*");
    });

    it("行内代码 <code> 和 删除线 <del>/<s>", () => {
      const div = document.createElement("div");
      div.innerHTML = "<code>code</code> and <del>deleted</del>";
      expect(elementToMarkdown(div)).toBe("`code` and ~~deleted~~");
    });

    it("超链接 <a>", () => {
      const div = document.createElement("div");
      div.innerHTML = '<a href="https://siyuan-note.org">思源</a>';
      expect(elementToMarkdown(div)).toBe("[思源](https://siyuan-note.org)");
    });

    it("换行符 <br>", () => {
      const div = document.createElement("div");
      div.innerHTML = "Line1<br>Line2";
      expect(elementToMarkdown(div)).toBe("Line1<br>Line2");
    });

    it("管道符 | 转义", () => {
      const div = document.createElement("div");
      div.innerHTML = "A | B | C";
      expect(elementToMarkdown(div)).toBe("A \\| B \\| C");
    });
  });

  describe("getCellAlignment 对齐方式解析", () => {
    it("解析 align 属性", () => {
      const td = document.createElement("td");
      td.setAttribute("align", "center");
      expect(getCellAlignment(td)).toBe("center");
    });

    it("解析 style text-align 属性", () => {
      const td = document.createElement("td");
      td.setAttribute("style", "text-align: right; color: red;");
      expect(getCellAlignment(td)).toBe("right");
    });

    it("默认未设对齐返回空字符串", () => {
      const td = document.createElement("td");
      expect(getCellAlignment(td)).toBe("");
    });
  });

  describe("htmlToNodeTable 转换策略与 caption 处理", () => {
    it("无合并单元格 HTML 表格转换为 dataType=markdown", () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th align="left">项目</th>
              <th align="center">状态</th>
              <th align="right">预算</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>开发</b></td>
              <td>进行中</td>
              <td>10,000</td>
            </tr>
          </tbody>
        </table>
      `;
      const res = htmlToNodeTable(html);
      expect(res).not.toBeNull();
      expect(res?.dataType).toBe("markdown");
      expect(res?.data).toContain("| 项目 | 状态 | 预算 |");
      expect(res?.data).toContain("| :--- | :---: | ---: |");
      expect(res?.data).toContain("| **开发** | 进行中 | 10,000 |");
    });

    it("含 <caption> 标题的 HTML 表格：标题提取为独立行，表格本身移除 caption 属性及标签", () => {
      const html = `
        <table>
          <caption style="font-size: 16px">2024年销售数据统计表</caption>
          <thead>
            <tr>
              <th align="left">项目</th>
              <th align="center">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>项目A</td>
              <td>完成</td>
            </tr>
          </tbody>
        </table>
      `;
      const res = htmlToNodeTable(html);
      expect(res).not.toBeNull();
      expect(res?.captionText).toBe("2024年销售数据统计表");
      expect(res?.data.startsWith("2024年销售数据统计表")).toBe(true);
      expect(res?.data).not.toContain("<caption");
    });

    it("含 <caption> 且带合并单元格的 HTML 表格：标题作为独立 NodeParagraph 块，表格作为独立 NodeTable 块", () => {
      const html = `
        <table>
          <caption>销售月报</caption>
          <tbody>
            <tr>
              <td colspan="2">合并单元格</td>
            </tr>
          </tbody>
        </table>
      `;
      const res = htmlToNodeTable(html);
      expect(res).not.toBeNull();
      expect(res?.dataType).toBe("dom");
      expect(res?.captionText).toBe("销售月报");
      expect(res?.data).toContain('data-type="NodeParagraph"');
      expect(res?.data).toContain('销售月报');
      expect(res?.data).toContain('data-type="NodeTable"');
      expect(res?.data).not.toContain("<caption");
    });
  });
});
