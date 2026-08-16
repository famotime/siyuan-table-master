/**
 * html-clipboard.ts - 外部表格剪贴板清洗与结构标准化
 *
 * 针对从 Word、Excel、WPS、网页等复制的复杂富文本表格：
 * 1. 过滤 MSO 垃圾标签 (mso-*, o:p, Office xml 命名空间)
 * 2. 补齐与规范化 thead / tbody / tr / td 结构
 * 3. 严格清洗 XSS 风险脚本，保留安全文字与视觉样式
 */

import { sanitizeHtml } from "./html-dialog-utils";

/**
 * 剥离 Office MSO 专有命名空间、标签与垃圾属性
 */
export function stripOfficeMsoTags(html: string): string {
  if (!html) return "";

  let s = html;

  // 1. 清理 HTML 条件注释，如 <!--[if gte mso 9]> ... <![endif]-->
  s = s.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // 2. 清理 <o:p>、<w:WordDocument> 等 Office XML 标签
  s = s.replace(/<\/?(?:o|w|x|p|v):[^>]*>/gi, "");

  // 3. 清理 style 属性中的 mso-* 样式项
  s = s.replace(/style\s*=\s*["']([^"']*)["']/gi, (_, styleVal) => {
    const rules = styleVal.split(";");
    const cleanRules = rules.filter((r: string) => {
      const trimmed = r.trim().toLowerCase();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("mso-") &&
        !trimmed.startsWith("panose-") &&
        !trimmed.startsWith("tab-stops:")
      );
    });
    return cleanRules.length > 0 ? `style="${cleanRules.join(";")}"` : "";
  });

  // 4. 清理冗余的 class="Mso*"
  s = s.replace(/\s*class\s*=\s*["']Mso[^"']*["']/gi, "");

  return s;
}

/**
 * 标准化并补齐 HTML 表格结构 (tbody / thead 补全与安全净化)
 */
export function normalizeHtmlTable(html: string): string {
  if (!html) return "";

  const cleanedMso = stripOfficeMsoTags(html);

  // 若不包含 table 标签，尝试包装
  let tableHtml = cleanedMso;
  if (!tableHtml.toLowerCase().includes("<table")) {
    if (tableHtml.toLowerCase().includes("<tr") || tableHtml.toLowerCase().includes("<td")) {
      tableHtml = `<table>${tableHtml}</table>`;
    } else {
      return sanitizeHtml(tableHtml);
    }
  }

  // 通过 DOMParser 规范化 DOM 树
  try {
    const doc = new DOMParser().parseFromString(tableHtml, "text/html");
    const table = doc.querySelector("table");
    if (!table) return sanitizeHtml(tableHtml);

    // 确保有 tbody
    if (!table.querySelector("tbody") && table.querySelector("tr")) {
      const tbody = doc.createElement("tbody");
      const trs = Array.from(table.querySelectorAll("tr"));
      trs.forEach((tr) => tbody.appendChild(tr));
      table.appendChild(tbody);
    }

    // 提升首行纯 th 为 thead
    const firstTr = table.querySelector("tr");
    if (firstTr && !table.querySelector("thead")) {
      const ths = firstTr.querySelectorAll("th");
      const tds = firstTr.querySelectorAll("td");
      if (ths.length > 0 && tds.length === 0) {
        const thead = doc.createElement("thead");
        firstTr.parentNode?.removeChild(firstTr);
        thead.appendChild(firstTr);
        table.insertBefore(thead, table.firstChild);
      }
    }

    return table.outerHTML;
  } catch (_e) {
    return sanitizeHtml(tableHtml);
  }
}
