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
import { showMessage, getActiveEditor, fetchSyncPost } from "siyuan";

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
  // ── 复制与粘贴 ──
  { id: "copy-row", nameZh: "复制行", nameEn: "Copy row", action: async (te) => {
    const err = await te.copyRow();
    if (err) showMessage(err, 3000, "error");
  }},
  { id: "copy-column", nameZh: "复制列", nameEn: "Copy column", action: async (te) => {
    const err = await te.copyColumn();
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
  { id: "text-to-table", nameZh: "文本转为表格", nameEn: "Convert text to table", action: async () => {} },
];

import { Dialog } from "siyuan";

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

    // 特判：文本转为表格命令不受“光标必须在表格内”的限制
    if (cmd.id === "text-to-table") {
      await executeTextToTable();
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

/** 执行文本转换为表格 */
async function executeTextToTable(): Promise<void> {
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

    const rawLines = kramdown.split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("{:"));

    if (rawLines.length === 0) {
      showMessage("当前段落块内容为空", 3000, "info");
      return;
    }

    showTextToTableDialog(blockId, rawLines);
  } catch (err) {
    console.error("[siyuan-advanced-tables] executeTextToTable failed:", err);
  }
}

/** 弹出文本转换为表格配置与预览 Dialog */
function showTextToTableDialog(blockId: string, rawLines: string[]): void {
  let separator = ",";

  const generatePreview = (sep: string): string => {
    const previewLines = rawLines.slice(0, 5);
    let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;">`;
    previewLines.forEach((line, rIdx) => {
      const parts = line.split(sep).map(p => p.trim());
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
    
    if (rawLines.length > 5) {
      html += `<div style="font-size:11px; opacity:0.5; margin-top:6px; text-align:center;">仅展示前 5 行预览（共 ${rawLines.length} 行）</div>`;
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
            <input type="radio" name="at-sep" value="," checked /> 英文逗号 ( , )
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
          ${generatePreview(",")}
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
    if (separator === "\\t") {
      activeSep = "\t";
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
    if (separator === "\\t") {
      activeSep = "\t";
    }

    dialog.destroy();

    // 将行解析为二维数组
    const grid = rawLines.map(line => line.split(activeSep).map(c => c.trim()));
    const colCount = Math.max(...grid.map(r => r.length));
    const markdownLines: string[] = [];

    // 1. 表头
    const header = grid[0] ?? [];
    const headerCells = Array.from({ length: colCount }, (_, i) => header[i] ?? "");
    markdownLines.push(`| ${headerCells.join(" | ")} |`);

    // 2. 分隔线
    const sepCells = Array.from({ length: colCount }, () => "---");
    markdownLines.push(`| ${sepCells.join(" | ")} |`);

    // 3. 数据行
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const rowCells = Array.from({ length: colCount }, (_, i) => row[i] ?? "");
      markdownLines.push(`| ${rowCells.join(" | ")} |`);
    }

    const markdownTable = markdownLines.join("\n");

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
