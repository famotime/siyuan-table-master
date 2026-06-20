/**
 * confirm-dialog.ts - 粘贴覆盖确认对话框
 *
 * 当粘贴目标行/列已有内容时弹出此对话框，
 * 用户可以选择取消或确认覆盖。
 */

import { Dialog } from "siyuan";
import { escapeHtml } from "./dom-utils";

/**
 * 弹出粘贴覆盖确认框
 *
 * @param title    - 对话框标题（如"当前行已有内容，是否覆盖？"）
 * @param currentInfo - 描述当前目标区域内容的文本
 * @param pasteInfo   - 描述即将粘贴内容的文本
 * @param onConfirm   - 用户点击"确认覆盖"时的异步回调
 * @param onCancel    - 用户点击"取消"时的回调
 * @param onDestroy   - 对话框销毁时的兜底回调（主要用于防止 Promise 挂起）
 */
export function showPasteConfirmDialog(
  title: string,
  currentInfo: string,
  pasteInfo: string,
  i18n: any,
  onConfirm: () => Promise<void>,
  onCancel: () => void,
  onDestroy?: () => void,
): void {
  const dialog = new Dialog({
    title,
    content: `
      <div class="b3-dialog__content at-dialog-content">
        <div class="at-dialog-list">
          <div class="at-dialog-row">
            <span class="at-dialog-label">${escapeHtml(i18n.pasteConfirmCurrent || "现有内容")}</span>
            <span class="at-dialog-value">${escapeHtml(currentInfo)}</span>
          </div>
          <div class="at-dialog-row">
            <span class="at-dialog-label at-primary">${escapeHtml(i18n.pasteConfirmNew || "粘贴内容")}</span>
            <span class="at-dialog-value at-primary">${escapeHtml(pasteInfo)}</span>
          </div>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-paste-cancel">${escapeHtml(i18n.cancel || "取消")}</button>
        <button class="b3-button b3-button--text" id="at-paste-confirm">${escapeHtml(i18n.confirmOverride || "确认覆盖")}</button>
      </div>`,
    width: "480px",
    destroyCallback: onDestroy, // 挂载对话框意外关闭时的兜底释放回调
  });

  // 确认
  dialog.element
    .querySelector("#at-paste-confirm")
    ?.addEventListener("click", async () => {
      dialog.destroy();
      await onConfirm();
    });

  // 取消
  dialog.element
    .querySelector("#at-paste-cancel")
    ?.addEventListener("click", () => {
      dialog.destroy();
      onCancel();
    });
}
