// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import {
  elementToMarkdown,
  getCellAlignment,
  htmlToNodeTable,
  convertHtmlTableToMarkdownKramdown,
  buildSiYuanTableCaption,
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

    it("含 <caption> 标题的普通 HTML 表格：标题适配为思源 IAL caption 属性，而非独立段落", () => {
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
      expect(res?.dataType).toBe("markdown");
      expect(res?.captionText).toBe("2024年销售数据统计表");
      // 不应包含独立段落块的前置换行文本，而是作为 IAL 属性追加
      expect(res?.data).toContain("| 项目 | 状态 |");
      expect(res?.data).toContain('{: caption="&lt;caption contenteditable=&quot;false&quot;&gt;2024年销售数据统计表&lt;/caption&gt;"}');
    });

    it("含 <caption> (caption-side: bottom) 的表格：正确生成包含 style 的 IAL 属性", () => {
      const html = `
        <table>
          <caption style="caption-side: bottom;">底部标题说明</caption>
          <thead>
            <tr><th>列1</th><th>列2</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>2</td></tr>
          </tbody>
        </table>
      `;
      const res = htmlToNodeTable(html);
      expect(res).not.toBeNull();
      expect(res?.captionText).toBe("底部标题说明");
      expect(res?.data).toContain('{: caption="&lt;caption contenteditable=&quot;false&quot; style=&quot;caption-side: bottom;&quot;&gt;底部标题说明&lt;/caption&gt;"}');
    });

    it("含 <caption> 且带合并单元格的 HTML 表格：生成单一 NodeTable 块，包含 caption 属性与原生 <caption> 元素，无 NodeParagraph 独立块", () => {
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
      // 验证没有 NodeParagraph 独立段落块
      expect(res?.data).not.toContain('data-type="NodeParagraph"');
      expect(res?.data).toContain('data-type="NodeTable"');
      expect(res?.data).toContain('<caption contenteditable="false">销售月报</caption>');
      expect(res?.data).toContain('caption="&lt;caption contenteditable=&quot;false&quot;&gt;销售月报&lt;/caption&gt;"');

      // 验证包含块属性: data-node-id, updated, colgroup
      expect(res?.data).toMatch(/<div data-node-id="\d{14}-[a-z0-9]{7}" data-type="NodeTable" class="table" updated="\d{14}" colgroup="\|" caption="[^"]+">/);
    });

    it("复杂 6 列跨行跨列表格转换为带 colgroup='|||||' 的 NodeTable DOM 块", () => {
      const html = `
        <table>
          <tbody>
            <tr>
              <td rowspan="2">区域</td>
              <td colspan="2">第一季度</td>
              <td colspan="2">第二季度</td>
              <td rowspan="2">年度总计</td>
            </tr>
            <tr>
              <td>销售额</td><td>完成率</td>
              <td>销售额</td><td>完成率</td>
            </tr>
          </tbody>
        </table>
      `;
      const res = htmlToNodeTable(html);
      expect(res).not.toBeNull();
      expect(res?.dataType).toBe("dom");
      expect(res?.data).toMatch(/colgroup="\|\|\|\|\|"/);
      expect(res?.data).toMatch(/data-node-id="\d{14}-[a-z0-9]{7}"/);
      expect(res?.data).toMatch(/updated="\d{14}"/);
    });
  });

  describe("convertHtmlTableToMarkdownKramdown 提取 HTML 表格与 caption", () => {
    it("将 HTML 表格转为 Kramdown 并将 <caption> 转化为 IAL caption 属性", () => {
      const html = `
        <table>
          <caption>季度销售清单</caption>
          <tr><th>品类</th><th>销量</th></tr>
          <tr><td>数码</td><td>500</td></tr>
        </table>
      `;
      const res = convertHtmlTableToMarkdownKramdown(html);
      expect(res).not.toBeNull();
      expect(res?.tableLines).toEqual([
        "| 品类 | 销量 |",
        "| --- | --- |",
        "| 数码 | 500 |",
      ]);
      expect(res?.ialLine).toBe('{: caption="&lt;caption contenteditable=&quot;false&quot;&gt;季度销售清单&lt;/caption&gt;"}');
    });

    it("已有 IAL 行时合并 caption 属性", () => {
      const html = `
        <table>
          <caption style="caption-side: bottom">汇总表</caption>
          <tr><th>A</th><th>B</th></tr>
          <tr><td>1</td><td>2</td></tr>
        </table>
        {: id="20240101-1234567" updated="20240101120000"}
      `;
      const res = convertHtmlTableToMarkdownKramdown(html);
      expect(res).not.toBeNull();
      expect(res?.ialLine).toContain('id="20240101-1234567"');
      expect(res?.ialLine).toContain('caption="&lt;caption contenteditable=&quot;false&quot; style=&quot;caption-side: bottom;&quot;&gt;汇总表&lt;/caption&gt;"');
    });
  });
});
