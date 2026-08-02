/**
 * commands.ts - 命令注册表
 *
 * 集中声明所有高级表格命令，对标参考项目 main.ts 中的命令注册。
 */

import type { Plugin } from "siyuan";
import type { PluginSettings } from "./settings";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import type { CellCoord } from "./dom-utils";
import { TableEditor } from "./table-editor";
import { getActiveEditor, showMessage, fetchSyncPost } from "siyuan";
import { executeTextToTable } from "./text-to-table";
import { executeTableToChart } from "./table-to-chart";
import { exportToCSV, exportToXLSX } from "./table-export";

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

  // ── 剪切与粘贴 ──
  { id: "cut-row", nameZh: "剪切行", nameEn: "Cut row", action: async (te) => {
    const err = await te.cutRow();
    if (err) showMessage(err, 3000, "error");
  }},
  { id: "cut-column", nameZh: "剪切列", nameEn: "Cut column", action: async (te) => {
    const err = await te.cutColumn();
    if (err) showMessage(err, 3000, "error");
  }},
  { id: "paste-row", nameZh: "粘贴行", nameEn: "Paste row", action: async (te) => {
    const err = await te.pasteRow();
    if (err) showMessage(err, 3000, "error");
  }},
  { id: "paste-column", nameZh: "粘贴列", nameEn: "Paste column", action: async (te) => {
    const err = await te.pasteColumn();
    if (err) showMessage(err, 3000, "error");
  }},
  // ── 求和计算 ──
  { id: "row-sum", nameZh: "行求和", nameEn: "Row sum", action: te => te.rowSum() },
  { id: "column-sum", nameZh: "列求和", nameEn: "Column sum", action: te => te.columnSum() },
  { id: "split-all-cells", nameZh: "全拆分", nameEn: "Split all cells", action: te => te.splitAllCells() },
  { id: "table-to-chart", nameZh: "一键数据图表化", nameEn: "Convert table to chart", action: te => executeTableToChart(te) },
  // 文本转表格：action 占位符，实际由 executeCommand 中特判处理
  { id: "text-to-table", nameZh: "文本转为表格", nameEn: "Convert text to table", action: async () => {} },
  // 宽度调整：action 占位符，实际由 executeCommand 中特判处理
  { id: "fit-content-width", nameZh: "自适应宽度调整", nameEn: "Adjust table width", action: async () => {} },
  // 表格导出命令：action 占位符，实际由 executeCommand 中特判处理
  { id: "export-csv", nameZh: "导出 CSV", nameEn: "Export CSV", action: async () => {} },
  { id: "export-xlsx", nameZh: "导出 XLSX", nameEn: "Export XLSX", action: async () => {} },
];

/**
 * 注册所有命令到插件
 */
export function registerCommands(
  plugin: Plugin,
  settings: PluginSettings,
): void {
  for (const cmd of TABLE_COMMANDS) {
    // 导出命令仅在 Dock 面板中显示按钮，不单独注册全局命令
    if (cmd.id === "export-csv" || cmd.id === "export-xlsx") {
      continue;
    }
    plugin.addCommand({
      langKey: cmd.id,
      langMenu: cmd.nameZh,
      hotkey: "",
      callback: async () => {
        await executeCommand(cmd, settings, null, (plugin as any).i18n);
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
  i18n: any = {},
): Promise<void> {
  try {
    const protyle = getActiveEditor?.();
    if (!protyle?.protyle) {
      showMessage(i18n.errFocusEditor || "请先聚焦编辑器", 2000, "error");
      return;
    }

    // 特判：文本转为表格命令不受"光标必须在表格内"的限制
    if (cmd.id === "text-to-table") {
      await executeTextToTable(i18n);
      return;
    }

    // 特判：宽度调整命令直接设置块属性，不需要加载整个表格的 Markdown
    if (cmd.id === "fit-content-width") {
      let tableBlock = preset?.tableBlock || null;
      let blockId = preset?.blockId || null;

      if (blockId) {
        const latestEl = document.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement;
        if (latestEl) {
          tableBlock = latestEl;
        }
      }

      if (!tableBlock || !blockId) {
        const { inTable, tableBlock: tb, blockId: bid } = isCursorInTable(protyle);
        if (!inTable || !tb || !bid) {
          showMessage(i18n.noActiveTable || "光标不在表格内", 2000, "error");
          return;
        }
        tableBlock = tb;
        blockId = bid;
      }

      const currentVal = tableBlock.getAttribute("custom-table-width-auto") || "";
      const isAuto = currentVal === "true";
      const newVal = isAuto ? "" : "true";

      // 1. 立即更新 DOM (以取得即时无缝响应效果)
      if (newVal) {
        tableBlock.setAttribute("custom-table-width-auto", newVal);
      } else {
        tableBlock.removeAttribute("custom-table-width-auto");
      }

      // 2. 调用 API 持久化
      await fetchSyncPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs: {
          "custom-table-width-auto": newVal
        }
      });
      return;
    }

    // 特判：导出 CSV / XLSX 命令
    if (cmd.id === "export-csv" || cmd.id === "export-xlsx") {
      let tableBlock = preset?.tableBlock || null;
      let blockId = preset?.blockId || null;

      if (blockId) {
        const latestEl = document.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement;
        if (latestEl) {
          tableBlock = latestEl;
        }
      }

      if (!tableBlock || !blockId) {
        const { inTable, tableBlock: tb, blockId: bid } = isCursorInTable(protyle);
        if (!inTable || !tb || !bid) {
          showMessage(i18n.noActiveTable || "光标不在表格内", 2000, "error");
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
      });
      await ctx.reload();
      const lines = ctx.getTableLines();

      if (cmd.id === "export-csv") {
        exportToCSV(lines);
      } else {
        exportToXLSX(lines);
      }
      showMessage(i18n.exportSuccess || "表格已成功导出", 2000, "info");
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
        showMessage(i18n.noActiveTable || "光标不在表格内", 2000, "error");
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
    const te = new TableEditor(ctx, settings, i18n);

    await cmd.action(te);
  } catch (err) {
    console.error(`[siyuan-table-mater] command ${cmd.id} failed:`, err);
    showMessage(`${i18n.errOperationFailed || "操作失败"}: ${i18n[cmd.id] || cmd.nameZh}`, 3000, "error");
  }
}
