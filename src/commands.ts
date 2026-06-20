/**
 * commands.ts - 命令注册表
 * 
 * 集中声明所有高级表格命令，对标参考项目 main.ts 中的命令注册。
 */

import type { Plugin, Protyle } from "siyuan";
import type { PluginSettings } from "./settings";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import { TableEditor } from "./table-editor";
import { showMessage, getActiveEditor } from "siyuan";

/** 命令定义 */
export interface TableCommand {
  id: string;
  nameZh: string;
  nameEn: string;
  icon?: string;
  action: (te: TableEditor) => Promise<void>;
}

/** 所有命令 */
export const TABLE_COMMANDS: TableCommand[] = [
  { id: "next-cell", nameZh: "下一单元格", nameEn: "Next cell", icon: "iconTab", action: te => te.nextCell() },
  { id: "previous-cell", nameZh: "上一单元格", nameEn: "Previous cell", action: te => te.previousCell() },
  { id: "next-row", nameZh: "下一行", nameEn: "Next row", icon: "iconEnter", action: te => te.nextRow() },
  { id: "format-table", nameZh: "格式化表格", nameEn: "Format table", action: te => te.formatTable() },
  { id: "insert-column", nameZh: "插入列", nameEn: "Insert column", icon: "iconInsertColumn", action: te => te.insertColumn() },
  { id: "insert-row", nameZh: "插入行", nameEn: "Insert row", icon: "iconInsertRow", action: te => te.insertRow() },
  { id: "delete-column", nameZh: "删除列", nameEn: "Delete column", icon: "iconDeleteColumn", action: te => te.deleteColumn() },
  { id: "delete-row", nameZh: "删除行", nameEn: "Delete row", icon: "iconDeleteRow", action: te => te.deleteRow() },
  { id: "move-column-left", nameZh: "左移列", nameEn: "Move column left", action: te => te.moveColumnLeft() },
  { id: "move-column-right", nameZh: "右移列", nameEn: "Move column right", action: te => te.moveColumnRight() },
  { id: "move-row-up", nameZh: "上移行", nameEn: "Move row up", action: te => te.moveRowUp() },
  { id: "move-row-down", nameZh: "下移行", nameEn: "Move row down", action: te => te.moveRowDown() },
  { id: "left-align-column", nameZh: "左对齐列", nameEn: "Left align column", action: te => te.leftAlignColumn() },
  { id: "center-align-column", nameZh: "居中对齐列", nameEn: "Center align column", action: te => te.centerAlignColumn() },
  { id: "right-align-column", nameZh: "右对齐列", nameEn: "Right align column", action: te => te.rightAlignColumn() },
  { id: "sort-rows-asc", nameZh: "升序排序", nameEn: "Sort rows ascending", action: te => te.sortRowsAsc() },
  { id: "sort-rows-desc", nameZh: "降序排序", nameEn: "Sort rows descending", action: te => te.sortRowsDesc() },
  { id: "transpose", nameZh: "转置表格", nameEn: "Transpose table", action: te => te.transpose() },
  { id: "evaluate-formulas", nameZh: "计算公式", nameEn: "Evaluate formulas", action: async (te) => {
    const err = await te.evaluateFormulas();
    if (err) showMessage(`公式错误: ${err}`, 5000, "error");
  }},
  { id: "escape-table", nameZh: "跳出表格", nameEn: "Escape table", action: te => te.escape() },
];

/**
 * 注册所有命令到插件
 */
export function registerCommands(
  plugin: Plugin,
  settings: PluginSettings,
): void {
  for (const cmd of TABLE_COMMANDS) {
    plugin.addCommand({
      langKey: cmd.id,
      langMenu: cmd.nameZh,
      hotkey: "",
      callback: async () => {
        await executeCommand(cmd, settings);
      },
    });
  }
}

/**
 * 执行命令：获取当前编辑器 → 检查光标是否在表格 → 执行操作
 */
export async function executeCommand(
  cmd: TableCommand,
  settings: PluginSettings,
): Promise<void> {
  try {
    const protyle = getActiveEditor?.();
    if (!protyle?.protyle) {
      showMessage("请先聚焦编辑器", 2000, "error");
      return;
    }

    const { inTable, tableBlock, blockId } = isCursorInTable(protyle);
    if (!inTable || !tableBlock || !blockId) {
      showMessage("光标不在表格内", 2000, "error");
      return;
    }

    const ctx = new SiyuanTextEditor({
      protyle: protyle.protyle,
      tableBlockEl: tableBlock,
      blockId,
      fixCJKWidth: settings.fixCJKWidth,
    });
    const te = new TableEditor(ctx, settings);

    await cmd.action(te);
  } catch (err) {
    console.error(`[siyuan-advanced-tables] command ${cmd.id} failed:`, err);
    showMessage(`操作失败: ${cmd.nameZh}`, 3000, "error");
  }
}
