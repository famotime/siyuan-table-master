import type { Plugin } from "siyuan";
import { HtmlTableEditor } from "./html-table-editor";
import { findHtmlTableBlock } from "./dom-utils";
import { getActiveEditor, showMessage } from "siyuan";

export interface HtmlTableCommand {
  id: string;
  nameZh: string;
  nameEn: string;
  icon?: string;
  action: (te: HtmlTableEditor) => Promise<void>;
}

export const HTML_TABLE_COMMANDS: HtmlTableCommand[] = [
  { id: "html-merge-cells", nameZh: "合并单元格", nameEn: "Merge cells", icon: "iconContract", action: async (te) => {
    // TODO: 实现合并逻辑
    showMessage("合并单元格开发中...", 2000, "info");
  }},
  { id: "html-split-cell", nameZh: "拆分单元格", nameEn: "Split cell", action: async (te) => {
    // TODO: 实现拆分逻辑
    showMessage("拆分单元格开发中...", 2000, "info");
  }},
  { id: "html-insert-row-above", nameZh: "上方插入行", nameEn: "Insert row above", icon: "iconInsertRow", action: async (te) => {
    showMessage("上方插入行开发中...", 2000, "info");
  }},
  { id: "html-insert-row-below", nameZh: "下方插入行", nameEn: "Insert row below", icon: "iconInsertRow", action: async (te) => {
    showMessage("下方插入行开发中...", 2000, "info");
  }},
  { id: "html-insert-col-left", nameZh: "左侧插入列", nameEn: "Insert col left", icon: "iconInsertColumn", action: async (te) => {
    showMessage("左侧插入列开发中...", 2000, "info");
  }},
  { id: "html-insert-col-right", nameZh: "右侧插入列", nameEn: "Insert col right", icon: "iconInsertColumn", action: async (te) => {
    showMessage("右侧插入列开发中...", 2000, "info");
  }},
  { id: "html-delete-row", nameZh: "删除行", nameEn: "Delete row", icon: "iconDeleteRow", action: async (te) => {
    showMessage("删除行开发中...", 2000, "info");
  }},
  { id: "html-delete-col", nameZh: "删除列", nameEn: "Delete col", icon: "iconDeleteColumn", action: async (te) => {
    showMessage("删除列开发中...", 2000, "info");
  }},
];

export function registerHtmlCommands(plugin: Plugin): void {
  for (const cmd of HTML_TABLE_COMMANDS) {
    plugin.addCommand({
      langKey: cmd.id,
      langMenu: cmd.nameZh,
      hotkey: "",
      callback: async () => {
        await executeHtmlCommand(cmd, (plugin as any).i18n);
      },
    });
  }
}

export async function executeHtmlCommand(
  cmd: HtmlTableCommand,
  i18n: any = {}
): Promise<void> {
  try {
    const protyle = getActiveEditor?.();
    if (!protyle?.protyle) {
      showMessage(i18n.errFocusEditor || "请先聚焦编辑器", 2000, "error");
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      showMessage(i18n.noActiveTable || "光标不在表格内", 2000, "error");
      return;
    }

    const range = sel.getRangeAt(0);
    const htmlTableInfo = findHtmlTableBlock(range.startContainer);

    if (!htmlTableInfo) {
      showMessage(i18n.noActiveTable || "光标不在 HTML 表格内", 2000, "error");
      return;
    }

    const blockId = htmlTableInfo.block.dataset.nodeId;
    if (!blockId) {
      return;
    }

    const ctx = new HtmlTableEditor({ blockId });
    await ctx.reload();
    
    await cmd.action(ctx);
    
    // 操作后写回数据
    await ctx.flush();
    
  } catch (err) {
    console.error(`[siyuan-table-mater] html command ${cmd.id} failed:`, err);
    showMessage(`${i18n.errOperationFailed || "操作失败"}: ${i18n[cmd.id] || cmd.nameZh}`, 3000, "error");
  }
}

export async function executeHtmlColorCommand(
  colorVal: string,
  i18n: any = {}
): Promise<void> {
  try {
    const protyle = getActiveEditor?.();
    if (!protyle?.protyle) {
      showMessage(i18n.errFocusEditor || "请先聚焦编辑器", 2000, "error");
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      showMessage(i18n.noActiveTable || "光标不在表格内", 2000, "error");
      return;
    }

    const range = sel.getRangeAt(0);
    const htmlTableInfo = findHtmlTableBlock(range.startContainer);

    if (!htmlTableInfo) {
      showMessage(i18n.noActiveTable || "光标不在 HTML 表格内", 2000, "error");
      return;
    }

    const blockId = htmlTableInfo.block.dataset.nodeId;
    if (!blockId) {
      return;
    }

    // TODO: 实际的颜色修改逻辑
    showMessage(`设置颜色 ${colorVal} 开发中...`, 2000, "info");
    
  } catch (err) {
    console.error(`[siyuan-table-mater] html color command failed:`, err);
    showMessage(`${i18n.errOperationFailed || "操作失败"}`, 3000, "error");
  }
}
