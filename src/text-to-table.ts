/**
 * text-to-table.ts - 文本转表格功能模块（UI 交互）
 *
 * 纯函数定义在 text-to-table-utils.ts，
 * 本文件仅包含依赖 siyuan 运行时的执行逻辑。
 */

import { getActiveEditor, fetchSyncPost, showMessage, Dialog } from "siyuan";
import { parseLines, isBoxDrawingTable, escapeHtml, gridToMarkdown } from "./text-to-table-utils";

/**
 * 执行文本转换为表格：获取当前选区 → 读取 kramdown → 弹出配置对话框
 */
export async function executeTextToTable(): Promise<void> {
  const activeEditor = getActiveEditor();
  if (!activeEditor?.protyle) {
    showMessage("请先聚焦编辑器", 2000, "error");
    return;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    showMessage("未找到有效选区", 2000, "error");
    return;
  }

  const range = sel.getRangeAt(0);
  let parent = range.startContainer as HTMLElement | null;
  let blockId: string | null = null;
  let blockEl: HTMLElement | null = null;

  while (parent && parent !== document.body) {
    if (parent instanceof HTMLElement && parent.dataset.nodeId) {
      blockId = parent.dataset.nodeId;
      blockEl = parent;
      break;
    }
    parent = parent.parentNode as HTMLElement | null;
  }

  if (!blockId || !blockEl) {
    showMessage("请点击需要转换的文本块", 3000, "info");
    return;
  }

  if (blockEl.dataset.type === "NodeTable") {
    showMessage("当前块已经是表格块", 2000, "info");
    return;
  }

  try {
    const res = await fetchSyncPost("/api/block/getBlockKramdown", {
      id: blockId,
    });

    let kramdown = "";
    if (res && res.code === 0 && res.data) {
      kramdown = typeof res.data === "string" ? res.data : (res.data as any).kramdown ?? "";
    }

    // 过滤掉行内 IAL 属性并特殊过滤掉 ``` 开头的代码块语法标识线，支持直接转换代码块
    const rawLines = kramdown.split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("{:") && !line.startsWith("```"));

    if (rawLines.length === 0) {
      showMessage("当前段落块内容为空", 3000, "info");
      return;
    }

    showTextToTableDialog(blockId, rawLines);
  } catch (err) {
    console.error("[siyuan-advanced-tables] executeTextToTable failed:", err);
  }
}

/**
 * 弹出文本转换为表格配置与预览 Dialog
 */
function showTextToTableDialog(blockId: string, rawLines: string[]): void {
  const isBoxDrawing = isBoxDrawingTable(rawLines);
  let separator = isBoxDrawing ? "box-drawing" : ",";

  const generatePreview = (sep: string): string => {
    const borderLineRegex = /^[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╪┼┠┨┯┷┿┝┥┰┸╂\s\-+*#=]+$/;
    const linesToParse = sep === "box-drawing"
      ? rawLines.filter(line => !borderLineRegex.test(line.trim()))
      : rawLines;

    const previewLines = linesToParse.slice(0, 5);
    const grid = parseLines(sep, previewLines);

    let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;">`;
    grid.forEach((parts, rIdx) => {
      html += `<tr>`;
      parts.forEach(part => {
        if (rIdx === 0) {
          html += `<th style="border:1px solid var(--b3-border-color); padding:4px 8px; background-color:var(--b3-theme-surface-light, rgba(0, 0, 0, 0.02)); font-weight:600; text-align:left;">${escapeHtml(part)}</th>`;
        } else {
          html += `<td style="border:1px solid var(--b3-border-color); padding:4px 8px;">${escapeHtml(part)}</td>`;
        }
      });
      html += `</tr>`;
    });
    html += `</table>`;

    if (linesToParse.length > 5) {
      html += `<div style="font-size:11px; opacity:0.5; margin-top:6px; text-align:center;">仅展示前 5 行预览（共 ${linesToParse.length} 行）</div>`;
    }
    return html;
  };

  const dialog = new Dialog({
    title: "选中文本转换为表格",
    content: `
      <div class="b3-dialog__content" style="padding:16px 24px 8px; display:flex; flex-direction:column; gap:14px;">
        <div style="font-size:13px; opacity:0.8; line-height:1.5;">请选择行内数据的分隔符：</div>
        <div style="display:flex; gap:16px; align-items:center; font-size:13px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value="box-drawing" ${isBoxDrawing ? "checked" : ""} /> 终端表格 (制图字符)
          </label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value="," ${!isBoxDrawing ? "checked" : ""} /> 英文逗号 ( , )
          </label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value="，" /> 中文逗号 ( ， )
          </label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value="\\t" /> Tab 键
          </label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value=" " /> 空格
          </label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="radio" name="at-sep" value="custom" /> 自定义:
            <input type="text" id="at-custom-sep" style="width:40px; padding:2px 4px; border:1px solid var(--b3-border-color); border-radius:4px; font-size:12px;" disabled />
          </label>
        </div>
        <div style="font-size:13px; font-weight:600; margin-top:4px;">转换效果预览：</div>
        <div id="at-table-preview-container" style="max-height:180px; overflow-y:auto; border:1px solid var(--b3-border-color); border-radius:6px; padding:10px; background-color:var(--b3-theme-surface);">
          ${generatePreview(separator)}
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-conv-cancel">取消</button>
        <button class="b3-button b3-button--text" id="at-conv-confirm">确认转换</button>
      </div>
    `,
    width: "500px",
  });

  const previewContainer = dialog.element.querySelector("#at-table-preview-container") as HTMLElement;
  const customInput = dialog.element.querySelector("#at-custom-sep") as HTMLInputElement;

  const updatePreview = () => {
    let activeSep = separator;
    if (separator === "custom") {
      activeSep = customInput.value || ",";
    }
    if (previewContainer) {
      previewContainer.innerHTML = generatePreview(activeSep);
    }
  };

  // 监听分隔符改变
  dialog.element.querySelectorAll("input[name='at-sep']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = (e.target as HTMLInputElement).value;
      separator = val;
      if (val === "custom") {
        customInput.removeAttribute("disabled");
        customInput.focus();
      } else {
        customInput.setAttribute("disabled", "true");
      }
      updatePreview();
    });
  });

  customInput.addEventListener("input", () => {
    updatePreview();
  });

  // 取消
  dialog.element.querySelector("#at-conv-cancel")?.addEventListener("click", () => {
    dialog.destroy();
  });

  // 确认
  dialog.element.querySelector("#at-conv-confirm")?.addEventListener("click", async () => {
    let activeSep = separator;
    if (separator === "custom") {
      activeSep = customInput.value || ",";
    }

    dialog.destroy();

    // 将行解析为二维数组
    const grid = parseLines(activeSep, rawLines);
    if (grid.length === 0) {
      showMessage("解析后未发现有效数据行", 3000, "info");
      return;
    }

    const markdownTable = gridToMarkdown(grid);

    try {
      await fetchSyncPost("/api/block/updateBlock", {
        id: blockId,
        dataType: "markdown",
        data: markdownTable,
      });
      showMessage("转换表格成功", 2000);
    } catch (err) {
      console.error("[siyuan-advanced-tables] convert to table failed:", err);
      showMessage("转换表格失败", 3000, "error");
    }
  });
}
