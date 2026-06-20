import { getActiveEditor, fetchSyncPost, showMessage } from "siyuan";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import { rangeToCellCoord, highlightActiveRowAndCol } from "./dom-utils";
import type AdvancedTablesPlugin from "./index";
import { splitTableRow } from "./table-model";

export class SmartPaste {
  private plugin: AdvancedTablesPlugin;
  private pasteHandler: ((e: ClipboardEvent) => void) | null = null;

  constructor(plugin: AdvancedTablesPlugin) {
    this.plugin = plugin;
  }

  init() {
    this.pasteHandler = (e: ClipboardEvent) => {
      this.handlePaste(e);
    };
    // 在捕获阶段拦截，以便优先于思源原生的粘贴逻辑处理
    document.addEventListener("paste", this.pasteHandler, true);
  }

  destroy() {
    if (this.pasteHandler) {
      document.removeEventListener("paste", this.pasteHandler, true);
      this.pasteHandler = null;
    }
  }

  private async handlePaste(e: ClipboardEvent) {
    if (!this.plugin.settings.enableSmartPaste) return;

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const html = clipboardData.getData("text/html");
    const text = clipboardData.getData("text/plain");

    // 1. 尝试解析为二维表格数据
    let grid = this.parseHtmlTable(html);
    if (!grid) {
      grid = this.parseTsv(text);
    }

    if (!grid || grid.length === 0) return;

    // 2. 检查光标状态
    const { inTable, tableBlock, blockId } = isCursorInTable(activeEditor);

    if (inTable && tableBlock && blockId) {
      // —— 情况 A：光标在表格内，进行多单元格区域粘贴与智能扩容 ——
      e.preventDefault();
      e.stopPropagation();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const coord = rangeToCellCoord(range, tableBlock);
      if (!coord) return;

      try {
        const editorCtx = new SiyuanTextEditor({
          protyle: activeEditor.protyle,
          tableBlockEl: tableBlock,
          blockId,
          fixCJKWidth: this.plugin.settings.fixCJKWidth,
        });

        await editorCtx.reload();

        // 执行多单元格覆盖与智能扩容填充
        this.fillGridIntoTable(editorCtx, coord.row, coord.col, grid);

        await editorCtx.flush();
        showMessage(`已智能粘贴并填充 ${grid.length} 行 ${grid[0].length} 列`, 2000);
      } catch (err) {
        console.error("[siyuan-advanced-tables] smart paste into table failed:", err);
        showMessage("智能粘贴填充失败", 3000, "error");
      }
    } else {
      // —— 情况 B：光标在空行处，直接粘贴并转换为思源表格 ——
      const emptyParagraphId = this.getEmptyParagraphId();
      if (emptyParagraphId) {
        e.preventDefault();
        e.stopPropagation();

        try {
          const markdownTable = this.gridToMarkdown(grid);
          await fetchSyncPost("/api/block/updateBlock", {
            id: emptyParagraphId,
            dataType: "markdown",
            data: markdownTable,
          });
          showMessage(`已智能导入为 ${grid.length} 行表格`, 2000);
        } catch (err) {
          console.error("[siyuan-advanced-tables] smart paste text-to-table failed:", err);
          showMessage("转换为表格失败", 3000, "error");
        }
      }
    }
  }

  /**
   * 将解析出的二维网格数据填充覆盖到编辑器内存行模型中，
   * 自动扩充行与列以容纳粘贴的数据。
   */
  private fillGridIntoTable(
    ctx: SiyuanTextEditor,
    startRow: number,
    startCol: number,
    grid: string[][]
  ) {
    const lineCount = ctx.getLineCount();
    if (lineCount === 0) return;

    // 1. 计算当前的行列数
    const firstRowCells = splitTableRow(ctx.getLineAt(0) ?? "");
    let currentColCount = firstRowCells.length;

    // 计算分隔行中单元格的长度，用于扩充列时填充 "---"
    let sepLineIdx = -1;
    for (let i = 0; i < lineCount; i++) {
      const line = ctx.getLineAt(i) ?? "";
      if (line.includes("|") && line.replace(/[^|]/g, "").length >= 2) {
        const cells = splitTableRow(line);
        if (cells.every(c => c.trim().match(/^:?-+:?$/))) {
          sepLineIdx = i;
          break;
        }
      }
    }

    // 2. 智能扩充列数
    const maxColNeeded = startCol + Math.max(...grid.map(r => r.length));
    if (maxColNeeded > currentColCount) {
      const colDiff = maxColNeeded - currentColCount;
      for (let i = 0; i < lineCount; i++) {
        const line = ctx.getLineAt(i) ?? "";
        if (i === sepLineIdx) {
          // 对分隔行添加 "---"
          const suffix = Array(colDiff).fill(" --- ").join("|");
          ctx.setLineAt(i, line.replace(/\s*\|\s*$/, ` |${suffix} |`));
        } else {
          // 对普通行和表头行添加空值
          const suffix = Array(colDiff).fill(" ").join("|");
          ctx.setLineAt(i, line.replace(/\s*\|\s*$/, ` |${suffix} |`));
        }
      }
      currentColCount = maxColNeeded;
    }

    // 3. 智能扩充行数
    // 数据模型行包含 1 行表头、1 行分隔线，所以 DOM 数据行数 = lineCount - 2（如果存在分隔行）
    // 目标最大 DOM 行数是 startRow + grid.length
    const isHeaderPasted = startRow === 0;
    const maxDomRowNeeded = startRow + grid.length;
    // 表格原本的 DOM 行数 (包含 header)
    const currentDomRowCount = (() => {
      let count = 0;
      for (let i = 0; i < lineCount; i++) {
        const line = ctx.getLineAt(i) ?? "";
        // 排除分隔行和可能存在的 IAL 行
        if (i === sepLineIdx) continue;
        if (line.trim().match(/^\{:[^}]+\}$/)) continue;
        count++;
      }
      return count;
    })();

    if (maxDomRowNeeded > currentDomRowCount) {
      const rowDiff = maxDomRowNeeded - currentDomRowCount;
      const emptyRow = `| ${Array(currentColCount).fill(" ").join(" | ")} |`;

      // 在末尾插入空行（如果最后一行是 IAL 行，就在 IAL 之前插入）
      const lastLineIdx = lineCount - 1;
      const lastLine = ctx.getLineAt(lastLineIdx) ?? "";
      const hasIal = lastLine.trim().startsWith("{:");
      const insertAt = hasIal ? lastLineIdx : lineCount;

      for (let i = 0; i < rowDiff; i++) {
        ctx.insertLineAt(insertAt, emptyRow);
      }
    }

    // 4. 开始按坐标覆盖数据
    for (let r = 0; r < grid.length; r++) {
      const rowData = grid[r];
      const domRow = startRow + r;
      // 换算到内存行数组 _lines 中的索引
      // DOM 0 是表头，对应 _lines[0]
      // DOM 1+ 是数据行，对应 _lines[domRow + 1] (因为跳过了 lines[sepLineIdx] 分隔行)
      let lineIdx = 0;
      if (domRow === 0) {
        lineIdx = 0;
      } else {
        // 由于有分隔行，要特别注意。最靠谱的方法是：遍历 lines，找到第 domRow 个非分隔非 IAL 的行
        let nonSepCount = 0;
        for (let i = 0; i < ctx.getLineCount(); i++) {
          const line = ctx.getLineAt(i) ?? "";
          if (i === sepLineIdx || line.trim().startsWith("{:")) continue;
          if (nonSepCount === domRow) {
            lineIdx = i;
            break;
          }
          nonSepCount++;
        }
      }

      const cells = ctx.getRowCellsAt(lineIdx);
      for (let c = 0; c < rowData.length; c++) {
        const colIdx = startCol + c;
        if (colIdx < cells.length) {
          cells[colIdx] = rowData[c];
        }
      }
      ctx.setRowCellsAt(lineIdx, cells);
    }
  }

  /** 解析 HTML 格式的 <table>，支持合并单元格降维解析 */
  private parseHtmlTable(html: string): string[][] | null {
    if (!html || !html.includes("<table")) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const table = doc.querySelector("table");
      if (!table) return null;

      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length === 0) return null;

      const grid: string[][] = [];
      rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll("td, th"));
        grid.push(cells.map(c => c.textContent?.trim() ?? ""));
      });
      return grid;
    } catch (_e) {
      return null;
    }
  }

  /** 解析 TSV 文本数据 */
  private parseTsv(text: string): string[][] | null {
    if (!text) return null;

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) return null;

    // 排除只有单行且没有 tab 的普通粘贴
    if (lines.length === 1 && !text.includes("\t")) return null;

    return lines.map(line => line.split("\t").map(cell => cell.trim()));
  }

  /** 将二维网格转换为 GFM Markdown 格式 of 表格 */
  private gridToMarkdown(grid: string[][]): string {
    if (grid.length === 0) return "";
    const colCount = Math.max(...grid.map(r => r.length));

    const lines: string[] = [];
    
    // 1. 表头行
    const header = grid[0] ?? [];
    const headerCells = Array.from({ length: colCount }, (_, i) => header[i] ?? "");
    lines.push(`| ${headerCells.join(" | ")} |`);

    // 2. 对齐分割行
    const sepCells = Array.from({ length: colCount }, () => "---");
    lines.push(`| ${sepCells.join(" | ")} |`);

    // 3. 数据行
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const rowCells = Array.from({ length: colCount }, (_, i) => row[i] ?? "");
      lines.push(`| ${rowCells.join(" | ")} |`);
    }

    return lines.join("\n");
  }

  /** 获取当前聚焦的空段落块 ID */
  private getEmptyParagraphId(): string | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    let parent = range.startContainer as HTMLElement | null;

    while (parent && parent !== document.body) {
      if (parent instanceof HTMLElement && parent.dataset.nodeId) {
        const type = parent.dataset.type;
        const text = parent.textContent?.trim() ?? "";
        // 如果是段落块，且内容为空，返回其块 ID
        if (type === "NodeParagraph" && text === "") {
          return parent.dataset.nodeId;
        }
        break;
      }
      parent = parent.parentNode as HTMLElement | null;
    }

    return null;
  }
}
