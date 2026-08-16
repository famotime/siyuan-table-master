import { fetchSyncPost, showMessage } from "siyuan";
import { escapeHtml } from "./dom-utils";
import { logger } from "./logger";

export { escapeHtml };

/**
 * 转换 HTML 单元格内联元素为 Markdown 语法
 */
export function elementToMarkdown(element: Element | Node): string {
  let result = "";
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      // 转义管道符 |
      result += (child.textContent || "").replace(/\|/g, "\\|");
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const innerText = elementToMarkdown(el);

      switch (tagName) {
        case "b":
        case "strong":
          result += innerText.trim() ? `**${innerText.trim()}**` : "";
          break;
        case "i":
        case "em":
          result += innerText.trim() ? `*${innerText.trim()}*` : "";
          break;
        case "code":
          result += innerText.trim() ? `\`${innerText.trim()}\`` : "";
          break;
        case "del":
        case "s":
        case "strike":
          result += innerText.trim() ? `~~${innerText.trim()}~~` : "";
          break;
        case "a":
          const href = el.getAttribute("href");
          if (href) {
            result += `[${innerText}](${href})`;
          } else {
            result += innerText;
          }
          break;
        case "br":
          result += "<br>";
          break;
        case "p":
        case "div":
          result += innerText + "<br>";
          break;
        default:
          result += innerText;
          break;
      }
    }
  }
  return result;
}

/**
 * 获取单元格文本对齐属性
 */
export function getCellAlignment(el: Element): "left" | "center" | "right" | "" {
  const alignAttr = el.getAttribute("align")?.toLowerCase();
  if (alignAttr === "left" || alignAttr === "center" || alignAttr === "right") {
    return alignAttr;
  }
  const style = el.getAttribute("style") || "";
  const match = style.match(/text-align\s*:\s*(left|center|right)/i);
  if (match) {
    return match[1].toLowerCase() as "left" | "center" | "right";
  }
  return "";
}

/**
 * 检测表格是否包含合并单元格 (colspan > 1 或 rowspan > 1 或 fn__none 样式类)
 */
export function hasMergedCells(table: HTMLTableElement): boolean {
  const cells = table.querySelectorAll("td, th");
  for (const cell of Array.from(cells)) {
    const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
    const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10);
    if (colspan > 1 || rowspan > 1 || cell.classList.contains("fn__none")) {
      return true;
    }
  }
  return false;
}

/**
 * 将标准 HTML 表格转换为 GFM Markdown 表格文本
 */
export function tableToGfmMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const grid: { text: string; align: string }[][] = [];
  const colAlignments: string[] = [];

  rows.forEach((tr) => {
    const rowCells: { text: string; align: string }[] = [];
    const cells = Array.from(tr.querySelectorAll("td, th"));
    cells.forEach((cell, colIndex) => {
      const text = elementToMarkdown(cell).replace(/(<br>)+$/gi, "").trim();
      const align = getCellAlignment(cell);
      rowCells.push({ text, align });

      if (!colAlignments[colIndex] && align) {
        colAlignments[colIndex] = align;
      }
    });
    grid.push(rowCells);
  });

  if (grid.length === 0) return "";

  const colCount = Math.max(...grid.map(r => r.length));

  // 1. 表头行
  const headerRow = grid[0] || [];
  const headerCells = Array.from({ length: colCount }, (_, i) => headerRow[i]?.text || "");
  const lines: string[] = [];
  lines.push(`| ${headerCells.join(" | ")} |`);

  // 2. 分隔行（对齐声明）
  const sepCells = Array.from({ length: colCount }, (_, i) => {
    const align = colAlignments[i] || (headerRow[i]?.align) || "";
    if (align === "center") return ":---:";
    if (align === "right") return "---:";
    return ":---";
  });
  lines.push(`| ${sepCells.join(" | ")} |`);

  // 3. 数据行
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const rowCells = Array.from({ length: colCount }, (_, i) => row[i]?.text || "");
    lines.push(`| ${rowCells.join(" | ")} |`);
  }

  return lines.join("\n");
}

/**
 * 构建思源表格标准的 caption DOM 字符串与 IAL / 块属性转义值
 * @param captionText - 标题文本内容
 * @param isBottom - 标题是否位于表格底部 (caption-side: bottom)
 */
export function buildSiYuanTableCaption(captionText: string, isBottom = false): {
  captionHtml: string;
  captionIalAttr: string;
} {
  const cleanText = escapeHtml(captionText.trim());
  const styleAttr = isBottom ? ' style="caption-side: bottom;"' : "";
  const captionHtml = `<caption contenteditable="false"${styleAttr}>${cleanText}</caption>`;
  const captionIalAttr = escapeHtml(captionHtml);
  return { captionHtml, captionIalAttr };
}

/**
 * 将包含合并单元格的 HTML 表格转换为思源原生表格 (NodeTable) 所需的 Protyle DOM 结构
 * 彻底清洗内联 CSS 样式，并确保创建 <thead> 结构与 <th> 标签，使思源能解析为 NodeTable 块
 */
export function tableToSiYuanProtyleNodeTableDom(
  table: HTMLTableElement,
  captionInfo?: { captionHtml: string; captionIalAttr: string }
): string {
  const newTable = table.cloneNode(true) as HTMLTableElement;

  // 1. 彻底清除 <table> 上的各种外部 CSS 样式与对齐属性，确保原表格干净
  newTable.removeAttribute("style");
  newTable.removeAttribute("align");
  newTable.removeAttribute("border");
  newTable.removeAttribute("cellpadding");
  newTable.removeAttribute("cellspacing");
  newTable.removeAttribute("class");
  newTable.setAttribute("contenteditable", "true");
  newTable.setAttribute("spellcheck", "false");

  // 1.1 处理 caption 标题
  let finalCaptionInfo = captionInfo;
  const existingCaption = newTable.querySelector("caption");
  if (existingCaption) {
    if (!finalCaptionInfo) {
      const isBottom = existingCaption.style.captionSide === "bottom" ||
        /caption-side\s*:\s*bottom/i.test(existingCaption.getAttribute("style") || "");
      const text = elementToMarkdown(existingCaption).trim();
      if (text) {
        finalCaptionInfo = buildSiYuanTableCaption(text, isBottom);
      }
    }
    existingCaption.remove();
  }

  // 2. 确保包含 <thead>，若原 DOM 仅有 <tbody> 则自动提取首行作为 <thead> 且单元格转为 <th>
  let thead = newTable.querySelector("thead");
  let tbody = newTable.querySelector("tbody");

  if (!thead && tbody) {
    const firstTr = tbody.querySelector("tr");
    if (firstTr) {
      thead = document.createElement("thead");
      newTable.insertBefore(thead, tbody);
      thead.appendChild(firstTr);

      // 如果首行单元格有 rowspan > 1 (例如：区域 跨 2 行)，将第二行/对应跨行也移动到 thead 中
      const firstCells = Array.from(firstTr.querySelectorAll("td, th"));
      const maxRowspan = Math.max(1, ...firstCells.map(c => parseInt(c.getAttribute("rowspan") || "1", 10)));
      if (maxRowspan > 1) {
        const nextTrs = Array.from(tbody.querySelectorAll("tr")).slice(0, maxRowspan - 1);
        nextTrs.forEach(tr => thead!.appendChild(tr));
      }
    }
  }

  // 将 <thead> 中的单元格统一提升为 <th> 标签
  if (thead) {
    const theadTdCells = Array.from(thead.querySelectorAll("td"));
    theadTdCells.forEach(cell => {
      const th = document.createElement("th");
      Array.from(cell.attributes).forEach(attr => th.setAttribute(attr.name, attr.value));
      th.innerHTML = cell.innerHTML;
      cell.parentNode?.replaceChild(th, cell);
    });
  }

  // 3. 构建二维网格阵列并净化所有单元格
  const trs = Array.from(newTable.querySelectorAll("tr"));
  if (trs.length === 0) return "";

  const gridMatrix: (HTMLElement | null)[][] = [];

  trs.forEach((tr, rIdx) => {
    tr.removeAttribute("style");
    tr.removeAttribute("class");

    if (!gridMatrix[rIdx]) gridMatrix[rIdx] = [];
    const cells = Array.from(tr.querySelectorAll("th, td"));
    let cIdx = 0;

    cells.forEach((cell) => {
      if (cell.classList.contains("fn__none")) return;

      while (gridMatrix[rIdx][cIdx] !== undefined) {
        cIdx++;
      }

      const el = cell as HTMLElement;

      // 提取对齐方式，并清理内联 CSS 样式（如 font-size, border, padding, color 等）
      const align = getCellAlignment(el);
      el.removeAttribute("style");
      if (align) {
        el.setAttribute("align", align);
      } else {
        el.removeAttribute("align");
      }

      // 转换富文本
      const mdContent = elementToMarkdown(el).replace(/(<br>)+$/gi, "").trim();
      el.innerHTML = mdContent;

      const colspan = Math.max(1, parseInt(el.getAttribute("colspan") || "1", 10));
      const rowspan = Math.max(1, parseInt(el.getAttribute("rowspan") || "1", 10));

      gridMatrix[rIdx][cIdx] = el;

      const tagName = el.tagName.toLowerCase();

      for (let r = 0; r < rowspan; r++) {
        const targetRow = rIdx + r;
        if (!gridMatrix[targetRow]) gridMatrix[targetRow] = [];
        for (let c = 0; c < colspan; c++) {
          if (r === 0 && c === 0) continue;
          const placeholder = document.createElement(tagName);
          placeholder.className = "fn__none";
          if (align) placeholder.setAttribute("align", align);
          gridMatrix[targetRow][cIdx + c] = placeholder;
        }
      }

      cIdx += colspan;
    });
  });

  const maxCols = Math.max(...gridMatrix.map(row => row.length));

  // 4. 重建每行 <tr> 的单元格节点
  trs.forEach((tr, rIdx) => {
    tr.innerHTML = "";
    const rowCells = gridMatrix[rIdx] || [];
    for (let cIdx = 0; cIdx < maxCols; cIdx++) {
      let cellNode = rowCells[cIdx];
      if (!cellNode) {
        const isInThead = tr.parentNode?.nodeName.toLowerCase() === "thead";
        cellNode = document.createElement(isInThead ? "th" : "td");
        cellNode.className = "fn__none";
      }
      tr.appendChild(cellNode);
    }
  });

  // 5. 重建列定义 colgroup 与 caption
  const existingColgroup = newTable.querySelector("colgroup");
  if (existingColgroup) {
    existingColgroup.remove();
  }

  const colgroup = document.createElement("colgroup");
  colgroup.removeAttribute("style");
  colgroup.innerHTML = "";
  for (let c = 0; c < maxCols; c++) {
    const col = document.createElement("col");
    colgroup.appendChild(col);
  }

  let captionEl: HTMLElement | null = null;
  if (finalCaptionInfo?.captionHtml) {
    const tempDoc = new DOMParser().parseFromString(`<table>${finalCaptionInfo.captionHtml}</table>`, "text/html");
    captionEl = tempDoc.querySelector("caption");
  }

  if (captionEl) {
    newTable.insertBefore(captionEl, newTable.firstChild);
    newTable.insertBefore(colgroup, captionEl.nextSibling);
  } else {
    newTable.insertBefore(colgroup, newTable.firstChild);
  }

  // 6. 递归移除 <table> 内部结构元素中纯粹包含空白/换行符的 DOM Text 节点
  removeEmptyTextNodes(newTable);

  const blockId = generateBlockId();
  const updated = getNowTimestamp();
  const colgroupAttr = maxCols > 1 ? "|".repeat(maxCols - 1) : "";
  const captionAttr = finalCaptionInfo?.captionIalAttr ? ` caption="${finalCaptionInfo.captionIalAttr}"` : "";

  return `<div data-node-id="${blockId}" data-type="NodeTable" class="table" updated="${updated}" colgroup="${colgroupAttr}"${captionAttr}><div contenteditable="false">${newTable.outerHTML}<div class="protyle-action__table"><div class="table__resize"></div><div class="table__select"></div></div></div><div class="protyle-attr" contenteditable="false">​</div></div>`;
}

/**
 * 递归清理 HTML 结构节点中多余的纯空白文本节点（避免产生多余空行与换行符）
 */
export function removeEmptyTextNodes(node: Node): void {
  let child = node.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
      const parentTag = child.parentNode?.nodeName.toLowerCase();
      if (parentTag && ["table", "thead", "tbody", "tr", "colgroup"].includes(parentTag)) {
        child.remove();
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      removeEmptyTextNodes(child);
    }
    child = next;
  }
}

/**
 * 生成合法的思源块 ID (14位时间戳 + '-' + 7位随机小写字母数字)
 */
export function generateBlockId(): string {
  if (typeof window !== "undefined" && (window as any).Lute?.NewNodeID) {
    return (window as any).Lute.NewNodeID();
  }
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomStr = Math.random().toString(36).substring(2, 9).padEnd(7, "0");
  return `${timestamp}-${randomStr}`;
}

/**
 * 获取当前 14位时间戳 (YYYYMMDDHHmmss)
 */
export function getNowTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export interface TableConversionResult {
  dataType: "markdown" | "dom";
  data: string;
  captionText?: string;
}

/**
 * 解析 HTML 文本并转换为思源原生表格 (NodeTable) 转换结果
 * 如果包含 <caption> 标题，将其转换为符合思源表格模型的原生标题（IAL caption 属性与原生 <caption> 节点）
 */
export function htmlToNodeTable(html: string): TableConversionResult | null {
  if (!html) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;

  // 1. 提取 caption 标题信息
  let captionText = "";
  let captionInfo: ReturnType<typeof buildSiYuanTableCaption> | null = null;
  const captionEl = doc.querySelector("caption");
  if (captionEl) {
    captionText = elementToMarkdown(captionEl).trim();
    if (captionText) {
      const isBottom = captionEl.style.captionSide === "bottom" ||
        /caption-side\s*:\s*bottom/i.test(captionEl.getAttribute("style") || "");
      captionInfo = buildSiYuanTableCaption(captionText, isBottom);
    }
    captionEl.remove();
  }

  // 2. 转换表格主结构
  let result: TableConversionResult;
  if (hasMergedCells(table)) {
    const domData = tableToSiYuanProtyleNodeTableDom(table, captionInfo || undefined);
    result = { dataType: "dom", data: domData, captionText };
  } else {
    const gfmData = tableToGfmMarkdown(table);
    if (captionInfo) {
      const ialLine = `{: caption="${captionInfo.captionIalAttr}"}`;
      result = { dataType: "markdown", data: `${gfmData}\n${ialLine}`, captionText };
    } else {
      result = { dataType: "markdown", data: gfmData, captionText: "" };
    }
  }

  return result;
}

/**
 * 执行 HTML 表格转思源原生表格 (NodeTable) 并插入原块下方
 */
export function convertHtmlTableToMarkdown(plugin: any, blockId: string): Promise<void> {
  const i18n = plugin?.i18n || {};
  if (!blockId) {
    showMessage(i18n.noActiveTable || "未找到聚焦的表格", 2000, "error");
    return Promise.resolve();
  }

  return (async () => {
    try {
      const res = await fetchSyncPost("/api/block/getBlockKramdown", { id: blockId });
      let kramdown = "";
      if (res && res.code === 0 && res.data) {
        if (typeof res.data === "string") {
          kramdown = res.data;
        } else if (typeof res.data === "object" && res.data !== null) {
          kramdown = (res.data as any).kramdown || "";
        }
      }

      if (!kramdown) {
        showMessage(i18n.errOperationFailed || "无法获取表格内容", 2000, "error");
        return;
      }

      const conversion = htmlToNodeTable(kramdown);
      if (!conversion) {
        showMessage(i18n.errOperationFailed || "转换原生表格失败", 2000, "error");
        return;
      }

      const insertRes = await fetchSyncPost("/api/block/insertBlock", {
        dataType: conversion.dataType,
        data: conversion.data,
        previousID: blockId,
      });

      if (insertRes && insertRes.code === 0) {
        showMessage(i18n.htmlToMdSuccess || "已成功转换为思源原生表格", 2000, "info");
      } else {
        showMessage(i18n.errOperationFailed || "插入表格块失败", 3000, "error");
      }
    } catch (err) {
      logger.error("[siyuan-table-mater] convertHtmlTableToMarkdown failed:", err);
      showMessage(i18n.errOperationFailed || "转换过程出错", 3000, "error");
    }
  })();
}

interface ActiveHtmlSpan {
  remainingRows: number;
  tagName: string;
}

function getHtmlSpan(attributes: string, name: "colspan" | "rowspan"): number {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"(\\d+)"|'(\\d+)'|(\\d+))`, "i"));
  const value = Number(match?.[1] || match?.[2] || match?.[3] || 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** 从单元格或行 IAL 中移除合并属性，保留其他单元格属性。 */
export function removeMergeAttributes(cell: string): string {
  return cell.replace(/\{:\s*([^}]*)\}/g, (_match, attributes: string) => {
    const remaining = attributes
      .replace(/(?:^|\s+)(?:colspan|rowspan)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s}]+)/gi, "")
      .trim();
    return remaining ? `{: ${remaining}}` : "";
  }).trim();
}

/** 将 HTML 表格转译并解包扩展为思源原生 Markdown 表格行数组与 IAL 行。 */
export function convertHtmlTableToMarkdownKramdown(kramdown: string): { tableLines: string[]; ialLine: string | null } | null {
  if (!/^\s*<table\b/i.test(kramdown)) {
    return null;
  }

  // 提取块级 IAL 行（在 </table> 后以 {: 开头的行）
  const lines = kramdown.split("\n");
  let ialLine: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("{:")) {
      ialLine = lines[i];
      break;
    }
  }

  // 提取 <caption> 标题并合并至 IAL 行
  const captionMatch = kramdown.match(/<caption\b([^>]*)>([\s\S]*?)<\/caption>/i);
  if (captionMatch) {
    const captionAttrs = captionMatch[1] || "";
    const rawCaptionContent = captionMatch[2] || "";
    const isBottom = /caption-side\s*:\s*bottom/i.test(captionAttrs);
    const captionText = rawCaptionContent.replace(/<[^>]+>/g, " ").replace(/[\r\n]+/g, " ").trim();
    if (captionText) {
      const { captionIalAttr } = buildSiYuanTableCaption(captionText, isBottom);
      if (ialLine) {
        if (/caption="[^"]*"/i.test(ialLine)) {
          ialLine = ialLine.replace(/caption="[^"]*"/i, `caption="${captionIalAttr}"`);
        } else {
          ialLine = ialLine.replace(/^(\s*\{:\s*)/, `$1caption="${captionIalAttr}" `);
        }
      } else {
        ialLine = `{: caption="${captionIalAttr}"}`;
      }
    }
  }

  const activeSpans: Array<ActiveHtmlSpan | null> = [];
  const gridRows: string[][] = [];
  let knownColumnCount = 0;

  const trMatches = Array.from(kramdown.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi));
  if (trMatches.length === 0) return null;

  for (const trMatch of trMatches) {
    const rowHtml = trMatch[2];
    const sourceCells = Array.from(rowHtml.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi));
    const currentCells: string[] = [];
    let column = 0;

    const appendActiveSpan = () => {
      const active = activeSpans[column];
      if (!active) return false;
      currentCells.push("");
      active.remainingRows--;
      if (active.remainingRows === 0) activeSpans[column] = null;
      column++;
      return true;
    };

    for (const match of sourceCells) {
      while (appendActiveSpan()) {
        // 占满上一行 rowspan 延续过来的单元格
      }

      const attributes = match[2];
      const rawContent = match[3];
      const cleanedContent = removeMergeAttributes(rawContent)
        .replace(/[\r\n]+/g, " ")
        .trim();

      // 转义未转义的管道符 |
      const cellText = cleanedContent.replace(/(^|[^\\])\|/g, "$1\\|");

      const colSpan = getHtmlSpan(attributes, "colspan");
      const rowSpan = getHtmlSpan(attributes, "rowspan");

      currentCells.push(cellText);
      for (let offset = 1; offset < colSpan; offset++) {
        currentCells.push("");
      }

      if (rowSpan > 1) {
        for (let offset = 0; offset < colSpan; offset++) {
          activeSpans[column + offset] = { remainingRows: rowSpan - 1, tagName: match[1].toLowerCase() };
        }
      }

      column += colSpan;
    }

    const targetColumnCount = Math.max(knownColumnCount, activeSpans.length, column);
    while (column < targetColumnCount) {
      if (!appendActiveSpan()) {
        currentCells.push("");
        column++;
      }
    }

    knownColumnCount = Math.max(knownColumnCount, currentCells.length);
    gridRows.push(currentCells);
  }

  if (gridRows.length === 0) return null;

  const tableLines: string[] = [];
  const colCount = Math.max(knownColumnCount, gridRows[0]?.length || 0);

  // 表头行 (Header)
  const headerCells = Array.from({ length: colCount }, (_, i) => gridRows[0]?.[i] ?? "");
  tableLines.push(`| ${headerCells.join(" | ")} |`);

  // 分隔行 (Separator)
  const separatorCells = Array.from({ length: colCount }, () => "---");
  tableLines.push(`| ${separatorCells.join(" | ")} |`);

  // 数据行 (Data)
  for (let r = 1; r < gridRows.length; r++) {
    const rowCells = Array.from({ length: colCount }, (_, i) => gridRows[r]?.[i] ?? "");
    tableLines.push(`| ${rowCells.join(" | ")} |`);
  }

  return { tableLines, ialLine };
}
