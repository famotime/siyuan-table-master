/**
 * html-dialog-utils.ts - HTML 表格弹窗编辑器纯函数工具
 *
 * 包含 Markdown ↔ HTML 表格转换、HTML 净化、单元格解析与数据结构构建。
 * 纯同步、无 DOM 交互与思源运行时副作用，便于单元测试。
 */

import { escapeHtml, unescapeHtml } from "./dom-utils";

export interface CellStyle {
  bg?: string;
  color?: string;
  alignH?: "align-h-left" | "align-h-center" | "align-h-right";
  alignV?: "align-v-top" | "align-v-middle" | "align-v-bottom";
  fs?: number;
  lh?: number;
}

export interface CellData {
  r: number;
  c: number;
  content: string;
  rowSpan: number;
  colSpan: number;
  style: CellStyle;
  backup?: { content: string; style: CellStyle };
  el?: HTMLTableCellElement | null;
}

export interface Snapshot {
  matrix: {
    content: string;
    rowSpan: number;
    colSpan: number;
    style: CellStyle;
    backup?: { content: string; style: CellStyle };
  }[][];
  tableCaption: string;
  captionStyle: { fontSize: number; background: string; color: string };
  fontSize: number;
  lineHeight: number;
  borderWidth: number;
  paddingWidth: number;
  colWidths: string[];
  rowHeights?: number[];
}

export const ALLOWED_CONTENT_TAGS = new Set([
  "br", "p", "b", "strong", "i", "em", "u", "sub", "sup",
  "del", "ins", "mark", "small", "big", "span",
]);

/**
 * 净化富文本 HTML 内容，移除危险脚本与非安全属性
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  Array.from(root.querySelectorAll("*")).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_CONTENT_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "iframe" || tag === "object" || tag === "embed") {
        parent.removeChild(el);
        return;
      }
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }

    if (el.hasAttribute("style")) {
      const keepStyles: string[] = [];
      const allowedStyles = ["color", "background-color", "text-decoration"];
      for (const prop of allowedStyles) {
        const val = (el as HTMLElement).style.getPropertyValue(prop);
        if (val) {
          keepStyles.push(`${prop}:${val}`);
        }
      }
      if (keepStyles.length > 0) {
        el.setAttribute("style", keepStyles.join(";"));
      } else {
        el.removeAttribute("style");
      }
    }

    Array.from(el.attributes).forEach((attr) => {
      if (attr.name !== "style") {
        el.removeAttribute(attr.name);
      }
    });
  });

  return root.innerHTML;
}

/**
 * 从 HTML 字符串内的 span 标签中剥离指定样式（如 color 或 background-color）
 */
export function stripSpanStyle(html: string, prop: "color" | "background-color"): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const temp = doc.body.firstElementChild;
  if (!temp) return "";

  const camelProp = prop === "background-color" ? "backgroundColor" : "color";
  temp.querySelectorAll("span").forEach((span) => {
    (span.style as any)[camelProp] = "";
    const keep: string[] = [];
    if (span.style.color) keep.push(`color:${span.style.color}`);
    if (span.style.backgroundColor) keep.push(`background-color:${span.style.backgroundColor}`);
    if (span.style.textDecoration) keep.push(`text-decoration:${span.style.textDecoration}`);
    if (keep.length > 0) {
      span.setAttribute("style", keep.join(";"));
    } else {
      span.removeAttribute("style");
    }
  });
  return temp.innerHTML;
}

/**
 * 构建初始化单元格对象
 */
export function createCell(r: number, c: number, data: Partial<CellData> = {}): CellData {
  return {
    r,
    c,
    content: data.content ?? "",
    rowSpan: typeof data.rowSpan === "number" && data.rowSpan > 0 ? data.rowSpan : 1,
    colSpan: typeof data.colSpan === "number" && data.colSpan > 0 ? data.colSpan : 1,
    style: {
      bg: "",
      color: "",
      alignH: "align-h-left",
      alignV: "align-v-middle",
      fs: undefined,
      lh: undefined,
      ...(data.style || {}),
    },
    el: null,
  };
}

/**
 * 解析正跨度整数（colspan / rowspan）
 */
export function positiveSpan(value: string | null, fallback = 1): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * 解析指定数值范围内的 CSS 数值
 */
export function parseCssNumber(value: string | null, min = 0, max = 200): number | "" {
  if (!value) return "";
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : "";
}

/**
 * 将 Markdown 表格行按 | 分割为单元格数组，支持转义管道符 \|
 */
export function splitMdRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);

  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * 检查一行是否是 Markdown 表格分隔行
 */
export function isMdSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * 获取 Markdown 对齐单元格的对齐方式
 */
export function mdAlignOf(cell: string): string {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

/**
 * 将 Markdown 内联语法转换为 HTML
 */
export function mdInline(text: string): string {
  const kept: string[] = [];
  let t = String(text).replace(
    /<\/?(?:span|br|b|strong|i|em|u|s|del|ins|mark|small|sub|sup)(?:\s[^<>]*)?>/gi,
    (m) => {
      kept.push(m);
      return "\u0001" + (kept.length - 1) + "\u0001";
    },
  );

  t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/(^|[^A-Za-z0-9_])\*\*(\S[^*]*?\S|\S)\*\*(?![A-Za-z0-9_])/g, "$1$2");
  t = t.replace(/(^|[^A-Za-z0-9_])__(\S[^_]*?\S|\S)__(?![A-Za-z0-9_])/g, "$1$2");
  t = t.replace(/(^|[^A-Za-z0-9_])\*(\S[^*]*?\S|\S)\*(?![A-Za-z0-9_])/g, "$1$2");
  t = t.replace(/(^|[^A-Za-z0-9_])_(\S[^_]*?\S|\S)_(?![A-Za-z0-9_])/g, "$1$2");
  t = t.replace(/(^|[^A-Za-z0-9_])~~(\S[^~]*?\S|\S)~~(?![A-Za-z0-9_])/g, "$1$2");

  t = t.replace(/\u0001(\d+)\u0001/g, (_, i) => kept[Number(i)]);
  return t;
}

/**
 * 解析 Markdown 单元格及其 IAL 合并属性
 */
export function parseMdCell(raw: string) {
  let text = raw;
  let colSpan = 1;
  let rowSpan = 1;
  let covered = false;

  let attrs = "";
  let m = text.match(/^\s*\{:\s*([^}]*)\}/);
  if (m) {
    attrs += " " + m[1];
    text = text.slice(m[0].length);
  }
  m = text.match(/\{:\s*([^}]*)\}\s*$/);
  if (m) {
    attrs += " " + m[1];
    text = text.slice(0, m.index);
  }

  if (attrs) {
    text = text.trim();
    const cs = attrs.match(/colspan\s*=\s*["']?(\d+)/i);
    const rs = attrs.match(/rowspan\s*=\s*["']?(\d+)/i);
    if (cs) colSpan = Math.max(1, parseInt(cs[1], 10));
    if (rs) rowSpan = Math.max(1, parseInt(rs[1], 10));
    if (attrs.includes("fn__none")) covered = true;
  }
  return { text, colSpan, rowSpan, covered };
}

/**
 * 将 Markdown 表格转换为 HTML table 字符串
 */
export function markdownToHtmlTable(md: string): string | null {
  const lines = String(md)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes("|"));
  if (lines.length < 2) return null;

  const sepIndex = lines.findIndex((line) => isMdSeparatorRow(splitMdRow(line)));
  if (sepIndex === -1) return null;

  const aligns = splitMdRow(lines[sepIndex]).map(mdAlignOf);
  const headerLine = sepIndex > 0 ? lines[sepIndex - 1] : null;
  const bodyLines = lines.filter((_, i) => i !== sepIndex && !(headerLine !== null && i === sepIndex - 1));

  const allLines = headerLine !== null ? [headerLine, ...bodyLines] : bodyLines;
  if (allLines.length === 0) return null;

  const parsedRows = allLines.map((line) => splitMdRow(line).map(parseMdCell));

  const occupied: boolean[][] = [];
  const ensureOccRow = (r: number) => {
    while (occupied.length <= r) occupied.push([]);
  };
  let colCount = aligns.length;
  const plan = parsedRows.map((cells, r) => {
    ensureOccRow(r);
    const placed: { c: number; cell: ReturnType<typeof parseMdCell> }[] = [];
    let c = 0;
    cells.forEach((cell) => {
      if (cell.covered) return;
      while (occupied[r][c]) c++;
      for (let i = 0; i < cell.rowSpan; i++) {
        ensureOccRow(r + i);
        for (let j = 0; j < cell.colSpan; j++) occupied[r + i][c + j] = true;
      }
      placed.push({ c, cell });
      c += cell.colSpan;
    });
    if (c > colCount) colCount = c;
    return { placed, endC: c };
  });
  if (colCount === 0) return null;

  const isColEmpty = (col: number) =>
    plan.every(({ placed }) =>
      placed.every(({ c, cell }) => {
        if (c > col) return true;
        if (c === col) {
          return cell.text.trim() === "" && cell.colSpan === 1 && cell.rowSpan === 1;
        }
        return c + cell.colSpan <= col;
      }),
    );
  while (colCount > 1 && isColEmpty(colCount - 1)) colCount--;

  // 提取可能的 IAL 中的 caption 属性
  let captionHtml = "";
  const captionMatch = md.match(/\{:[^}]*\bcaption="([^"]+)"[^}]*\}/i);
  if (captionMatch) {
    const rawCaption = unescapeHtml(captionMatch[1]);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<table>${rawCaption}</table>`, "text/html");
    const capEl = doc.querySelector("caption");
    if (capEl) {
      const text = (capEl.textContent || "").trim();
      if (text) {
        const isBottom = capEl.style.captionSide === "bottom" ||
          /caption-side\s*:\s*bottom/i.test(capEl.getAttribute("style") || "");
        const styleAttr = isBottom ? ' style="caption-side: bottom;"' : "";
        captionHtml = `<caption${styleAttr}>${escapeHtml(text)}</caption>`;
      }
    }
  }

  let html = `<table>${captionHtml}`;
  plan.forEach(({ placed, endC }, r) => {
    let row = "<tr>";
    placed.forEach(({ c, cell }) => {
      if (c >= colCount) return;
      const spanAttrs =
        (cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : "") +
        (cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "");
      const align = aligns[c] ? ` style="text-align: ${aligns[c]}"` : "";
      row += `<td${spanAttrs}${align}>${mdInline(cell.text)}</td>`;
    });
    let c = endC;
    while (c < colCount) {
      if (occupied[r][c]) {
        c++;
        continue;
      }
      const align = aligns[c] ? ` style="text-align: ${aligns[c]}"` : "";
      row += `<td${align}></td>`;
      c++;
    }
    html += row + "</tr>";
  });
  return html + "</table>";
}
