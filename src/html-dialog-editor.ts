import { Dialog, showMessage } from "siyuan";
import { HtmlTableEditor } from "./html-table-editor";
import type TableMaterPlugin from "./index";
import { icons } from "./utils/icons";
import { logger } from "./logger";


interface CellStyle {
  bg?: string;
  color?: string;
  alignH?: "align-h-left" | "align-h-center" | "align-h-right";
  alignV?: "align-v-top" | "align-v-middle" | "align-v-bottom";
  fs?: number;
  lh?: number;
}

interface CellData {
  r: number;
  c: number;
  content: string;
  rowSpan: number;
  colSpan: number;
  style: CellStyle;
  backup?: { content: string; style: CellStyle };
  el?: HTMLTableCellElement | null;
}

interface Snapshot {
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
}

const ALLOWED_CONTENT_TAGS = new Set([
  "br", "p", "b", "strong", "i", "em", "u", "sub", "sup",
  "del", "ins", "mark", "small", "big", "span"
]);

function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  Array.from(root.querySelectorAll("*")).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_CONTENT_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
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

function stripSpanStyle(html: string, prop: "color" | "background-color"): string {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
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

function createCell(r: number, c: number, data: Partial<CellData> = {}): CellData {
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

function positiveSpan(value: string | null, fallback = 1): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCssNumber(value: string | null, min = 0, max = 200): number | "" {
  if (!value) return "";
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : "";
}

function splitMdRow(line: string): string[] {
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

function isMdSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function mdAlignOf(cell: string): string {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

function mdInline(text: string): string {
  const kept: string[] = [];
  let t = String(text).replace(
    /<\/?(?:span|br|b|strong|i|em|u|s|del|ins|mark|small|sub|sup)(?:\s[^<>]*)?>/gi,
    (m) => {
      kept.push(m);
      return "\u0001" + (kept.length - 1) + "\u0001";
    }
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

function parseMdCell(raw: string) {
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

function markdownToHtmlTable(md: string): string | null {
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
      })
    );
  while (colCount > 1 && isColEmpty(colCount - 1)) colCount--;

  let html = "<table>";
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

export function openHtmlDialogEditor(_plugin: TableMaterPlugin, te: HtmlTableEditor) {
  const tableOriginal = te.getTable();
  if (!tableOriginal) {
    showMessage("未检测到有效的 HTML 表格");
    return;
  }

  const tableClone = tableOriginal.cloneNode(true) as HTMLTableElement;

  let matrix: CellData[][] = [];
  let gridMap: (CellData | null)[][] = [];
  let startCell: CellData | null = null;
  let endCell: CellData | null = null;
  let borderWidth = 0.1;
  let paddingWidth = 4;
  let fontSize = 14;
  let lineHeight = 1.4;
  let colorTarget: "background" | "color" | "textBackground" = "background";

  let tableCaption = "";
  let captionStyle = { fontSize: 16, background: "", color: "" };
  let selectedCaption = false;

  const HISTORY_LIMIT = 20;
  let undoStack: Snapshot[] = [];
  let redoStack: Snapshot[] = [];

  const presetColors = ["#8A170F", "#224429", "#19198F", "#A88100", "#B84D00", "#8A0F8A", "#2c3e50", "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#f39c12", "#d35400", "#c0392b", "#7f8c8d"];

  const dialogHtml = `
    <style>
      .at-dialog-root {
        display: flex;
        flex-direction: column;
        height: 82vh;
        max-height: 860px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        font-family: var(--b3-font-family);
        position: relative;
        user-select: none;
        border-radius: 8px;
        overflow: hidden;
      }
      .at-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--b3-theme-surface);
      }
      .at-toolbar.at-toolbar-global {
        border-bottom: 1px solid var(--b3-theme-surface-lighter);
        padding-bottom: 8px;
        position: relative;
        z-index: 10;
        overflow: visible;
      }
      .at-body-container {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
      }
      .at-side-panel-wrapper {
        position: relative;
        height: 100%;
        display: flex;
        flex-shrink: 0;
      }
      .at-side-panel {
        width: 215px;
        background: var(--b3-theme-surface);
        border-left: 1px solid var(--b3-theme-surface-lighter);
        display: flex;
        flex-direction: column;
        transition: width 0.2s ease;
        overflow-y: auto;
        overflow-x: visible;
        box-shadow: -2px 0 4px rgba(0,0,0,0.02);
      }
      .at-side-panel.collapsed {
        width: 0;
        border-left: none;
      }
      .at-panel-toggle {
        position: absolute;
        left: -12px;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 48px;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-right: none;
        border-radius: 4px 0 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 100;
        transition: background 0.15s;
        box-shadow: -2px 0 4px rgba(0,0,0,0.02);
      }
      .at-panel-toggle:hover {
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
      .at-panel-section {
        padding: 10px 12px;
        border-bottom: 1px solid var(--b3-theme-surface-lighter);
        box-sizing: border-box;
      }
      .at-panel-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
        margin-bottom: 6px;
        user-select: none;
      }
      .at-btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 6px;
      }
      .at-btn-row:last-child {
        margin-bottom: 0;
      }
      .at-side-panel .at-btn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 3px 2px;
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        box-sizing: border-box;
      }
      .at-side-panel .at-btn .at-btn-label {
        font-size: 10px;
        line-height: 1;
        margin-top: 3px;
        opacity: 0.85;
        white-space: nowrap;
        pointer-events: none;
      }
      .at-toolbar-section {
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 3px 6px;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 6px;
        position: relative;
      }
      .at-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--b3-theme-on-background);
        padding: 4px 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 26px;
        box-sizing: border-box;
        position: relative;
      }
      .at-btn:hover:not(:disabled) {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-light);
      }
      .at-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        pointer-events: auto !important;
      }
      .at-btn.active {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
        border-color: var(--b3-theme-primary);
      }
      .at-btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        display: inline-block;
        vertical-align: middle;
      }
      .at-lucide-icon {
        fill: none;
      }
      .at-lucide-icon * {
        stroke: currentColor;
      }
      
      .at-btn[data-tooltip] {
        position: relative;
      }
      .at-btn[data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 6px;
        background: rgba(15, 23, 42, 0.92);
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 100000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        line-height: 1.2;
        font-weight: normal;
      }
      .at-btn[data-tooltip]:hover::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 0px;
        border-width: 5px;
        border-style: solid;
        border-color: transparent transparent rgba(15, 23, 42, 0.92) transparent;
        pointer-events: none;
        z-index: 100000;
      }

      .at-btn:hover {
        z-index: 9999 !important;
      }

      .at-panel-section {
        margin-bottom: 12px;
        position: relative;
        overflow: visible;
      }
      .at-panel-section:hover {
        z-index: 9999 !important;
      }
      .at-btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 6px;
        position: relative;
        overflow: visible;
      }
      .at-btn-row:hover {
        z-index: 9999 !important;
      }

      .at-adjust-box {
        display: flex;
        align-items: center;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 4px;
        height: 24px;
        padding: 0 2px;
      }
      .at-adjust-btn {
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        border-radius: 3px;
      }
      .at-adjust-btn:hover {
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
      .at-adjust-val {
        min-width: 22px;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
      }
      .at-adjust-input {
        width: 32px;
        height: 20px;
        background: transparent;
        border: none;
        outline: none;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        color: var(--b3-theme-on-background);
        padding: 0 2px;
        margin: 0;
        border-radius: 2px;
        transition: background 0.15s ease, box-shadow 0.15s ease;
        -moz-appearance: textfield;
      }
      .at-adjust-input:hover, .at-adjust-input:focus {
        background: var(--b3-theme-background);
        box-shadow: inset 0 0 0 1px var(--b3-theme-primary);
      }
      .at-adjust-input::-webkit-outer-spin-button,
      .at-adjust-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .at-table-scroll {
        flex: 1;
        overflow: auto;
        padding: 24px;
        position: relative;
        background: var(--b3-theme-background);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        background-image: radial-gradient(var(--b3-theme-surface-lighter) 1px, transparent 1px);
        background-size: 16px 16px;
      }
      #at-tableCenterWrapper {
        text-align: center;
        min-height: 100%;
        transform-origin: top center;
        transition: transform 0.15s ease-out;
        display: inline-block;
      }
      table.at-editor-table {
        margin: 10px auto;
        border-collapse: collapse;
        table-layout: auto;
        background: var(--b3-theme-surface);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        border-radius: 4px;
        border: var(--at-bw, 0.1px) solid var(--b3-theme-surface-lighter);
      }
      table.at-editor-table caption {
        text-align: center;
        padding: 8px;
        font-weight: 600;
        color: var(--b3-theme-on-background);
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-bottom: none;
        cursor: pointer;
      }
      table.at-editor-table caption.selected-caption {
        box-shadow: inset 0 0 0 2px var(--b3-theme-primary), inset 0 0 0 9999px rgba(35, 134, 238, 0.18);
        outline: none;
      }
      table.at-editor-table td {
        border: var(--at-bw, 0.1px) solid var(--b3-theme-surface-lighter);
        background: var(--b3-theme-surface);
        position: relative;
        padding: var(--at-pad, 4px);
        vertical-align: middle;
        word-break: break-all;
        box-sizing: border-box;
      }
      table.at-editor-table td.selected-cell {
        box-shadow: inset 0 0 0 2px var(--b3-theme-primary), inset 0 0 0 9999px rgba(35, 134, 238, 0.18);
        outline: none;
      }
      table.at-editor-table td.col-resizing {
        border-right: 2px solid var(--b3-theme-primary) !important;
        box-shadow: inset 0 0 0 9999px rgba(35, 134, 238, 0.18);
      }
      .cell-content {
        min-height: 1.2em;
        outline: none;
      }
      .at-status-bar {
        height: 32px;
        background: var(--b3-theme-surface);
        border-top: 1px solid var(--b3-theme-surface-lighter);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        user-select: none;
      }
      .at-status-section {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .at-status-badge {
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-theme-surface-lighter);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        color: var(--b3-theme-on-surface);
      }
      .at-zoom-ctrl {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 4px;
        padding: 2px 6px;
      }
      .at-zoom-slider {
        width: 80px;
        height: 4px;
        cursor: pointer;
        accent-color: var(--b3-theme-primary);
      }
      #at-colorPicker {
        position: absolute;
        display: none;
        z-index: 200000 !important;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 6px;
        padding: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      }
      .at-c-grid {
        display: grid;
        grid-template-columns: repeat(5, 22px);
        gap: 4px;
      }
      .at-c-swatch {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid rgba(0,0,0,0.15);
        transition: transform 0.1s ease;
      }
      .at-c-swatch:hover {
        transform: scale(1.15);
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      .at-c-swatch-deselect {
        grid-column: span 5;
        margin-top: 6px;
        font-size: 11px;
        text-align: center;
        padding: 4px;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .at-c-swatch-deselect:hover {
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
      #at-contextMenu {
        position: fixed;
        display: none;
        z-index: 99999;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 6px;
        padding: 4px 0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        min-width: 160px;
      }

      .at-menu-item {
        padding: 6px 14px;
        font-size: 12px;
        cursor: pointer;
        color: var(--b3-theme-on-background);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .at-menu-item:hover:not(.disabled) {
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
      .at-menu-item.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .at-menu-divider {
        height: 1px;
        background: var(--b3-theme-surface-lighter);
        margin: 4px 0;
      }
      #at-importModal {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1002;
        background: rgba(0,0,0,0.5);
        display: none;
        align-items: center;
        justify-content: center;
      }
      .at-modal-box {
        width: 80%;
        max-width: 600px;
        background: var(--b3-theme-surface);
        border-radius: 8px;
        padding: 18px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .at-modal-textarea {
        width: 100%;
        height: 180px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 6px;
        padding: 8px;
        font-family: monospace;
        font-size: 12px;
        box-sizing: border-box;
        resize: vertical;
      }
      .at-toast {
        position: absolute;
        bottom: 44px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.9);
        color: #fff;
        padding: 6px 18px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 2000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      }
      .at-toast.show {
        opacity: 1;
      }
    </style>

    <div class="at-dialog-root">
      <!-- 商业软件分组工具栏 - 第一层：全局操作区 -->
      <div class="at-toolbar at-toolbar-global">
        <!-- 全局：基础与历史 -->
        <div class="at-toolbar-section">
          <button class="at-btn" id="at-btn-import" data-tooltip="导入 HTML / Markdown 代码">${icons.import}</button>
          <button class="at-btn" id="at-btn-copy" data-tooltip="复制当前表格 HTML 代码">${icons.copy}</button>
          <button class="at-btn" id="at-btn-caption" data-tooltip="显示/隐藏表格标题">${icons.caption}</button>
          <button class="at-btn" id="at-btn-select-all" data-tooltip="选择表格所有单元格">${icons.selectAll}</button>
          <div style="width: 1px; height: 14px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
          <button class="at-btn" id="at-btn-undo" data-tooltip="撤销上一步操作 (Ctrl+Z)">${icons.undo}</button>
          <button class="at-btn" id="at-btn-redo" data-tooltip="重做撤销的操作 (Ctrl+Y)">${icons.redo}</button>
        </div>

        <!-- 全局：表格尺寸参数 -->
        <div class="at-toolbar-section">
          <div style="display: flex; align-items: center; gap: 2px;">
            <span class="at-btn" style="padding:0; min-width: 20px; cursor: default" data-tooltip="全局行高">${icons.lineHeight}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-lh-minus">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-lh-val" value="1.4" data-tooltip="编辑全局行高" />
              <div class="at-adjust-btn" id="at-lh-plus">${icons.plus}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 2px; margin-left: 4px;">
            <span class="at-btn" style="padding:0; min-width: 20px; cursor: default" data-tooltip="全局边框(px)">${icons.border}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-bw-minus">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-bw-val" value="0.1" data-tooltip="编辑全局边框(px)" />
              <div class="at-adjust-btn" id="at-bw-plus">${icons.plus}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 2px; margin-left: 4px;">
            <span class="at-btn" style="padding:0; min-width: 20px; cursor: default" data-tooltip="全局内边距(px)">${icons.padding}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-pad-minus">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-pad-val" value="4" data-tooltip="编辑全局内边距(px)" />
              <div class="at-adjust-btn" id="at-pad-plus">${icons.plus}</div>
            </div>
          </div>
          <div style="width: 1px; height: 14px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
          <button class="at-btn" id="at-btn-reset-globals" data-tooltip="重置默认行高(1.4)、边框(0.1px)与内边距(4px)">
            ${icons.resetZoom}
            <span style="font-size: 11px;">重置</span>
          </button>
        </div>
      </div>

      <div class="at-body-container">
        <!-- 表格内容滚动与画布容器 -->
        <div class="at-table-scroll" id="at-table-scroll-container">
          <div id="at-tableCenterWrapper">
            <table class="at-editor-table" id="at-main-table">
              <tbody id="at-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="at-side-panel-wrapper">
          <div class="at-panel-toggle" id="at-panel-toggle" data-tooltip="收缩/展开侧面板">
            ${icons.chevronRight}
          </div>

          <!-- 商业软件分组工具栏 - 第二侧边面板：单元格操作区 -->
          <div class="at-side-panel" id="at-side-panel">
            <!-- 行列操作 -->
            <div class="at-panel-section">
              <div class="at-panel-title">行列操作</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-merge" data-tooltip="合并选中的多格">${icons.merge}<span class="at-btn-label">合并</span></button>
                <button class="at-btn" id="at-btn-split" data-tooltip="拆分选中的合并单元格">${icons.split}<span class="at-btn-label">拆分</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-insert-col-left" data-tooltip="左侧插入列">${icons.insertColLeft}<span class="at-btn-label">左插入</span></button>
                <button class="at-btn" id="at-btn-insert-col-right" data-tooltip="右侧插入列">${icons.insertColRight}<span class="at-btn-label">右插入</span></button>
                <button class="at-btn" id="at-btn-insert-row-above" data-tooltip="上方插入行">${icons.insertRowAbove}<span class="at-btn-label">上插入</span></button>
                <button class="at-btn" id="at-btn-insert-row-below" data-tooltip="下方插入行">${icons.insertRowBelow}<span class="at-btn-label">下插入</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-delete-row" data-tooltip="删除当前行">${icons.deleteRow}<span class="at-btn-label">删行</span></button>
                <button class="at-btn" id="at-btn-delete-col" data-tooltip="删除当前列">${icons.deleteCol}<span class="at-btn-label">删列</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-move-row-up" data-tooltip="行上移">${icons.moveRowUp}<span class="at-btn-label">上移</span></button>
                <button class="at-btn" id="at-btn-move-row-down" data-tooltip="行下移">${icons.moveRowDown}<span class="at-btn-label">下移</span></button>
                <button class="at-btn" id="at-btn-move-col-left" data-tooltip="列左移">${icons.moveColLeft}<span class="at-btn-label">左移</span></button>
                <button class="at-btn" id="at-btn-move-col-right" data-tooltip="列右移">${icons.moveColRight}<span class="at-btn-label">右移</span></button>
              </div>
            </div>

            <!-- 排版对齐 -->
            <div class="at-panel-section">
              <div class="at-panel-title">排版对齐</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-h-left" data-tooltip="水平居左">${icons.alignLeft}<span class="at-btn-label">居左</span></button>
                <button class="at-btn" id="at-btn-h-center" data-tooltip="水平居中">${icons.alignCenter}<span class="at-btn-label">居中</span></button>
                <button class="at-btn" id="at-btn-h-right" data-tooltip="水平居右">${icons.alignRight}<span class="at-btn-label">居右</span></button>
              </div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-v-top" data-tooltip="垂直居顶">${icons.alignTop}<span class="at-btn-label">居顶</span></button>
                <button class="at-btn" id="at-btn-v-middle" data-tooltip="垂直居中">${icons.alignMiddle}<span class="at-btn-label">居中</span></button>
                <button class="at-btn" id="at-btn-v-bottom" data-tooltip="垂直居底">${icons.alignBottom}<span class="at-btn-label">居底</span></button>
              </div>
            </div>

            <!-- 样式与颜色 -->
            <div class="at-panel-section">
              <div class="at-panel-title">样式与颜色</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-bg-color" data-tooltip="设置单元格背景颜色">${icons.bgColor}<span class="at-btn-label">背景色</span></button>
                <button class="at-btn" id="at-btn-text-color" data-tooltip="设置单元格文字颜色">${icons.textColor}<span class="at-btn-label">文字色</span></button>
                <button class="at-btn" id="at-btn-clear" data-tooltip="清除选中单元格样式格式">${icons.clear}<span class="at-btn-label">清格式</span></button>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                <span style="font-size: 11px; opacity: 0.7; display: flex; align-items: center; gap: 2px;" data-tooltip="修改选中单元格字号">${icons.fontSize} 字号:</span>
                <div class="at-adjust-box">
                  <div class="at-adjust-btn" id="at-fs-minus">${icons.minus}</div>
                  <input type="text" class="at-adjust-input" id="at-fs-val" value="14" data-tooltip="编辑字号(px)" />
                  <div class="at-adjust-btn" id="at-fs-plus">${icons.plus}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部专业状态栏 -->
      <div class="at-status-bar">
        <div class="at-status-section">
          <span class="at-status-badge" id="at-status-text">拖拽框选单元格</span>
          <span id="at-coords-text" style="opacity: 0.7;">-</span>
        </div>

        <div class="at-status-section">
          <div class="at-zoom-ctrl">
            <button class="at-btn" id="at-btn-zoom-out" data-tooltip="缩小画布 (50%-150%)" style="height: 20px; min-width: 20px; padding: 0;">${icons.zoomOut}</button>
            <input type="range" id="at-zoom-slider" class="at-zoom-slider" min="50" max="150" value="100" step="5" />
            <button class="at-btn" id="at-btn-zoom-in" data-tooltip="放大画布 (50%-150%)" style="height: 20px; min-width: 20px; padding: 0;">${icons.zoomIn}</button>
            <span id="at-zoom-val" style="min-width: 36px; text-align: center; font-size: 11px; font-weight: 600;">100%</span>
            <button class="at-btn" id="at-btn-zoom-reset" data-tooltip="重置缩放与贴合" style="height: 20px; min-width: 20px; padding: 0 4px;">${icons.resetZoom}</button>
          </div>
        </div>

        <div class="at-status-section">
          <button class="b3-button b3-button--cancel" id="at-btn-dialog-cancel">取消</button>
          <button class="b3-button b3-button--primary" id="at-btn-dialog-save" style="background-color: var(--b3-theme-primary); color: var(--b3-theme-on-primary);">保存更新</button>
        </div>
      </div>

      <!-- 颜色选择器 -->
      <div id="at-colorPicker"><div class="at-c-grid" id="at-colorGrid"></div></div>

      <!-- 右键菜单 -->
      <div id="at-contextMenu">
        <div class="at-menu-item" data-action="merge">${icons.merge} 合并单元格</div>
        <div class="at-menu-item" data-action="split">${icons.split} 拆分单元格</div>
        <div class="at-menu-item" data-action="alignCenter">${icons.alignCenter} 水平垂直居中</div>
        <div class="at-menu-item" data-action="clearStyle">${icons.clear} 清除样式格式</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="insertColLeft">${icons.insertColLeft} 左侧插入列</div>
        <div class="at-menu-item" data-action="insertColRight">${icons.insertColRight} 右侧插入列</div>
        <div class="at-menu-item" data-action="insertRowAbove">${icons.insertRowAbove} 上方插入行</div>
        <div class="at-menu-item" data-action="insertRowBelow">${icons.insertRowBelow} 下方插入行</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="deleteRow">${icons.deleteRow} 删除当前行</div>
        <div class="at-menu-item" data-action="deleteCol">${icons.deleteCol} 删除当前列</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="moveRowUp">${icons.moveRowUp} 行上移</div>
        <div class="at-menu-item" data-action="moveRowDown">${icons.moveRowDown} 行下移</div>
        <div class="at-menu-item" data-action="moveColLeft">${icons.moveColLeft} 列左移</div>
        <div class="at-menu-item" data-action="moveColRight">${icons.moveColRight} 列右移</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="copyCellContent">${icons.copy} 复制单元格文本</div>
      </div>

      <!-- 导入弹窗 -->
      <div id="at-importModal">
        <div class="at-modal-box">
          <div style="font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 6px;">${icons.import} 导入表格代码（支持 HTML / Markdown）</div>
          <div style="font-size: 12px; opacity: 0.8;">支持导入表格标题 (Caption) 及单元格数据；Markdown 表格会自动转换为 HTML 后导入。</div>
          <textarea id="at-importCode" class="at-modal-textarea" placeholder="粘贴 <table>...</table> 或 | Markdown | 表格 | 代码..."></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="b3-button b3-button--cancel" id="at-btn-cancel-import">取消</button>
            <button class="b3-button b3-button--text" id="at-btn-confirm-import">导入并替换</button>
          </div>
        </div>
      </div>

      <div class="at-toast" id="at-toast"></div>
    </div>
  `;

  const dialog = new Dialog({
    title: "高级 HTML 表格编辑器",
    content: dialogHtml,
    width: "92vw",
  });

  const dialogEl = dialog.element;
  const tbody = dialogEl.querySelector("#at-tbody") as HTMLElement;
  const table = dialogEl.querySelector("#at-main-table") as HTMLTableElement;
  const statusText = dialogEl.querySelector("#at-status-text") as HTMLElement;
  const coordsText = dialogEl.querySelector("#at-coords-text") as HTMLElement;
  const toastEl = dialogEl.querySelector("#at-toast") as HTMLElement;

  function showToast(msg: string) {
    if (!toastEl) return;
    toastEl.innerText = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  let currentZoom = 100;
  const tableCenterWrapper = dialogEl.querySelector("#at-tableCenterWrapper") as HTMLElement;
  const panelToggle = dialogEl.querySelector("#at-panel-toggle") as HTMLElement;
  const sidePanel = dialogEl.querySelector("#at-side-panel") as HTMLElement;
  panelToggle.addEventListener("click", () => {
    sidePanel.classList.toggle("collapsed");
    panelToggle.innerHTML = sidePanel.classList.contains("collapsed") ? icons.chevronLeft : icons.chevronRight;
  });

  const zoomSlider = dialogEl.querySelector("#at-zoom-slider") as HTMLInputElement;
  const zoomVal = dialogEl.querySelector("#at-zoom-val") as HTMLElement;
  const btnZoomOut = dialogEl.querySelector("#at-btn-zoom-out") as HTMLElement;
  const btnZoomIn = dialogEl.querySelector("#at-btn-zoom-in") as HTMLElement;
  const btnZoomReset = dialogEl.querySelector("#at-btn-zoom-reset") as HTMLElement;

  function updateZoom(newZoom: number) {
    currentZoom = Math.min(150, Math.max(50, newZoom));
    if (tableCenterWrapper) {
      tableCenterWrapper.style.transform = `scale(${currentZoom / 100})`;
    }
    if (zoomSlider) zoomSlider.value = String(currentZoom);
    if (zoomVal) zoomVal.innerText = `${currentZoom}%`;
  }

  if (zoomSlider) {
    zoomSlider.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (Number.isFinite(val)) updateZoom(val);
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener("click", () => updateZoom(currentZoom - 10));
  }
  if (btnZoomIn) {
    btnZoomIn.addEventListener("click", () => updateZoom(currentZoom + 10));
  }
  if (btnZoomReset) {
    btnZoomReset.addEventListener("click", () => updateZoom(100));
  }


  function getMatrixColumnCount(): number {
    return matrix.reduce((max, row) => Math.max(max, row.length), 0);
  }

  function rebuildGridMap() {
    gridMap = [];
    const rows = matrix.length;
    const cols = getMatrixColumnCount();

    for (let r = 0; r < rows; r++) {
      gridMap[r] = [];
      for (let c = 0; c < cols; c++) {
        gridMap[r][c] = null;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const cell = matrix[r][c];
        if (!cell) continue;
        if (gridMap[r]?.[c]) continue;
        for (let i = r; i < r + cell.rowSpan; i++) {
          for (let j = c; j < c + cell.colSpan; j++) {
            if (!gridMap[i]) gridMap[i] = [];
            gridMap[i][j] = cell;
          }
        }
      }
    }
  }

  function getMasterCell(r: number, c: number): CellData | null {
    return gridMap[r]?.[c] ?? null;
  }

  function isCurrentCell(cell: CellData | null): boolean {
    return !!cell && matrix[cell.r]?.[cell.c] === cell;
  }

  function resetSelection() {
    startCell = null;
    endCell = null;
    selectedCaption = false;
  }

  function snapshotState(): Snapshot {
    return {
      matrix: matrix.map((row) =>
        row.map((cell) => ({
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          style: { ...cell.style },
          backup: cell.backup
            ? { content: cell.backup.content, style: { ...cell.backup.style } }
            : undefined,
        }))
      ),
      tableCaption,
      captionStyle: { ...captionStyle },
      fontSize,
      lineHeight,
      borderWidth,
      paddingWidth,
      colWidths: Array.from(table.querySelectorAll("colgroup > col")).map(
        (col) => (col as HTMLElement).style.width || ""
      ),
    };
  }

  function updateHistoryButtons() {
    const btnUndo = dialogEl.querySelector("#at-btn-undo") as HTMLButtonElement;
    const btnRedo = dialogEl.querySelector("#at-btn-redo") as HTMLButtonElement;
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  }

  function restoreState(s: Snapshot) {
    matrix = s.matrix.map((row, r) =>
      row.map((cell, c) => {
        const nc = createCell(r, c, {
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          style: { ...cell.style },
        });
        if (cell.backup) {
          nc.backup = { content: cell.backup.content, style: { ...cell.backup.style } };
        }
        return nc;
      })
    );
    tableCaption = s.tableCaption;
    captionStyle = { ...s.captionStyle };
    fontSize = s.fontSize;
    lineHeight = s.lineHeight;
    borderWidth = s.borderWidth;
    paddingWidth = s.paddingWidth;

    resetSelection();
    renderTable();

    const colgroup = table.querySelector("colgroup");
    if (colgroup) {
      s.colWidths.slice(0, colgroup.children.length).forEach((w, i) => {
        (colgroup.children[i] as HTMLElement).style.width = w;
      });
    }

    const bwValEl = dialogEl.querySelector("#at-bw-val") as HTMLInputElement | null;
    const padValEl = dialogEl.querySelector("#at-pad-val") as HTMLInputElement | null;
    if (bwValEl) bwValEl.value = String(borderWidth);
    if (padValEl) padValEl.value = String(paddingWidth);
  }

  function pushHistory(preSnapshot?: Snapshot) {
    undoStack.push(preSnapshot || snapshotState());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotState());
    restoreState(undoStack.pop()!);
    updateHistoryButtons();
    showToast("已撤销");
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotState());
    restoreState(redoStack.pop()!);
    updateHistoryButtons();
    showToast("已重做");
  }

  function getSelectionBounds() {
    if (!isCurrentCell(startCell) || !isCurrentCell(endCell)) return null;
    return {
      minR: Math.min(startCell!.r, endCell!.r),
      maxR: Math.max(startCell!.r, endCell!.r),
      minC: Math.min(startCell!.c, endCell!.c),
      maxC: Math.max(startCell!.c, endCell!.c),
    };
  }

  function getSelectedMasterCells(bounds = getSelectionBounds()): CellData[] {
    if (!bounds) return [];
    const cells: CellData[] = [];
    const seen = new Set<CellData>();
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      for (let c = bounds.minC; c <= bounds.maxC; c++) {
        const cell = getMasterCell(r, c);
        if (cell && !seen.has(cell)) {
          seen.add(cell);
          cells.push(cell);
        }
      }
    }
    return cells;
  }

  function canMergeSelection(): boolean {
    const bounds = getSelectionBounds();
    if (!bounds) return false;
    if (bounds.minR === bounds.maxR && bounds.minC === bounds.maxC) return false;
    const topLeft = matrix[bounds.minR]?.[bounds.minC];
    if (!topLeft || getMasterCell(bounds.minR, bounds.minC) !== topLeft) return false;

    return getSelectedMasterCells(bounds).every(
      (cell) =>
        cell.r >= bounds.minR &&
        cell.c >= bounds.minC &&
        cell.r + cell.rowSpan - 1 <= bounds.maxR &&
        cell.c + cell.colSpan - 1 <= bounds.maxC
    );
  }

  function canMoveRowUp(r: number): boolean {
    if (r <= 0 || r >= matrix.length) return false;
    const C = getMatrixColumnCount();
    for (let c = 0; c < C; c++) {
      const m1 = getMasterCell(r, c);
      const m0 = getMasterCell(r - 1, c);
      if (!m1 || m1.r !== r || m1.rowSpan !== 1) return false;
      if (!m0 || m0.r !== r - 1 || m0.rowSpan !== 1) return false;
    }
    return true;
  }

  function canMoveRowDown(r: number): boolean {
    if (r < 0 || r >= matrix.length - 1) return false;
    const C = getMatrixColumnCount();
    for (let c = 0; c < C; c++) {
      const m1 = getMasterCell(r, c);
      const m2 = getMasterCell(r + 1, c);
      if (!m1 || m1.r !== r || m1.rowSpan !== 1) return false;
      if (!m2 || m2.r !== r + 1 || m2.rowSpan !== 1) return false;
    }
    return true;
  }

  function canMoveColLeft(c: number): boolean {
    if (c <= 0) return false;
    const R = matrix.length;
    for (let r = 0; r < R; r++) {
      const m1 = getMasterCell(r, c);
      const m0 = getMasterCell(r, c - 1);
      if (!m1 || m1.c !== c || m1.colSpan !== 1) return false;
      if (!m0 || m0.c !== c - 1 || m0.colSpan !== 1) return false;
    }
    return true;
  }

  function canMoveColRight(c: number): boolean {
    const C = getMatrixColumnCount();
    if (c < 0 || c >= C - 1) return false;
    const R = matrix.length;
    for (let r = 0; r < R; r++) {
      const m1 = getMasterCell(r, c);
      const m2 = getMasterCell(r, c + 1);
      if (!m1 || m1.c !== c || m1.colSpan !== 1) return false;
      if (!m2 || m2.c !== c + 1 || m2.colSpan !== 1) return false;
    }
    return true;
  }

  function updateColGroup() {
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }

    const maxCols = getMatrixColumnCount();
    while (colgroup.children.length < maxCols) {
      const col = document.createElement("col");
      col.dataset.col = String(colgroup.children.length);
      colgroup.appendChild(col);
    }
    while (colgroup.children.length > maxCols) colgroup.removeChild(colgroup.lastChild!);
  }

  function updateGlobalStyles() {
    table.style.setProperty("--at-bw", borderWidth + "px");
    table.style.setProperty("--at-pad", paddingWidth + "px");
    table.style.border = `${borderWidth}px solid var(--b3-theme-surface-lighter)`;
    const tds = table.querySelectorAll("td");
    tds.forEach((td) => {
      (td as HTMLElement).style.border = `${borderWidth}px solid var(--b3-theme-surface-lighter)`;
      (td as HTMLElement).style.padding = paddingWidth + "px";
    });

    const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
    const lhValEl = dialogEl.querySelector("#at-lh-val") as HTMLInputElement | null;
    const bwValEl = dialogEl.querySelector("#at-bw-val") as HTMLInputElement | null;
    const padValEl = dialogEl.querySelector("#at-pad-val") as HTMLInputElement | null;
    if (fsValEl && document.activeElement !== fsValEl) fsValEl.value = String(fontSize);
    if (lhValEl && document.activeElement !== lhValEl) lhValEl.value = String(lineHeight);
    if (bwValEl && document.activeElement !== bwValEl) bwValEl.value = String(borderWidth);
    if (padValEl && document.activeElement !== padValEl) padValEl.value = String(paddingWidth);

    if (selectedCaption && fsValEl && document.activeElement !== fsValEl) {
      fsValEl.value = String(captionStyle.fontSize);
    }
  }

  function updateSidebarButtonsState() {
    const hasCell = isCurrentCell(startCell) && isCurrentCell(endCell);
    const hasSel = hasCell || selectedCaption;

    const setDisabled = (selector: string, disabled: boolean) => {
      const btn = dialogEl.querySelector(selector) as HTMLButtonElement | null;
      if (btn) btn.disabled = disabled;
    };

    setDisabled("#at-btn-merge", !hasCell || !canMergeSelection());
    setDisabled("#at-btn-split", !hasCell || !(startCell && (startCell.rowSpan > 1 || startCell.colSpan > 1)));

    setDisabled("#at-btn-insert-col-left", !hasCell);
    setDisabled("#at-btn-insert-col-right", !hasCell);
    setDisabled("#at-btn-insert-row-above", !hasCell);
    setDisabled("#at-btn-insert-row-below", !hasCell);

    setDisabled("#at-btn-delete-row", !hasCell || matrix.length <= 1);
    setDisabled("#at-btn-delete-col", !hasCell || getMatrixColumnCount() <= 1);

    setDisabled("#at-btn-move-row-up", !hasCell || !canMoveRowUp(startCell!.r));
    setDisabled("#at-btn-move-row-down", !hasCell || !canMoveRowDown(startCell!.r));
    setDisabled("#at-btn-move-col-left", !hasCell || !canMoveColLeft(startCell!.c));
    setDisabled("#at-btn-move-col-right", !hasCell || !canMoveColRight(startCell!.c));

    [
      "#at-btn-h-left", "#at-btn-h-center", "#at-btn-h-right",
      "#at-btn-v-top", "#at-btn-v-middle", "#at-btn-v-bottom",
      "#at-btn-bg-color", "#at-btn-text-color", "#at-btn-clear"
    ].forEach((id) => setDisabled(id, !hasSel));

    const fsMinus = dialogEl.querySelector("#at-fs-minus") as HTMLElement | null;
    const fsPlus = dialogEl.querySelector("#at-fs-plus") as HTMLElement | null;
    if (fsMinus) fsMinus.style.opacity = hasSel ? "1" : "0.35";
    if (fsPlus) fsPlus.style.opacity = hasSel ? "1" : "0.35";
  }

  function updateSelectionView() {
    table.querySelectorAll(".selected-cell").forEach((el) => el.classList.remove("selected-cell"));
    const captionEl = table.querySelector("caption");
    if (captionEl) captionEl.classList.remove("selected-caption");

    if (!selectedCaption && (!isCurrentCell(startCell) || !isCurrentCell(endCell))) {
      startCell = null;
      endCell = null;
    }

    if (selectedCaption && captionEl) {
      captionEl.classList.add("selected-caption");
      if (statusText) statusText.innerText = "已选中标题 (Caption)";
      if (coordsText) coordsText.innerText = "标题";
      const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
      if (fsValEl && document.activeElement !== fsValEl) fsValEl.value = String(captionStyle.fontSize);
      updateSidebarButtonsState();
      return;
    }

    if (!startCell || !endCell) {
      if (statusText) statusText.innerText = "未选中";
      if (coordsText) coordsText.innerText = "-";
      updateSidebarButtonsState();
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      resetSelection();
      if (statusText) statusText.innerText = "未选中";
      if (coordsText) coordsText.innerText = "-";
      updateSidebarButtonsState();
      return;
    }

    const { minR, maxR, minC, maxC } = bounds;
    const selectedMasters = getSelectedMasterCells(bounds);
    selectedMasters.forEach((cell) => {
      if (cell.el) cell.el.classList.add("selected-cell");
    });

    if (statusText) statusText.innerText = `选中 ${(maxR - minR + 1) * (maxC - minC + 1)} 个单元格`;
    if (coordsText) coordsText.innerText = `R${minR + 1}-R${maxR + 1}, C${minC + 1}-C${maxC + 1}`;

    const master = getMasterCell(minR, minC);
    if (master) {
      const displayFs = master.style.fs ? master.style.fs : fontSize;
      const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
      if (fsValEl && document.activeElement !== fsValEl) fsValEl.value = String(displayFs);
    }
    updateSidebarButtonsState();
  }

  function renderTable() {
    rebuildGridMap();
    tbody.innerHTML = "";
    matrix.forEach((row) => row.forEach((cell) => { cell.el = null; }));
    updateColGroup();

    let captionEl = table.querySelector("caption");
    if (tableCaption) {
      if (!captionEl) {
        captionEl = document.createElement("caption");
        table.insertBefore(captionEl, table.firstChild);
      }
      captionEl.innerHTML = sanitizeHtml(tableCaption);
      captionEl.style.fontSize = captionStyle.fontSize + "px";
      captionEl.style.background = captionStyle.background || "";
      captionEl.style.color = captionStyle.color || "";
      captionEl.onmousedown = (e) => {
        e.stopPropagation();
        startCell = null;
        endCell = null;
        selectedCaption = true;
        updateSelectionView();
      };
      captionEl.ondblclick = (e) => {
        e.stopPropagation();
        if (!captionEl) return;
        captionEl.contentEditable = "true";
        captionEl.focus();

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(captionEl);
        selection?.removeAllRanges();
        selection?.addRange(range);

        const finishEdit = () => {
          if (!captionEl) return;
          captionEl.contentEditable = "false";
          const newText = sanitizeHtml(captionEl.innerHTML);
          if (newText !== tableCaption) {
            pushHistory();
            tableCaption = newText || "表格标题";
            renderTable();
          }
        };

        captionEl.onblur = finishEdit;
        captionEl.onkeydown = (ke) => {
          if (ke.key === "Enter" && !ke.shiftKey) {
            ke.preventDefault();
            captionEl.blur();
          } else if (ke.key === "Escape") {
            ke.preventDefault();
            if (captionEl) captionEl.innerHTML = sanitizeHtml(tableCaption);
            captionEl.contentEditable = "false";
          }
        };
      };
    } else if (captionEl) {
      captionEl.remove();
      selectedCaption = false;
    }

    for (let r = 0; r < matrix.length; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < matrix[r].length; c++) {
        const cellData = matrix[r][c];

        let isCovered = false;
        for (let checkR = 0; checkR <= r && !isCovered; checkR++) {
          for (let checkC = 0; checkC <= c && !isCovered; checkC++) {
            if (checkR === r && checkC === c) continue;
            const potentialMaster = matrix[checkR]?.[checkC];
            if (
              potentialMaster &&
              checkR + potentialMaster.rowSpan > r &&
              checkC + potentialMaster.colSpan > c
            ) {
              isCovered = true;
            }
          }
        }
        if (isCovered) continue;

        const td = document.createElement("td");
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        if (cellData.rowSpan > 1) td.rowSpan = cellData.rowSpan;
        if (cellData.colSpan > 1) td.colSpan = cellData.colSpan;

        if (cellData.style.alignH === "align-h-center") td.style.textAlign = "center";
        else if (cellData.style.alignH === "align-h-right") td.style.textAlign = "right";
        else td.style.textAlign = "left";

        if (cellData.style.alignV === "align-v-top") td.style.verticalAlign = "top";
        else if (cellData.style.alignV === "align-v-bottom") td.style.verticalAlign = "bottom";
        else td.style.verticalAlign = "middle";

        const content = document.createElement("div");
        content.className = "cell-content";
        cellData.content = sanitizeHtml(cellData.content);
        content.innerHTML = cellData.content || "&nbsp;";

        td.appendChild(content);

        if (cellData.style.bg) td.style.background = cellData.style.bg;
        if (cellData.style.color) {
          td.style.color = cellData.style.color;
          content.style.color = "inherit";
        }

        const fs = cellData.style.fs || fontSize;
        const lh = cellData.style.lh || lineHeight;
        content.style.fontSize = fs + "px";
        content.style.lineHeight = String(lh);

        cellData.el = td;

        td.addEventListener("mousedown", (e) => onCellMouseDown(e, r, c));
        content.addEventListener("dblclick", () => onCellDblClick(td, content, r, c));
        content.addEventListener("blur", () => {
          const newContent = sanitizeHtml(content.innerHTML);
          if (newContent !== cellData.content) {
            pushHistory();
            cellData.content = newContent;
          }
        });

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    updateGlobalStyles();
    updateSelectionView();
  }

  function parseMatrixFromDOMTable(tableEl: HTMLTableElement) {
    const captionEl = tableEl.querySelector("caption");
    tableCaption = captionEl ? sanitizeHtml(captionEl.innerHTML) : "";
    if (captionEl) {
      captionStyle.fontSize = parseCssNumber(captionEl.style.fontSize, 1, 200) || 16;
      captionStyle.background = captionEl.style.backgroundColor || captionEl.style.background || "";
      captionStyle.color = captionEl.style.color || "";
    }

    const rows: HTMLTableRowElement[] = [];
    Array.from(tableEl.children).forEach((child) => {
      if (child.tagName === "TR") {
        rows.push(child as HTMLTableRowElement);
      } else if (["THEAD", "TBODY", "TFOOT"].includes(child.tagName)) {
        rows.push(...Array.from(child.children).filter((r) => r.tagName === "TR") as HTMLTableRowElement[]);
      }
    });

    const mapH: Record<string, CellStyle["alignH"]> = { left: "align-h-left", center: "align-h-center", right: "align-h-right" };
    const mapV: Record<string, CellStyle["alignV"]> = { top: "align-v-top", middle: "align-v-middle", bottom: "align-v-bottom" };

    const nextMatrix: CellData[][] = [];
    const occupied: boolean[][] = [];

    const ensureRow = (r: number) => {
      while (nextMatrix.length <= r) {
        nextMatrix.push([]);
        occupied.push([]);
      }
    };

    const ensureCell = (r: number, c: number) => {
      ensureRow(r);
      while (nextMatrix[r].length <= c) {
        const col = nextMatrix[r].length;
        nextMatrix[r].push(createCell(r, col));
        occupied[r].push(false);
      }
    };

    rows.forEach((tr, r) => {
      ensureRow(r);
      let c = 0;
      const cells = Array.from(tr.children).filter((cell) => cell.tagName === "TD" || cell.tagName === "TH") as HTMLTableCellElement[];

      cells.forEach((cell) => {
        while (occupied[r][c]) c++;

        const rs = positiveSpan(cell.getAttribute("rowspan"));
        const cs = positiveSpan(cell.getAttribute("colspan"));
        const style = cell.style;
        const alignH = (style.textAlign || tableEl.style.textAlign || "left").toLowerCase();
        const alignV = (style.verticalAlign || tableEl.style.verticalAlign || "middle").toLowerCase();
        const cellFs = parseCssNumber(style.fontSize, 1, 200);
        const cellLh = parseCssNumber(style.lineHeight, 0.1, 10);

        for (let i = 0; i < rs; i++) {
          for (let j = 0; j < cs; j++) {
            ensureCell(r + i, c + j);
          }
        }

        nextMatrix[r][c] = createCell(r, c, {
          content: sanitizeHtml(cell.innerHTML),
          rowSpan: rs,
          colSpan: cs,
          style: {
            bg: style.backgroundColor || style.background || "",
            color: style.color || "",
            alignH: mapH[alignH] || "align-h-left",
            alignV: mapV[alignV] || "align-v-middle",
            fs: cellFs !== "" ? cellFs : undefined,
            lh: cellLh !== "" ? cellLh : undefined,
          },
        });

        for (let i = 0; i < rs; i++) {
          for (let j = 0; j < cs; j++) {
            occupied[r + i][c + j] = true;
          }
        }
        c += cs;
      });
    });

    const maxCols = nextMatrix.reduce((max, row) => Math.max(max, row.length), 0);
    for (let r = 0; r < nextMatrix.length; r++) {
      while (nextMatrix[r].length < maxCols) {
        const c = nextMatrix[r].length;
        nextMatrix[r].push(createCell(r, c));
      }
    }

    matrix = nextMatrix;
  }

  function onCellMouseDown(e: MouseEvent, r: number, c: number) {
    if (e.button !== 0) return;
    const td = (e.target as HTMLElement).closest("td");
    if (td && !td.classList.contains("editing")) {
      e.preventDefault();

      selectedCaption = false;
      const cell = matrix[r]?.[c];
      if (!cell) return;
      startCell = cell;
      endCell = cell;
      updateSelectionView();

      const onMove = (ev: MouseEvent) => {
        const targetTd = (ev.target as HTMLElement).closest("td");
        if (targetTd) {
          const tr = targetTd.dataset.row ? parseInt(targetTd.dataset.row, 10) : -1;
          const tc = targetTd.dataset.col ? parseInt(targetTd.dataset.col, 10) : -1;
          if (tr >= 0 && tc >= 0 && matrix[tr]?.[tc]) {
            if (endCell !== matrix[tr][tc]) {
              endCell = matrix[tr][tc];
              updateSelectionView();
            }
          }
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
  }

  function onCellDblClick(td: HTMLTableCellElement, content: HTMLDivElement, r: number, c: number) {
    td.classList.add("editing");
    content.contentEditable = "true";
    content.focus();

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(content);
    sel?.removeAllRanges();
    sel?.addRange(range);

    const blurHandler = () => {
      td.classList.remove("editing");
      content.contentEditable = "false";
      if (matrix[r]?.[c]) {
        const newContent = sanitizeHtml(content.innerHTML);
        if (newContent !== matrix[r][c].content) {
          pushHistory();
          matrix[r][c].content = newContent;
        }
      }
      content.removeEventListener("blur", blurHandler);
    };

    content.addEventListener("blur", blurHandler);
  }

  function doMerge() {
    if (selectedCaption) {
      showToast("标题不能合并");
      return;
    }
    const bounds = getSelectionBounds();
    if (!bounds) return;
    if (!canMergeSelection()) {
      showToast("不能部分包含已有合并单元格");
      return;
    }

    pushHistory();
    const { minR, maxR, minC, maxC } = bounds;
    const master = matrix[minR][minC];
    const selectedMasters = getSelectedMasterCells(bounds);

    const txt: string[] = [];
    selectedMasters.forEach((cell) => {
      if (cell.content) txt.push(cell.content);
      if (cell !== master) {
        cell.backup = { content: cell.content, style: { ...cell.style } };
        cell.rowSpan = 1;
        cell.colSpan = 1;
      }
    });

    master.rowSpan = maxR - minR + 1;
    master.colSpan = maxC - minC + 1;
    master.content = txt.join(" ");
    master.style.alignH = "align-h-center";
    master.style.alignV = "align-v-middle";

    renderTable();
    startCell = master;
    endCell = master;
    updateSelectionView();
  }

  function doSplit() {
    if (selectedCaption) {
      showToast("标题不能拆分");
      return;
    }
    if (!startCell) return;
    const master = startCell;
    if (master.rowSpan === 1 && master.colSpan === 1) return;

    pushHistory();
    const baseR = master.r;
    const baseC = master.c;

    for (let r = baseR; r < baseR + master.rowSpan; r++) {
      for (let c = baseC; c < baseC + master.colSpan; c++) {
        const cell = matrix[r]?.[c];
        if (!cell) continue;
        cell.rowSpan = 1;
        cell.colSpan = 1;
        cell.style.alignH = "align-h-left";
        cell.style.alignV = "align-v-middle";
        if (r !== baseR || c !== baseC) {
          if (cell.backup) {
            cell.content = cell.backup.content;
            cell.style = cell.backup.style;
            delete cell.backup;
          } else {
            cell.content = "";
          }
        }
      }
    }

    renderTable();
  }

  function applyStyle(type: keyof CellStyle | "background", val: any) {
    if (selectedCaption) {
      if (type === "background") {
        pushHistory();
        captionStyle.background = val;
        renderTable();
      } else if (type === "color") {
        pushHistory();
        captionStyle.color = val;
        renderTable();
      } else {
        showToast("标题仅支持背景色与文字色");
      }
      return;
    }

    const selectedMasters = getSelectedMasterCells();
    if (selectedMasters.length === 0) return;

    pushHistory();
    selectedMasters.forEach((cell) => {
      if (type === "background") cell.style.bg = val;
      if (type === "color") cell.style.color = val;
      if (type === "alignH") cell.style.alignH = val;
      if (type === "alignV") cell.style.alignV = val;
      if (type === "fs") cell.style.fs = val;
      if (type === "lh") cell.style.lh = val;
    });

    renderTable();
    updateSelectionView();
  }

  function setFontSize(val: number) {
    let newSize = Math.round(val);
    if (isNaN(newSize)) return;
    if (newSize < 8) newSize = 8;
    if (newSize > 120) newSize = 120;

    if (selectedCaption) {
      pushHistory();
      captionStyle.fontSize = newSize;
      renderTable();
      updateSelectionView();
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      showToast("请先选择单元格或点击标题");
      const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
      if (fsValEl) fsValEl.value = String(fontSize);
      return;
    }

    pushHistory();
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      for (let c = bounds.minC; c <= bounds.maxC; c++) {
        const cell = matrix[r][c];
        cell.style.fs = newSize;
      }
    }
    renderTable();
    updateSelectionView();
  }

  function adjustFontSize(delta: number) {
    if (selectedCaption) {
      setFontSize(captionStyle.fontSize + delta);
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      showToast("请先选择单元格或点击标题");
      return;
    }

    const master = getMasterCell(bounds.minR, bounds.minC);
    const currentFs = master?.style.fs ? master.style.fs : fontSize;
    setFontSize(currentFs + delta);
  }

  function setLineHeight(val: number) {
    if (selectedCaption) {
      showToast("行高仅适用于单元格");
      const lhValEl = dialogEl.querySelector("#at-lh-val") as HTMLInputElement | null;
      if (lhValEl) lhValEl.value = String(lineHeight);
      return;
    }

    let newLh = Math.round(val * 10) / 10;
    if (isNaN(newLh)) return;
    if (newLh < 1.0) newLh = 1.0;
    if (newLh > 5.0) newLh = 5.0;

    pushHistory();
    lineHeight = newLh;

    const masters = getSelectedMasterCells();
    if (masters.length > 0) {
      masters.forEach((cell) => { cell.style.lh = lineHeight; });
    }
    renderTable();
    updateSelectionView();
    updateGlobalStyles();
  }

  function adjustLineHeight(delta: number) {
    setLineHeight(lineHeight + delta);
  }

  function setBorderWidth(val: number) {
    let newBw = Math.round(val * 10) / 10;
    if (isNaN(newBw)) return;
    if (newBw < 0) newBw = 0;
    if (newBw > 20) newBw = 20;

    pushHistory();
    borderWidth = newBw;
    updateGlobalStyles();
  }

  function adjustBorderWidth(delta: number) {
    if (delta > 0) {
      if (borderWidth < 0.5) {
        setBorderWidth(0.5);
      } else {
        setBorderWidth(Math.round((borderWidth + 0.5) * 2) / 2);
      }
    } else {
      if (borderWidth <= 0.5 && borderWidth > 0.1) {
        setBorderWidth(0.1);
      } else if (borderWidth <= 0.1) {
        setBorderWidth(0);
      } else {
        setBorderWidth(Math.round((borderWidth - 0.5) * 2) / 2);
      }
    }
  }

  function setPaddingWidth(val: number) {
    let newPad = Math.round(val);
    if (isNaN(newPad)) return;
    if (newPad < 0) newPad = 0;
    if (newPad > 50) newPad = 50;

    pushHistory();
    paddingWidth = newPad;
    updateGlobalStyles();
  }

  function adjustPaddingWidth(delta: number) {
    setPaddingWidth(paddingWidth + delta);
  }

  function resetGlobalParams() {
    pushHistory();
    lineHeight = 1.4;
    borderWidth = 0.1;
    paddingWidth = 4;
    updateGlobalStyles();
    renderTable();
    updateSelectionView();
    showToast("已重置默认行高(1.4)、边框(0.1px)与内边距(4px)");
  }

  function generateCleanHtml(): string {
    const bWidth = borderWidth;
    const pWidth = paddingWidth;
    const fSize = fontSize;
    const lHeight = lineHeight;

    let html = '<div style="text-align: center;">\n';
    html += `<table align="center" style="border-collapse: collapse; margin: 10px auto; border: ${bWidth}px solid #888888; font-size: ${fSize}px; line-height: ${lHeight};">\n`;

    if (tableCaption) {
      const fs = captionStyle.fontSize + "px";
      const bg = captionStyle.background || "";
      const color = captionStyle.color || "";
      const styles: string[] = [];
      if (fs) styles.push(`font-size: ${fs}`);
      if (bg) styles.push(`background-color: ${bg}`);
      if (color) styles.push(`color: ${color}`);
      const styleAttr = styles.length ? ` style="${styles.join("; ")}"` : "";
      html += `<caption${styleAttr}>${sanitizeHtml(tableCaption)}</caption>\n`;
    }

    const colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children.length > 0) {
      html += "<colgroup>\n";
      Array.from(colgroup.querySelectorAll("col")).forEach((col) => {
        const w = (col as HTMLElement).style.width || "auto";
        html += `<col style="width: ${w}">\n`;
      });
      html += "</colgroup>\n";
    }

    for (let r = 0; r < matrix.length; r++) {
      let emptyRow = true;
      for (let c = 0; c < getMatrixColumnCount(); c++) {
        const cell = getMasterCell(r, c);
        if (cell && cell.content.trim() !== "") {
          emptyRow = false;
          break;
        }
      }

      const rowStyle = emptyRow ? ' style="height:1.2em"' : "";
      html += `  <tr${rowStyle}>\n`;

      for (let c = 0; c < matrix[r].length; c++) {
        const cell = matrix[r][c];

        let isCovered = false;
        for (let checkR = 0; checkR <= r && !isCovered; checkR++) {
          for (let checkC = 0; checkC <= c && !isCovered; checkC++) {
            if (checkR === r && checkC === c) continue;
            const potentialMaster = matrix[checkR]?.[checkC];
            if (
              potentialMaster &&
              checkR + potentialMaster.rowSpan > r &&
              checkC + potentialMaster.colSpan > c
            ) {
              isCovered = true;
            }
          }
        }
        if (isCovered) continue;

        const attrs: string[] = [];
        if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
        if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);

        const styles: string[] = [];
        if (cell.style.bg) styles.push(`background-color: ${cell.style.bg}`);
        if (cell.style.color) styles.push(`color: ${cell.style.color}`);
        if (cell.style.fs) styles.push(`font-size: ${cell.style.fs}px`);
        if (cell.style.lh) styles.push(`line-height: ${cell.style.lh}`);

        if (cell.style.alignH === "align-h-center") styles.push("text-align: center");
        else if (cell.style.alignH === "align-h-right") styles.push("text-align: right");
        else styles.push("text-align: left");

        if (cell.style.alignV === "align-v-top") styles.push("vertical-align: top");
        else if (cell.style.alignV === "align-v-bottom") styles.push("vertical-align: bottom");
        else styles.push("vertical-align: middle");

        styles.push(`padding: ${pWidth}px`);
        styles.push(`border: ${bWidth}px solid #888888`);

        if (cell.colSpan === 1) {
          const col = table.querySelector(`col[data-col="${c}"]`) as HTMLElement;
          if (col && col.style.width) {
            styles.push(`width: ${col.style.width}`);
          }
        }

        attrs.push(`style="${styles.join("; ")}"`);

        let cellContent = sanitizeHtml(cell.content);
        if (cellContent.trim() === "") {
          cellContent = "&nbsp;";
        }

        html += `    <td ${attrs.join(" ")}>${cellContent}</td>\n`;
      }

      html += "  </tr>\n";
    }

    html += "</table>\n</div>";
    return html;
  }

  function initColorPicker() {
    const grid = dialogEl.querySelector("#at-colorGrid") as HTMLElement;
    grid.innerHTML = "";
    presetColors.forEach((c) => {
      const div = document.createElement("div");
      div.className = "at-c-swatch";
      div.style.background = c;
      div.onclick = () => {
        applyStyle(colorTarget === "textBackground" ? "color" : colorTarget, c);
        const picker = dialogEl.querySelector("#at-colorPicker") as HTMLElement;
        if (picker) picker.style.display = "none";
      };
      grid.appendChild(div);
    });

    const deselectDiv = document.createElement("div");
    deselectDiv.className = "at-c-swatch-deselect";
    deselectDiv.textContent = "✕ 取消颜色";
    deselectDiv.onclick = () => {
      const selectedMasters = getSelectedMasterCells();
      if (selectedMasters.length > 0) {
        pushHistory();
        if (colorTarget === "color") {
          selectedMasters.forEach((cell) => { cell.style.color = ""; });
        } else if (colorTarget === "textBackground") {
          selectedMasters.forEach((cell) => {
            if (cell.content) cell.content = stripSpanStyle(cell.content, "background-color");
          });
        } else {
          selectedMasters.forEach((cell) => { cell.style.bg = ""; });
        }
        renderTable();
        updateSelectionView();
      }
      const picker = dialogEl.querySelector("#at-colorPicker") as HTMLElement;
      if (picker) picker.style.display = "none";
    };
    grid.appendChild(deselectDiv);
  }

  function rebuildMatrix(operation: string, targetRow: number, targetCol: number) {
    const R = matrix.length;
    if (R === 0) return;
    const C = getMatrixColumnCount();
    const targetCell = matrix[targetRow]?.[targetCol];
    if (!targetCell || C === 0) return;

    pushHistory();

    const startCells: { r: number; c: number; rowSpan: number; colSpan: number; content: string; style: CellStyle }[] = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const cell = matrix[r]?.[c];
        if (cell && getMasterCell(r, c) === cell) {
          startCells.push({
            r,
            c,
            rowSpan: cell.rowSpan || 1,
            colSpan: cell.colSpan || 1,
            content: cell.content || "",
            style: { ...cell.style },
          });
        }
      }
    }

    let newR = R;
    let newC = C;
    const adjusted: typeof startCells = [];
    const rowBoundary = operation === "insertRowBelow" ? targetRow + (targetCell.rowSpan || 1) : targetRow;
    const colBoundary = operation === "insertColRight" ? targetCol + (targetCell.colSpan || 1) : targetCol;

    for (const cell of startCells) {
      let { r, c, rowSpan, colSpan, content, style } = cell;
      let keep = true;

      if (operation === "insertRowAbove" || operation === "insertRowBelow") {
        if (r >= rowBoundary) r += 1;
        else if (r + rowSpan > rowBoundary) rowSpan += 1;
        newR = R + 1;
      } else if (operation === "insertColLeft" || operation === "insertColRight") {
        if (c >= colBoundary) c += 1;
        else if (c + colSpan > colBoundary) colSpan += 1;
        newC = C + 1;
      } else if (operation === "deleteRow") {
        if (cell.r <= targetRow && targetRow < cell.r + cell.rowSpan) {
          if (rowSpan === 1) keep = false;
          else rowSpan -= 1;
        } else if (r > targetRow) r -= 1;
        newR = R - 1;
      } else if (operation === "deleteCol") {
        if (cell.c <= targetCol && targetCol < cell.c + cell.colSpan) {
          if (colSpan === 1) keep = false;
          else colSpan -= 1;
        } else if (c > targetCol) c -= 1;
        newC = C - 1;
      } else if (operation === "moveRowUp") {
        if (r === targetRow) r = targetRow - 1;
        else if (r === targetRow - 1) r = targetRow;
      } else if (operation === "moveRowDown") {
        if (r === targetRow) r = targetRow + 1;
        else if (r === targetRow + 1) r = targetRow;
      } else if (operation === "moveColLeft") {
        if (c === targetCol) c = targetCol - 1;
        else if (c === targetCol - 1) c = targetCol;
      } else if (operation === "moveColRight") {
        if (c === targetCol) c = targetCol + 1;
        else if (c === targetCol + 1) c = targetCol;
      }

      if (keep) {
        adjusted.push({ r, c, rowSpan, colSpan, content, style });
      }
    }

    newR = Math.max(0, newR);
    newC = Math.max(0, newC);

    const newMatrix: CellData[][] = [];
    const occupied: boolean[][] = [];
    for (let r = 0; r < newR; r++) {
      newMatrix[r] = [];
      occupied[r] = [];
      for (let c = 0; c < newC; c++) {
        newMatrix[r][c] = createCell(r, c);
        occupied[r][c] = false;
      }
    }

    for (const cell of adjusted) {
      if (cell.r < 0 || cell.c < 0 || cell.r >= newR || cell.c >= newC) continue;
      cell.rowSpan = Math.min(cell.rowSpan, newR - cell.r);
      cell.colSpan = Math.min(cell.colSpan, newC - cell.c);

      newMatrix[cell.r][cell.c] = createCell(cell.r, cell.c, {
        content: cell.content,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
        style: cell.style,
      });

      for (let i = 0; i < cell.rowSpan; i++) {
        for (let j = 0; j < cell.colSpan; j++) {
          occupied[cell.r + i][cell.c + j] = true;
        }
      }
    }

    let nextSelRow = targetRow;
    let nextSelCol = targetCol;

    if (operation === "insertRowAbove") {
      nextSelRow = targetRow + 1;
    } else if (operation === "insertRowBelow") {
      nextSelRow = targetRow;
    } else if (operation === "insertColLeft") {
      nextSelCol = targetCol + 1;
    } else if (operation === "insertColRight") {
      nextSelCol = targetCol;
    } else if (operation === "moveRowUp") {
      nextSelRow = targetRow - 1;
    } else if (operation === "moveRowDown") {
      nextSelRow = targetRow + 1;
    } else if (operation === "moveColLeft") {
      nextSelCol = targetCol - 1;
    } else if (operation === "moveColRight") {
      nextSelCol = targetCol + 1;
    } else if (operation === "deleteRow") {
      nextSelRow = Math.min(targetRow, newR - 1);
    } else if (operation === "deleteCol") {
      nextSelCol = Math.min(targetCol, newC - 1);
    }

    matrix = newMatrix;
    renderTable();

    nextSelRow = Math.max(0, Math.min(newR - 1, nextSelRow));
    nextSelCol = Math.max(0, Math.min(newC - 1, nextSelCol));

    if (newR > 0 && newC > 0 && matrix[nextSelRow]?.[nextSelCol]) {
      const selMaster = getMasterCell(nextSelRow, nextSelCol) || matrix[nextSelRow][nextSelCol];
      startCell = selMaster;
      endCell = selMaster;
      selectedCaption = false;
    } else {
      resetSelection();
    }
    updateSelectionView();
  }

  function bindEvents() {
    function getTargetRowCol(): { r: number; c: number } {
      if (startCell && isCurrentCell(startCell)) {
        return { r: startCell.r, c: startCell.c };
      }
      return { r: 0, c: 0 };
    }

    dialogEl.querySelector("#at-btn-undo")?.addEventListener("click", undo);
    dialogEl.querySelector("#at-btn-redo")?.addEventListener("click", redo);
    dialogEl.querySelector("#at-btn-select-all")?.addEventListener("click", () => {
      const lastRow = matrix.length - 1;
      const lastCol = getMatrixColumnCount() - 1;
      if (lastRow >= 0 && lastCol >= 0 && matrix[0]?.[0] && matrix[lastRow]?.[lastCol]) {
        selectedCaption = false;
        startCell = matrix[0][0];
        endCell = matrix[lastRow][lastCol];
        updateSelectionView();
        showToast("已全选");
      }
    });

    dialogEl.querySelector("#at-btn-caption")?.addEventListener("click", () => {
      pushHistory();
      if (tableCaption) {
        tableCaption = "";
        selectedCaption = false;
      } else {
        tableCaption = "表格标题";
        selectedCaption = true;
      }
      renderTable();
    });

    dialogEl.querySelector("#at-btn-insert-col-left")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertColLeft", t.r, t.c);
      showToast("已在左侧插入列");
    });
    dialogEl.querySelector("#at-btn-insert-col-right")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertColRight", t.r, t.c);
      showToast("已在右侧插入列");
    });
    dialogEl.querySelector("#at-btn-insert-row-above")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertRowAbove", t.r, t.c);
      showToast("已在上方插入行");
    });
    dialogEl.querySelector("#at-btn-insert-row-below")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertRowBelow", t.r, t.c);
      showToast("已在下方插入行");
    });

    dialogEl.querySelector("#at-btn-delete-row")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (matrix.length <= 1) {
        showToast("无法删除最后一行");
        return;
      }
      rebuildMatrix("deleteRow", t.r, t.c);
      showToast("已删除当前行");
    });
    dialogEl.querySelector("#at-btn-delete-col")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (getMatrixColumnCount() <= 1) {
        showToast("无法删除最后一列");
        return;
      }
      rebuildMatrix("deleteCol", t.r, t.c);
      showToast("已删除当前列");
    });

    dialogEl.querySelector("#at-btn-move-row-up")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveRowUp(t.r)) {
        showToast("无法向上移动该行");
        return;
      }
      rebuildMatrix("moveRowUp", t.r, t.c);
      showToast("行已上移");
    });
    dialogEl.querySelector("#at-btn-move-row-down")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveRowDown(t.r)) {
        showToast("无法向下移动该行");
        return;
      }
      rebuildMatrix("moveRowDown", t.r, t.c);
      showToast("行已下移");
    });
    dialogEl.querySelector("#at-btn-move-col-left")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveColLeft(t.c)) {
        showToast("无法向左移动该列");
        return;
      }
      rebuildMatrix("moveColLeft", t.r, t.c);
      showToast("列已左移");
    });
    dialogEl.querySelector("#at-btn-move-col-right")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveColRight(t.c)) {
        showToast("无法向右移动该列");
        return;
      }
      rebuildMatrix("moveColRight", t.r, t.c);
      showToast("列已右移");
    });

    dialogEl.querySelector("#at-btn-merge")?.addEventListener("click", doMerge);
    dialogEl.querySelector("#at-btn-split")?.addEventListener("click", doSplit);

    dialogEl.querySelector("#at-btn-h-left")?.addEventListener("click", () => applyStyle("alignH", "align-h-left"));
    dialogEl.querySelector("#at-btn-h-center")?.addEventListener("click", () => applyStyle("alignH", "align-h-center"));
    dialogEl.querySelector("#at-btn-h-right")?.addEventListener("click", () => applyStyle("alignH", "align-h-right"));

    dialogEl.querySelector("#at-btn-v-top")?.addEventListener("click", () => applyStyle("alignV", "align-v-top"));
    dialogEl.querySelector("#at-btn-v-middle")?.addEventListener("click", () => applyStyle("alignV", "align-v-middle"));
    dialogEl.querySelector("#at-btn-v-bottom")?.addEventListener("click", () => applyStyle("alignV", "align-v-bottom"));

    const pickerEl = dialogEl.querySelector("#at-colorPicker") as HTMLElement;

    let activeColorBtn: HTMLElement | null = null;
    function positionColorPicker(btn: HTMLElement) {
      if (pickerEl.style.display === "block" && activeColorBtn === btn) {
        pickerEl.style.display = "none";
        activeColorBtn = null;
        return;
      }
      activeColorBtn = btn;
      
      const rect = btn.getBoundingClientRect();
      const rootEl = dialogEl.querySelector(".at-dialog-root") as HTMLElement;
      const rootRect = rootEl.getBoundingClientRect();
      
      let left = rect.left - rootRect.left;
      if (left + 160 > rootRect.width) {
        left = rootRect.width - 160;
      }
      
      let top = rect.bottom - rootRect.top + 4;
      if (top + 150 > rootRect.height) {
        top = rect.top - rootRect.top - 150 - 4;
      }
      
      pickerEl.style.left = left + "px";
      pickerEl.style.top = top + "px";
      pickerEl.style.display = "block";
    }

    dialogEl.querySelector("#at-btn-bg-color")?.addEventListener("click", (e) => {
      colorTarget = "background";
      positionColorPicker(e.currentTarget as HTMLElement);
    });

    dialogEl.querySelector("#at-btn-text-color")?.addEventListener("click", (e) => {
      colorTarget = "color";
      positionColorPicker(e.currentTarget as HTMLElement);
    });

    dialogEl.querySelector("#at-btn-clear")?.addEventListener("click", () => {
      const selectedMasters = getSelectedMasterCells();
      if (selectedMasters.length > 0) {
        pushHistory();
        selectedMasters.forEach((cell) => {
          cell.style = {
            bg: "",
            color: "",
            alignH: "align-h-left",
            alignV: "align-v-middle",
            fs: undefined,
            lh: undefined,
          };
          cell.content = sanitizeHtml(cell.content.replace(/<[^>]+>/g, ""));
        });
        renderTable();
        showToast("已清除所选单元格格式");
      }
    });

    dialogEl.querySelector("#at-fs-minus")?.addEventListener("click", () => adjustFontSize(-1));
    dialogEl.querySelector("#at-fs-plus")?.addEventListener("click", () => adjustFontSize(1));
    dialogEl.querySelector("#at-lh-minus")?.addEventListener("click", () => adjustLineHeight(-0.1));
    dialogEl.querySelector("#at-lh-plus")?.addEventListener("click", () => adjustLineHeight(0.1));
    dialogEl.querySelector("#at-bw-minus")?.addEventListener("click", () => adjustBorderWidth(-0.1));
    dialogEl.querySelector("#at-bw-plus")?.addEventListener("click", () => adjustBorderWidth(0.1));
    dialogEl.querySelector("#at-pad-minus")?.addEventListener("click", () => adjustPaddingWidth(-1));
    dialogEl.querySelector("#at-pad-plus")?.addEventListener("click", () => adjustPaddingWidth(1));

    dialogEl.querySelector("#at-btn-reset-globals")?.addEventListener("click", resetGlobalParams);

    const setupNumericInput = (id: string, getValue: () => number, setValue: (v: number) => void) => {
      const inputEl = dialogEl.querySelector(id) as HTMLInputElement | null;
      if (!inputEl) return;
      const commit = () => {
        const parsed = parseFloat(inputEl.value);
        if (isNaN(parsed)) {
          inputEl.value = String(getValue());
        } else {
          setValue(parsed);
        }
      };
      inputEl.addEventListener("change", commit);
      inputEl.addEventListener("blur", commit);
      inputEl.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          inputEl.blur();
        }
      });
      inputEl.addEventListener("keyup", (e) => e.stopPropagation());
    };

    setupNumericInput("#at-lh-val", () => lineHeight, setLineHeight);
    setupNumericInput("#at-bw-val", () => borderWidth, setBorderWidth);
    setupNumericInput("#at-pad-val", () => paddingWidth, setPaddingWidth);
    setupNumericInput("#at-fs-val", () => selectedCaption ? captionStyle.fontSize : (getMasterCell(getSelectionBounds()?.minR ?? 0, getSelectionBounds()?.minC ?? 0)?.style.fs || fontSize), setFontSize);

    dialogEl.querySelector("#at-btn-copy")?.addEventListener("click", () => {
      const code = generateCleanHtml();
      navigator.clipboard.writeText(code).then(() => {
        showToast("HTML 代码已复制到剪贴板");
      });
    });

    const importModal = dialogEl.querySelector("#at-importModal") as HTMLElement;
    dialogEl.querySelector("#at-btn-import")?.addEventListener("click", () => {
      importModal.style.display = "flex";
    });
    dialogEl.querySelector("#at-btn-cancel-import")?.addEventListener("click", () => {
      importModal.style.display = "none";
    });
    dialogEl.querySelector("#at-btn-confirm-import")?.addEventListener("click", () => {
      const textarea = dialogEl.querySelector("#at-importCode") as HTMLTextAreaElement;
      let code = textarea.value.trim();
      if (!code) return;

      if (!/<table[\s>]/i.test(code)) {
        const mdHtml = markdownToHtmlTable(code);
        if (mdHtml) code = mdHtml;
      }

      try {
        const doc = new DOMParser().parseFromString(code, "text/html");
        const tableEl = doc.querySelector("table");
        if (!tableEl) {
          alert("未检测到有效的 <table> 标签或 Markdown 表格");
          return;
        }

        pushHistory();
        parseMatrixFromDOMTable(tableEl);
        resetSelection();
        renderTable();
        importModal.style.display = "none";
        showToast("代码导入成功");
      } catch (err: any) {
        alert("导入失败: " + err.message);
      }
    });

    const contextMenu = dialogEl.querySelector("#at-contextMenu") as HTMLElement;
    let contextTarget: { r: number; c: number } | null = null;

    table.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const td = (e.target as HTMLElement).closest("td");
      if (!td) return;

      const r = td.dataset.row ? parseInt(td.dataset.row, 10) : -1;
      const c = td.dataset.col ? parseInt(td.dataset.col, 10) : -1;
      if (r < 0 || c < 0) return;

      contextTarget = { r, c };

      const bounds = getSelectionBounds();
      const cell = matrix[r]?.[c];
      if (cell) {
        if (!bounds || r < bounds.minR || r > bounds.maxR || c < bounds.minC || c > bounds.maxC) {
          startCell = cell;
          endCell = cell;
          selectedCaption = false;
          updateSelectionView();
        }
      }

      const itemMerge = contextMenu.querySelector('[data-action="merge"]');
      const itemSplit = contextMenu.querySelector('[data-action="split"]');
      const itemMoveUp = contextMenu.querySelector('[data-action="moveRowUp"]');
      const itemMoveDown = contextMenu.querySelector('[data-action="moveRowDown"]');
      const itemMoveLeft = contextMenu.querySelector('[data-action="moveColLeft"]');
      const itemMoveRight = contextMenu.querySelector('[data-action="moveColRight"]');

      if (itemMerge) itemMerge.classList.toggle("disabled", !canMergeSelection());
      if (itemSplit) itemSplit.classList.toggle("disabled", !(startCell && (startCell.rowSpan > 1 || startCell.colSpan > 1)));
      if (itemMoveUp) itemMoveUp.classList.toggle("disabled", !canMoveRowUp(r));
      if (itemMoveDown) itemMoveDown.classList.toggle("disabled", !canMoveRowDown(r));
      if (itemMoveLeft) itemMoveLeft.classList.toggle("disabled", !canMoveColLeft(c));
      if (itemMoveRight) itemMoveRight.classList.toggle("disabled", !canMoveColRight(c));

      // 限制右键菜单位置不超出屏幕边界
      const menuWidth = 160;
      const menuHeight = 360;
      let left = e.clientX;
      let top = e.clientY;
      if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
      if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8;

      contextMenu.style.display = "block";
      contextMenu.style.left = left + "px";
      contextMenu.style.top = top + "px";
    });


    contextMenu.querySelectorAll(".at-menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        if ((item as HTMLElement).classList.contains("disabled")) return;
        const action = (item as HTMLElement).dataset.action;
        if (!action) return;

        if (action === "merge") {
          doMerge();
        } else if (action === "split") {
          doSplit();
        } else if (action === "alignCenter") {
          applyStyle("alignH", "align-h-center");
          applyStyle("alignV", "align-v-middle");
        } else if (action === "clearStyle") {
          const selectedMasters = getSelectedMasterCells();
          if (selectedMasters.length > 0) {
            pushHistory();
            selectedMasters.forEach((c) => {
              c.style = {
                bg: "",
                color: "",
                alignH: "align-h-left",
                alignV: "align-v-middle",
                fs: undefined,
                lh: undefined,
              };
              c.content = sanitizeHtml(c.content.replace(/<[^>]+>/g, ""));
            });
            renderTable();
            showToast("已清除样式");
          }
        } else if (action === "copyCellContent") {
          const selectedMasters = getSelectedMasterCells();
          const txt = selectedMasters.map((c) => c.content.replace(/<[^>]+>/g, "").trim()).join("\t");
          navigator.clipboard.writeText(txt).then(() => showToast("已复制文本"));
        } else if (contextTarget) {
          rebuildMatrix(action, contextTarget.r, contextTarget.c);
        }
        contextMenu.style.display = "none";
      });
    });

    document.addEventListener("click", (e) => {
      const target = e.target as Node;
      if (contextMenu && !contextMenu.contains(target)) {
        contextMenu.style.display = "none";
      }
      if (pickerEl && pickerEl.style.display === "block") {
        const btnBg = dialogEl.querySelector("#at-btn-bg-color");
        const btnText = dialogEl.querySelector("#at-btn-text-color");
        if (!pickerEl.contains(target) && !btnBg?.contains(target) && !btnText?.contains(target)) {
          pickerEl.style.display = "none";
        }
      }
    });


    dialogEl.querySelector("#at-btn-dialog-cancel")?.addEventListener("click", () => {
      dialog.destroy();
    });

    dialogEl.querySelector("#at-btn-dialog-save")?.addEventListener("click", async () => {
      const cleanHtml = generateCleanHtml();
      try {
        await te.saveHtmlTable(cleanHtml);
        showMessage("HTML 表格保存更新成功！");
        dialog.destroy();
      } catch (err) {
        logger.error("Save HTML Table failed:", err);
        showMessage("保存更新失败，请重试");
      }
    });
  }

  parseMatrixFromDOMTable(tableClone);
  initColorPicker();
  renderTable();
  bindEvents();
  updateHistoryButtons();
}
