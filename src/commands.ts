/**
 * commands.ts - 命令注册表
 * 
 * 集中声明所有高级表格命令，对标参考项目 main.ts 中的命令注册。
 */

import type { Plugin, Protyle } from "siyuan";
import type { PluginSettings } from "./settings";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import type { CellCoord } from "./dom-utils";
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
  preset?: {
    tableBlock: HTMLElement;
    blockId: string;
    coord: CellCoord;
  } | null,
): Promise<void> {
  try {
    const protyle = getActiveEditor?.();
    if (!protyle?.protyle) {
      showMessage("请先聚焦编辑器", 2000, "error");
      return;
    }

    // 优先使用缓存的表格上下文
    let tableBlock = preset?.tableBlock || null;
    let blockId = preset?.blockId || null;
    let presetCellCoord = preset?.coord || null;

    // 强行纠正：如果使用了预设，必须实时从 document 重新查询该 blockId 对应的最新表格块 DOM，以防连续快速重绘后节点脱离文档树
    if (blockId) {
      const latestEl = document.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement;
      if (latestEl) {
        tableBlock = latestEl;
      }
    }

    if (!tableBlock || !blockId) {
      // 动态从当前 DOM range 抓取选区
      const { inTable, tableBlock: tb, blockId: bid } = isCursorInTable(protyle);
      if (!inTable || !tb || !bid) {
        showMessage("光标不在表格内", 2000, "error");
        return;
      }
      tableBlock = tb;
      blockId = bid;
    }


    const ctx = new SiyuanTextEditor({
      protyle: protyle.protyle,
      tableBlockEl: tableBlock,
      blockId,
      fixCJKWidth: settings.fixCJKWidth,
      presetCellCoord,
    });
    const te = new TableEditor(ctx, settings);

    await cmd.action(te);
  } catch (err) {
    console.error(`[siyuan-advanced-tables] command ${cmd.id} failed:`, err);
    showMessage(`操作失败: ${cmd.nameZh}`, 3000, "error");
  }
}
