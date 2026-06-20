/**
 * keybind.ts - 键盘拦截
 * 
 * 在思源 Protyle 的 WYSIWYG 区域拦截 Tab/Enter 键，
 * 仅当光标在表格内时触发高级表格操作。
 * 
 * 使用 DOM 捕获阶段（capture phase）确保在思源默认处理之前拦截。
 */

import type { PluginSettings } from "./settings";
import type { Protyle } from "siyuan";
import { isCursorInTable, SiyuanTextEditor } from "./siyuan-text-editor";
import { TableEditor } from "./table-editor";
import { showMessage } from "siyuan";

/** 操作锁：防止快速连击竞态 */
let operationLock = false;

/**
 * 为 Protyle 的 WYSIWYG 元素安装键盘拦截
 */
export function installKeybind(
  protyle: Protyle,
  settings: PluginSettings,
): () => void {
  const wysiwyg = protyle.protyle?.wysiwyg?.element;
  if (!wysiwyg) return () => {};

  const handler = async (e: KeyboardEvent) => {
    // 忽略输入法组合输入
    if (e.isComposing) return;

    // 只拦截 Tab 和 Enter
    if (e.key !== "Tab" && e.key !== "Enter") return;

    // 检查设置是否绑定
    if (e.key === "Tab" && !settings.bindTab) return;
    if (e.key === "Enter" && !settings.bindEnter) return;

    // 检查光标是否在表格内
    const { inTable, tableBlock, blockId } = isCursorInTable(protyle);
    if (!inTable || !tableBlock || !blockId) return;

    // 操作锁
    if (operationLock) {
      e.preventDefault();
      return;
    }

    // 阻止默认行为
    e.preventDefault();
    e.stopPropagation();

    operationLock = true;
    try {
      const ctx = new SiyuanTextEditor({
        protyle,
        tableBlockEl: tableBlock,
        blockId,
        fixCJKWidth: settings.fixCJKWidth,
      });
      const te = new TableEditor(ctx, settings);

      if (e.key === "Tab" && !e.shiftKey) {
        await te.nextCell();
      } else if (e.key === "Tab" && e.shiftKey) {
        await te.previousCell();
      } else if (e.key === "Enter") {
        await te.nextRow();
      }
    } catch (err) {
      console.error("[siyuan-advanced-tables] keybind error:", err);
      showMessage("高级表格操作失败", 3000, "error");
    } finally {
      operationLock = false;
    }
  };

  // 捕获阶段优先于思源默认处理
  wysiwyg.addEventListener("keydown", handler, true);

  // 返回卸载函数
  return () => {
    wysiwyg.removeEventListener("keydown", handler, true);
  };
}

/**
 * 为所有已打开的编辑器安装键盘拦截
 */
export function installKeybindAll(
  getEditors: () => any[],
  settings: PluginSettings,
): () => void {
  const uninstalls: (() => void)[] = [];

  for (const editor of getEditors()) {
    if (editor?.protyle) {
      const uninstall = installKeybind(editor.protyle, settings);
      uninstalls.push(uninstall);
    }
  }

  return () => {
    for (const uninstall of uninstalls) {
      uninstall();
    }
  };
}
