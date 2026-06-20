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
  private ctx: SiyuanTextEditor;

  constructor(ctx: SiyuanTextEditor, private settings: PluginSettings) {
    this.ctx = ctx;
    this.mte = new MTEEditor(ctx);
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


  /**
   * 复制当前光标所在行的所有单元格内容到内存剪贴板。
   * @returns 失败时返回错误描述字符串，成功返回 null。
   */
  async copyRow(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return "无法获取光标位置";

    // DOM 行号 → _lines 索引（跳过分隔行）
    const lineIdx = coord.row === 0 ? 0 : coord.row + 1;
    const cells = this.ctx.getRowCellsAt(lineIdx);
    clipboard = { type: "row", cells: [...cells] };
    showMessage(`已复制第 ${coord.row + 1} 行（${cells.length} 列）`, 2000);
    return null;
  }

  /**
   * 复制当前光标所在列的所有单元格内容（含表头）到内存剪贴板。
   * @returns 失败时返回错误描述字符串，成功返回 null。
   */
  async copyColumn(): Promise<string | null> {
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return "无法获取光标位置";

    const cells = this.ctx.getColCells(coord.col);
    clipboard = { type: "column", cells: [...cells] };
    showMessage(`已复制第 ${coord.col + 1} 列（${cells.length} 行）`, 2000);
    return null;
  }

  /**
   * 将剪贴板中的行数据粘贴到当前光标所在行。
   * 若目标行已有内容，则弹出确认对话框由用户决定是否覆盖。
   * @returns 失败/候确认时返回错误描述字符串，其他情况返回 null。
   */
  async pasteRow(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "row") {
      return "剪贴板中没有行数据，请先使用「复制行」";
    }
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return "无法获取光标位置";

    const lineIdx = coord.row === 0 ? 0 : coord.row + 1;
    const currentCells = this.ctx.getRowCellsAt(lineIdx);
    // 过滤掉单元格级 IAL (如 {: colspan="1"}) 之后检测是否有实质内容
    const hasContent = currentCells.some((c) => getPureCellText(c) !== "");
    const clipCells = clipboard.cells;

    const executePaste = async () => {
      this.ctx.setRowCellsAt(lineIdx, clipCells);
      await this.ctx.flush();
      showMessage(`已粘贴到第 ${coord.row + 1} 行`, 1500);
    };

    if (!hasContent) {
      await executePaste();
      return null;
    }

    // 目标行已有内容，弹出确认对话框
    return new Promise<string | null>((resolve) => {
      let resolved = false; // 用于标记 Promise 是否已被解决，防止重复触发或状态丢失
      const preview = (arr: string[]) =>
        arr.map(getPureCellText).filter((c) => c).join(" | ") || "(空)";
      showPasteConfirmDialog(
        `当前第 ${coord.row + 1} 行已有内容，是否覆盖？`,
        preview(currentCells),
        preview(clipCells),
        async () => {
          resolved = true;
          await executePaste();
          resolve(null);
        },
        () => {
          resolved = true;
          showMessage("已取消粘贴", 1500);
          resolve(null);
        },
        () => {
          // 对话框被销毁（如点击遮罩或右上角关闭）时的兜底释放回调
          if (!resolved) {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * 将剪贴板中的列数据粘贴到当前光标所在列。
   * 若目标列已有内容，则弹出确认对话框由用户决定是否覆盖。
   * @returns 失败/候确认时返回错误描述字符串，其他情况返回 null。
   */
  async pasteColumn(): Promise<string | null> {
    if (!clipboard || clipboard.type !== "column") {
      return "剪贴板中没有列数据，请先使用「复制列」";
    }
    await this.ctx.reload();
    const coord = this.ctx.getCursorDomCoord();
    if (!coord) return "无法获取光标位置";

    const currentCells = this.ctx.getColCells(coord.col);
    // 过滤掉单元格级 IAL (如 {: colspan="1"}) 之后检测是否有实质内容
    const hasContent = currentCells.some((c) => getPureCellText(c) !== "");
    const clipCells = clipboard.cells;

    const executePaste = async () => {
      this.ctx.setColCells(coord.col, clipCells);
      await this.ctx.flush();
      showMessage(`已粘贴到第 ${coord.col + 1} 列`, 1500);
    };

    if (!hasContent) {
      await executePaste();
      return null;
    }

    // 目标列已有内容，弹出确认对话框
    return new Promise<string | null>((resolve) => {
      let resolved = false; // 用于标记 Promise 是否已被解决，防止重复触发或状态丢失
      // 列内容预览取前 3 行，并滤除属性标识，避免对话框过长
      const preview = (arr: string[]) => {
        const rows = arr.map(getPureCellText).filter((c) => c);
        if (rows.length === 0) return "(空)";
        return rows.slice(0, 3).join(" / ") + (rows.length > 3 ? " …" : "");
      };
      showPasteConfirmDialog(
        `当前第 ${coord.col + 1} 列已有内容，是否覆盖？`,
        preview(currentCells),
        preview(clipCells),
        async () => {
          resolved = true;
          await executePaste();
          resolve(null);
        },
        () => {
          resolved = true;
          showMessage("已取消粘贴", 1500);
          resolve(null);
        },
        () => {
          // 对话框被销毁（如点击遮罩或右上角关闭）时的兜底释放回调
          if (!resolved) {
            resolve(null);
          }
        }
      );
    });
  }
}

/**
 * 去除思源单元格级属性 IAL（如 {: colspan="1"} 等）后的纯文本内容。
 * 用于更精确判定单元格在内容层是否为空，并美化弹窗预览界面。
 */
function getPureCellText(cell: string): string {
  return cell.replace(/\{:[^}]+\}/g, "").trim();
}
