// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  stripSpanStyle,
  positiveSpan,
  parseCssNumber,
  splitMdRow,
  mdAlignOf,
  parseMdCell,
  markdownToHtmlTable,
  createCell,
} from "../src/html-dialog-utils";

describe("html-dialog-utils", () => {
  describe("sanitizeHtml", () => {
    it("保留安全标签与文本", () => {
      const input = "<b>加粗</b> <i>斜体</i> <span>文本</span>";
      expect(sanitizeHtml(input)).toBe("<b>加粗</b> <i>斜体</i> <span>文本</span>");
    });

    it("过滤危险脚本和事件属性", () => {
      const input = '<span onclick="alert(1)">点击</span><script>alert(2)</script>';
      expect(sanitizeHtml(input)).toBe("<span>点击</span>");
    });

    it("保留允许的内联样式 (color, background-color, text-decoration)", () => {
      const input = '<span style="color: red; font-size: 20px; text-decoration: underline;">文本</span>';
      const output = sanitizeHtml(input);
      expect(output).toContain("color:red");
      expect(output).toContain("text-decoration:underline");
      expect(output).not.toContain("font-size");
    });
  });

  describe("stripSpanStyle", () => {
    it("移除 span 中的指定样式属性", () => {
      const input = '<span style="color:red; background-color:blue;">文本</span>';
      const strippedColor = stripSpanStyle(input, "color");
      expect(strippedColor).toContain("background-color:blue");
      expect(strippedColor).not.toContain("color:red");
    });
  });

  describe("positiveSpan & parseCssNumber", () => {
    it("positiveSpan 解析正整数与兜底", () => {
      expect(positiveSpan("3")).toBe(3);
      expect(positiveSpan("0", 1)).toBe(1);
      expect(positiveSpan("-2", 1)).toBe(1);
      expect(positiveSpan(null, 1)).toBe(1);
      expect(positiveSpan("abc", 1)).toBe(1);
    });

    it("parseCssNumber 解析范围内的浮点数", () => {
      expect(parseCssNumber("14", 0, 100)).toBe(14);
      expect(parseCssNumber("1.5", 0, 10)).toBe(1.5);
      expect(parseCssNumber("-5", 0, 100)).toBe("");
      expect(parseCssNumber("150", 0, 100)).toBe("");
      expect(parseCssNumber(null)).toBe("");
    });
  });

  describe("splitMdRow & mdAlignOf", () => {
    it("splitMdRow 正确分割单元格并处理转义管道符", () => {
      expect(splitMdRow("| A | B \\| C | D |")).toEqual(["A", "B | C", "D"]);
    });

    it("mdAlignOf 识别对齐方式", () => {
      expect(mdAlignOf(":---:")).toBe("center");
      expect(mdAlignOf("---:")).toBe("right");
      expect(mdAlignOf(":---")).toBe("left");
      expect(mdAlignOf("---")).toBe("");
    });
  });

  describe("parseMdCell", () => {
    it("解析普通单元格", () => {
      expect(parseMdCell("内容")).toEqual({
        text: "内容",
        colSpan: 1,
        rowSpan: 1,
        covered: false,
      });
    });

    it("解析带有 colspan 和 rowspan 属性的单元格", () => {
      const result = parseMdCell('合并单元格{: colspan="2" rowspan="3"}');
      expect(result).toEqual({
        text: "合并单元格",
        colSpan: 2,
        rowSpan: 3,
        covered: false,
      });
    });

    it("识别被覆盖的单元格 (fn__none)", () => {
      const result = parseMdCell('{: class="fn__none"}');
      expect(result.covered).toBe(true);
    });
  });

  describe("markdownToHtmlTable", () => {
    it("将标准 Markdown 表格转换为 HTML table", () => {
      const md = `
| 姓名 | 年龄 | 城市 |
| :--- | :---: | ---: |
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |
      `.trim();

      const html = markdownToHtmlTable(md);
      expect(html).not.toBeNull();
      expect(html).toContain("<table>");
      expect(html).toContain("</table>");
      expect(html).toContain('<td style="text-align: left">张三</td>');
      expect(html).toContain('<td style="text-align: center">25</td>');
      expect(html).toContain('<td style="text-align: right">北京</td>');
    });

    it("转换 Markdown 内联标记（加粗、斜体、链接、删除线）", () => {
      const md = `
| 项目 | 描述 |
| --- | --- |
| **加粗** | *斜体* 与 [链接](https://example.com) |
      `.trim();

      const html = markdownToHtmlTable(md);
      expect(html).not.toBeNull();
      expect(html).toContain("加粗");
      expect(html).toContain("斜体");
      expect(html).toContain("链接");
    });

    it("支持从 IAL caption 属性还原 <caption> 标签", () => {
      const md = `
| 标题1 | 标题2 |
| --- | --- |
| 1 | 2 |
{: id="20240101-1234567" caption="&lt;caption contenteditable=&quot;false&quot;&gt;统计报表&lt;/caption&gt;"}
      `.trim();

      const html = markdownToHtmlTable(md);
      expect(html).not.toBeNull();
      expect(html).toContain("<caption>统计报表</caption>");
    });

    it("支持从带 style 的 IAL caption 属性还原 <caption> 标签", () => {
      const md = `
| 标题1 | 标题2 |
| --- | --- |
| 1 | 2 |
{: caption="&lt;caption contenteditable=&quot;false&quot; style=&quot;caption-side: bottom;&quot;&gt;底部标题&lt;/caption&gt;"}
      `.trim();

      const html = markdownToHtmlTable(md);
      expect(html).not.toBeNull();
      expect(html).toContain('<caption style="caption-side: bottom;">底部标题</caption>');
    });

    it("行数不足或缺少分隔行时返回 null", () => {
      expect(markdownToHtmlTable("| 单行 |")).toBeNull();
      expect(markdownToHtmlTable("不是表格内容")).toBeNull();
    });
  });

  describe("createCell", () => {
    it("创建默认 CellData 对象", () => {
      const cell = createCell(0, 1, { content: "测试" });
      expect(cell.r).toBe(0);
      expect(cell.c).toBe(1);
      expect(cell.content).toBe("测试");
      expect(cell.rowSpan).toBe(1);
      expect(cell.colSpan).toBe(1);
      expect(cell.style.alignH).toBe("align-h-left");
      expect(cell.style.alignV).toBe("align-v-middle");
      expect(cell.el).toBeNull();
    });
  });
});
