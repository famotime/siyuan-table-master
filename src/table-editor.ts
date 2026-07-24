/**
 * table-editor.ts - 表格编辑器封装
 *
 * 对标参考项目 advanced-tables-obsidian 的同名文件。
 * 转发所有操作到 @tgrosinger/md-advanced-tables 核心库。
 */

import {
  Alignment,
  SortOrder,
  Options,
  optionsWithDefaults,
  FormatType,
  TableEditor as MTEEditor,
} from "@tgrosinger/md-advanced-tables";
import { showMessage } from "siyuan";
import { SiyuanTextEditor } from "./siyuan-text-editor";
import { showPasteConfirmDialog } from "./confirm-dialog";
import type { PluginSettings } from "./settings";
import { splitTableRow, isSeparatorLine } from "./table-model";

/** 模块级剪贴板（会话内持久） */
interface TableClipboard {
  type: "row" | "column";
  /** 单元格内容数组（不含首尾 | 及空白） */
  cells: string[];
}
let clipboard: TableClipboard | null = null;

export function getTableClipboard(): TableClipboard | null {
  return clipboard;
}

export class TableEditor {
  private mte: MTEEditor;
  public readonly ctx: SiyuanTextEditor;

  constructor(
    ctx: SiyuanTextEditor,
    private settings: PluginSettings = {} as any,
    private i18n: any = {},
  ) {
    this.ctx = ctx;
    this.mte = new MTEEditor(ctx);
  }

  private getMsg(zh: string, en: string): string {
    const isEn = this.i18n.cancel === "Cancel";
    return isEn ? en : zh;
  }

  /** 获取选项（合并设置） */
  private opts(): Options {
    return optionsWithDefaults({
      formatType: this.settings.formatType,
    });
  }

  // ── 状态判断 ──

  async cursorIsInTable(): Promise<boolean> {
    await this.ctx.reload();
    return this.mte.cursorIsInTable(this.opts());
  }

  async cursorIsInTableFormula(): Promise<boolean> {
    await this.ctx.reload();
    return this.mte.cursorIsInTableFormula(this.opts());
  }

  // ── 导航 ──

  async nextCell(): Promise<void> {
    await this.ctx.reload();
    this.mte.nextCell(this.opts());
    await this.ctx.flush();
  }

  async previousCell(): Promise<void> {
    await this.ctx.reload();
    this.mte.previousCell(this.opts());
    await this.ctx.flush();
  }

  async nextRow(): Promise<void> {
    await this.ctx.reload();
    this.mte.nextRow(this.opts());
    await this.ctx.flush();
  }



  // ── 格式化 ──

  async formatTable(): Promise<void> {
    await this.ctx.reload();
    this.mte.format(this.opts());
    await this.ctx.flush();
  }

  // ── 行列操作 ──

  async insertColumn(): Promise<void> {
    await this.ctx.reload();
    this.mte.insertColumn(this.opts());
    await this.ctx.flush();
  }

  async insertRow(): Promise<void> {
    await this.ctx.reload();
    this.mte.insertRow(this.opts());
    await this.ctx.flush();
  }

  async deleteColumn(): Promise<void> {
    await this.ctx.reload();
    this.mte.deleteColumn(this.opts());
    await this.ctx.flush();
  }

  async deleteRow(): Promise<void> {
    await this.ctx.reload();
    this.mte.deleteRow(this.opts());
    await this.ctx.flush();
  }

  async moveColumnLeft(): Promise<void> {
    await this.ctx.reload();
    this.mte.moveColumn(-1, this.opts());
    await this.ctx.flush();
  }

  async moveColumnRight(): Promise<void> {
    await this.ctx.reload();
    this.mte.moveColumn(1, this.opts());
    await this.ctx.flush();
  }

  async moveRowUp(): Promise<void> {
    await this.ctx.reload();
    this.mte.moveRow(-1, this.opts());
    await this.ctx.flush();
  }

  async moveRowDown(): Promise<void> {
    await this.ctx.reload();
    this.mte.moveRow(1, this.opts());
    await this.ctx.flush();
  }

  // ── 对齐 ──

  async leftAlignColumn(): Promise<void> {
    await this.ctx.reload();
    this.mte.alignColumn(Alignment.LEFT, this.opts());
    await this.ctx.flush();
  }

  async centerAlignColumn(): Promise<void> {
    await this.ctx.reload();
    this.mte.alignColumn(Alignment.CENTER, this.opts());
    await this.ctx.flush();
  }

  async rightAlignColumn(): Promise<void> {
    await this.ctx.reload();
    this.mte.alignColumn(Alignment.RIGHT, this.opts());
    await this.ctx.flush();
  }

  // ── 排序 ──

  async sortRowsAsc(): Promise<void> {
    await this.ctx.reload();
    this.mte.sortRows(SortOrder.Ascending, this.opts());
    await this.ctx.flush();
  }

  async sortRowsDesc(): Promise<void> {
    await this.ctx.reload();
    this.mte.sortRows(SortOrder.Descending, this.opts());
    await this.ctx.flush();
  }

  // ── 转置 ──

  async transpose(): Promise<void> {
    await this.ctx.reload();
    this.mte.transpose(this.opts());
    await this.ctx.flush();
  }

  /** 解除当前表格内所有单元格的横向和纵向合并。 */
  async splitAllCells(): Promise<void> {
    await this.ctx.reload();

    for (let lineIndex = 0; lineIndex < this.ctx.getLineCount(); lineIndex++) {
      const line = this.ctx.getLineAt(lineIndex);
      if (!line || isSeparatorLine(line)) continue;

      const splitLine = removeMergeAttributes(line);
      if (splitLine !== line) {
        this.ctx.setLineAt(lineIndex, splitLine);
      }
    }

    await this.ctx.flush();
  }

  async resizeTable(targetCols: number, targetRows: number): Promise<void> {
    await this.ctx.reload();

    const lineCount = this.ctx.getLineCount();
    if (lineCount < 2) return; // 格式非法，至少有表头和分隔行

    const headerLine = this.ctx.getLineAt(0) || "";
    const originalColCount = splitTableRow(headerLine).length;
    const originalRowCount = lineCount - 1; // 去掉分隔行后的总行数 (包含表头)

    // 1. 扩充列 (如果 targetCols > originalColCount)
    if (targetCols > originalColCount) {
      const colDiff = targetCols - originalColCount;
      for (let i = 0; i < lineCount; i++) {
        const line = this.ctx.getLineAt(i) || "";
        const cells = splitTableRow(line);
        if (i === 1) {
          // 分隔行，追加 "---"
          for (let d = 0; d < colDiff; d++) {
            cells.push("---");
          }
        } else {
          // 数据行或表头，追加空单元格 ""
          for (let d = 0; d < colDiff; d++) {
            cells.push("");
          }
        }
        this.ctx.setLineAt(i, `| ${cells.join(" | ")} |`);
      }
    }

    // 2. 扩充行 (如果 targetRows > originalRowCount)
    if (targetRows > originalRowCount) {
      const rowDiff = targetRows - originalRowCount;
      const colCount = Math.max(originalColCount, targetCols);
      for (let r = 0; r < rowDiff; r++) {
        const emptyRowCells = Array(colCount).fill("");
        this.ctx.insertLineAt(this.ctx.getLineCount(), `| ${emptyRowCells.join(" | ")} |`);
      }
    }

    // 3. 写回思源
    await this.ctx.flush();
  }



  // ── CSV 导出 ──

  async exportCSV(includeHeaders: boolean): Promise<string> {
    await this.ctx.reload();
    return this.mte.exportCSV(includeHeaders, this.opts());
  }

  // ── 剪切与粘贴 ──

  async cutRow(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    if (coord.row === 0) {
      return this.getMsg("无法剪切表头行", "Cannot cut the header row");
    }

    const lineIdx = coord.row + 1;
    const cells = this.ctx.getRowCellsAt(lineIdx);
    clipboard = { type: "row", cells: [...cells] };

    // 删除当前行
    this.mte.deleteRow(this.opts());
    await this.ctx.flush();

    return null;
  }

  async cutColumn(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const colCount = this.ctx.getRowCellsAt(0).length;
    if (colCount <= 1) {
      return this.getMsg("无法剪切仅存的最后一列", "Cannot cut the only column");
    }

    const cells = this.ctx.getColCells(coord.col);
    clipboard = { type: "column", cells: [...cells] };

    // 删除当前列
    this.mte.deleteColumn(this.opts());
    await this.ctx.flush();

    return null;
  }

  async pasteRow(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "row") {
      return this.getMsg(
        "剪贴板中没有行数据，请先使用「剪切行」",
        "No row data in clipboard, please 'Cut Row' first"
      );
    }

    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const clipCells = clipboard.cells;
    const numCols = this.ctx.getRowCellsAt(0).length;
    const newCells = Array.from({ length: numCols }, (_, i) =>
      i < clipCells.length ? clipCells[i] : ""
    );
    const newLine = `| ${newCells.join(" | ")} |`;

    if (coord.row === 0) {
      // 如果光标在表头行，我们在 model index 0 插入新行
      this.ctx.insertLineAt(0, newLine);
      // 保证 model[1] 始终是分隔线行，将 model[1] 和 model[2] 交换位置
      const temp1 = this.ctx.getLineAt(1);
      const temp2 = this.ctx.getLineAt(2);
      if (temp1 !== undefined && temp2 !== undefined) {
        this.ctx.setLineAt(1, temp2);
        this.ctx.setLineAt(2, temp1);
      }
    } else {
      // 否则，直接插入在当前行上方
      this.ctx.insertLineAt(coord.row + 1, newLine);
    }

    await this.ctx.flush();

    return null;
  }

  async pasteColumn(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "column") {
      return this.getMsg(
        "剪贴板中没有列数据，请先使用「剪切列」",
        "No column data in clipboard, please 'Cut Column' first"
      );
    }

    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const clipCells = clipboard.cells;
    const colIdx = coord.col;

    // 遍历所有模型行，在 colIdx 前面插入一列
    const lineCount = this.ctx.getLineCount();
    let cellIdx = 0;
    for (let i = 0; i < lineCount; i++) {
      const line = this.ctx.getLineAt(i);
      if (line === undefined) continue;

      if (isSeparatorLine(line)) {
        const cells = splitTableRow(line);
        cells.splice(colIdx, 0, "---");
        this.ctx.setLineAt(i, `| ${cells.join(" | ")} |`);
      } else {
        const cells = splitTableRow(line);
        const cellVal = cellIdx < clipCells.length ? clipCells[cellIdx] : "";
        cells.splice(colIdx, 0, cellVal);
        this.ctx.setLineAt(i, `| ${cells.join(" | ")} |`);
        cellIdx++;
      }
    }

    await this.ctx.flush();

    return null;
  }

  // ── 求和 ──

  async rowSum(): Promise<void> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return;

    const lineIdx = coord.row === 0 ? 0 : coord.row + 1;
    const cells = this.ctx.getRowCellsAt(lineIdx);
    const { sum, skipped } = sumCells(cells.slice(0, coord.col));
    cells[coord.col] = String(sum);
    this.ctx.setRowCellsAt(lineIdx, cells);
    await this.ctx.flush();

    if (skipped.length > 0) {
      showMessage(
        this.getMsg(
          `存在非数字内容，已跳过：${skipped.join(", ")}`,
          `Non-numeric content skipped: ${skipped.join(", ")}`
        ),
        4000,
        "info"
      );
    }
  }

  async columnSum(): Promise<void> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return;

    const colCells = this.ctx.getColCells(coord.col);
    const { sum, skipped } = sumCells(colCells.slice(1, coord.row));
    colCells[coord.row] = String(sum);
    this.ctx.setColCells(coord.col, colCells);
    await this.ctx.flush();

    if (skipped.length > 0) {
      showMessage(
        this.getMsg(
          `存在非数字内容，已跳过：${skipped.join(", ")}`,
          `Non-numeric content skipped: ${skipped.join(", ")}`
        ),
        4000,
        "info"
      );
    }
  }

  // ── 私有方法 ──

  /**
   * 通用粘贴流程：剪贴板校验 → 获取上下文 → 检查目标是否有内容 → 直接粘贴或弹确认框。
   * pasteRow / pasteColumn 共享此骨架，仅在获取目标、写入目标、预览格式上不同。
   */
  private async pasteWithConfirm(
    label: string,
    clipCells: string[],
    getTarget: (coord: { row: number; col: number }) => { current: string[]; target: number | string },
    writeTarget: (target: number | string, cells: string[]) => void,
    formatPreview: (arr: string[]) => string,
  ): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const { current: currentCells, target } = getTarget(coord);
    const hasContent = currentCells.some(c => getPureCellText(c) !== "");

    const labelI18n = label === "行"
      ? (this.i18n.row || "行")
      : label === "列"
        ? (this.i18n.column || "列")
        : label;

    const executePaste = async () => {
      writeTarget(target, clipCells);
      await this.ctx.flush();
    };

    if (!hasContent) {
      await executePaste();
      return null;
    }

    return new Promise<string | null>((resolve) => {
      let resolved = false;
      const titleTemplate = this.i18n.pasteConfirmTitle || "当前第 ${num} ${label}已有内容，是否覆盖？";
      const title = titleTemplate
        .replace("${num}", String(label === "行" ? coord.row + 1 : coord.col + 1))
        .replace("${label}", labelI18n);

      showPasteConfirmDialog(
        title,
        formatPreview(currentCells),
        formatPreview(clipCells),
        this.i18n,
        async () => { resolved = true; await executePaste(); resolve(null); },
        () => { resolved = true; showMessage(this.i18n.pasteCancelled || "已取消粘贴", 1500); resolve(null); },
        () => { if (!resolved) resolve(null); },
      );
    });
  }
}

// ── 模块级工具函数 ──

/**
 * 去除思源单元格级属性 IAL（如 {: colspan="1"} 等）后的纯文本内容。
 */
function getPureCellText(cell: string): string {
  return cell.replace(/\{:[^}]+\}/g, "").trim();
}

/** 从单元格 IAL 中移除合并属性，保留其他单元格属性。 */
function removeMergeAttributes(cell: string): string {
  return cell.replace(/\{:\s*([^}]*)\}/g, (_match, attributes: string) => {
    const remaining = attributes
      .replace(/(?:^|\s+)(?:colspan|rowspan)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s}]+)/gi, "")
      .trim();
    return remaining ? `{: ${remaining}}` : "";
  }).trim();
}

/** 对一组单元格文本求和，跳过非数字且非空的单元格 */
function sumCells(cells: string[]): { sum: number; skipped: string[] } {
  let sum = 0;
  const skipped: string[] = [];
  for (const cell of cells) {
    const pureText = getPureCellText(cell);
    if (pureText === "") continue;
    const val = Number(pureText);
    if (isNaN(val)) {
      skipped.push(pureText);
    } else {
      sum += val;
    }
  }
  return { sum, skipped };
}
