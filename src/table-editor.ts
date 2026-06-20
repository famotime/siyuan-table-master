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

  async escape(): Promise<void> {
    await this.ctx.reload();
    this.mte.escape(this.opts());
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

  // ── 公式 ──

  async evaluateFormulas(): Promise<string | null> {
    await this.ctx.reload();
    const err = this.mte.evaluateFormulas(this.opts());
    await this.ctx.flush();
    return err?.message ?? null;
  }

  // ── CSV 导出 ──

  async exportCSV(includeHeaders: boolean): Promise<string> {
    await this.ctx.reload();
    return this.mte.exportCSV(includeHeaders, this.opts());
  }

  // ── 复制与粘贴 ──

  async copyRow(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const lineIdx = coord.row === 0 ? 0 : coord.row + 1;
    const cells = this.ctx.getRowCellsAt(lineIdx);
    clipboard = { type: "row", cells: [...cells] };
    showMessage(
      this.getMsg(
        `已复制第 ${coord.row + 1} 行（${cells.length} 列）`,
        `Copied row ${coord.row + 1} (${cells.length} columns)`
      ),
      2000
    );
    return null;
  }

  async copyColumn(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return this.getMsg("无法获取光标位置", "Cannot get cursor position");

    const cells = this.ctx.getColCells(coord.col);
    clipboard = { type: "column", cells: [...cells] };
    showMessage(
      this.getMsg(
        `已复制第 ${coord.col + 1} 列（${cells.length} 行）`,
        `Copied column ${coord.col + 1} (${cells.length} rows)`
      ),
      2000
    );
    return null;
  }

  async pasteRow(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "row") {
      return this.getMsg(
        "剪贴板中没有行数据，请先使用「复制行」",
        "No row data in clipboard, please 'Copy Row' first"
      );
    }
    return this.pasteWithConfirm(
      "行",
      clipboard.cells,
      (coord) => {
        const lineIdx = coord.row === 0 ? 0 : coord.row + 1;
        return { current: this.ctx.getRowCellsAt(lineIdx), target: lineIdx };
      },
      (target, cells) => { this.ctx.setRowCellsAt(target as number, cells); },
      (arr) => arr.map(getPureCellText).filter(c => c).join(" | ") || this.getMsg("(空)", "(Empty)"),
    );
  }

  async pasteColumn(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "column") {
      return this.getMsg(
        "剪贴板中没有列数据，请先使用「复制列」",
        "No column data in clipboard, please 'Copy Column' first"
      );
    }
    return this.pasteWithConfirm(
      "列",
      clipboard.cells,
      (coord) => {
        return { current: this.ctx.getColCells(coord.col), target: coord.col };
      },
      (target, cells) => { this.ctx.setColCells(target as number, cells); },
      (arr) => {
        const rows = arr.map(getPureCellText).filter(c => c);
        if (rows.length === 0) return this.getMsg("(空)", "(Empty)");
        return rows.slice(0, 3).join(" / ") + (rows.length > 3 ? " …" : "");
      },
    );
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
      showMessage(
        this.getMsg(
          `已粘贴到第 ${coord.row + 1} ${labelI18n}`,
          `Pasted to ${labelI18n} ${coord.row + 1}`
        ),
        1500
      );
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
