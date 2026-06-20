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
import { SiyuanTextEditor } from "./siyuan-text-editor";
import type { PluginSettings } from "./settings";

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
}
