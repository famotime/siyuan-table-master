/**
 * confirm-dialog.ts - 粘贴覆盖确认对话框
 *
 * 当粘贴目标行/列已有内容时弹出此对话框，
 * 用户可以选择取消或确认覆盖。
 */

import { Dialog } from "siyuan";

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
  onConfirm: () => Promise<void>,
  onCancel: () => void,
  onDestroy?: () => void,
): void {
  const dialog = new Dialog({
    title,
    content: `
      <div class="b3-dialog__content" style="padding:16px 24px 8px;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="flex-shrink:0;font-size:12px;font-weight:600;
                         color:var(--b3-theme-on-surface);opacity:0.55;
                         padding-top:1px;min-width:60px;">现有内容</span>
            <span style="font-size:13px;color:var(--b3-theme-on-surface);
                         word-break:break-all;line-height:1.5;">${escapeHtml(currentInfo)}</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="flex-shrink:0;font-size:12px;font-weight:600;
                         color:var(--b3-theme-primary);
                         padding-top:1px;min-width:60px;">粘贴内容</span>
            <span style="font-size:13px;color:var(--b3-theme-primary);
                         word-break:break-all;line-height:1.5;">${escapeHtml(pasteInfo)}</span>
          </div>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-paste-cancel">取消</button>
        <button class="b3-button b3-button--text" id="at-paste-confirm">确认覆盖</button>
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

/** HTML 转义，防止单元格内容中出现 < > 等符号破坏 dialog 结构 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
