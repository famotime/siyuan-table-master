import type { Plugin } from "siyuan";
import { HtmlTableEditor } from "./html-table-editor";
import { findHtmlTableBlock } from "./dom-utils";
import { getActiveEditor, showMessage } from "siyuan";
import { openHtmlDialogEditor } from "./html-dialog-editor";

export interface HtmlTableCommand {
  id: string;
  nameZh: string;
  nameEn: string;
  icon?: string;
  action: (te: HtmlTableEditor, plugin: Plugin) => Promise<boolean | void>;
}

export const HTML_TABLE_COMMANDS: HtmlTableCommand[] = [
  { id: "html-open-dialog-editor", nameZh: "高级编辑", nameEn: "Advanced Editor", icon: "iconEdit", action: async (te, plugin) => {
    openHtmlDialogEditor(plugin as any, te);
    return false; // 不自动 flush，弹窗保存时自行 flush
  }}
];

export function registerHtmlCommands(plugin: Plugin): void {
  for (const cmd of HTML_TABLE_COMMANDS) {
    plugin.addCommand({
      langKey: cmd.id,
      langMenu: cmd.nameZh,
      hotkey: "",
      callback: async () => {
        await executeHtmlCommand(cmd, plugin, (plugin as any).i18n);
      },
    });
  }
}

export async function executeHtmlCommand(
  cmd: HtmlTableCommand,
  plugin: Plugin,
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
    
    const shouldFlush = await cmd.action(ctx, plugin);
    
    // 如果命令返回 false，则不自动写回（例如弹窗编辑器会自己处理写回）
    if (shouldFlush !== false) {
      await ctx.flush();
    }
    
  } catch (err) {
    console.error(`[siyuan-table-mater] html command ${cmd.id} failed:`, err);
    showMessage(`${i18n.errOperationFailed || "操作失败"}: ${i18n[cmd.id] || cmd.nameZh}`, 3000, "error");
  }
}
