import { Dialog } from "siyuan";
import { HtmlTableEditor } from "./html-table-editor";
import type TableMaterPlugin from "./index";

export function openHtmlDialogEditor(plugin: TableMaterPlugin, te: HtmlTableEditor) {
  const table = te.getTable();
  if (!table) {
    return;
  }

  // 克隆 table 以便在弹窗中操作，不影响正文原 DOM
  const tableClone = table.cloneNode(true) as HTMLTableElement;
  
  // 给所有单元格增加 contenteditable
  const cells = tableClone.querySelectorAll("td, th");
  cells.forEach(cell => {
    (cell as HTMLElement).setAttribute("contenteditable", "true");
    (cell as HTMLElement).style.outline = "none";
    (cell as HTMLElement).style.minWidth = "50px";
  });

  const dialog = new Dialog({
    title: "高级 HTML 表格编辑器",
    content: `
      <div class="at-html-dialog-toolbar" style="padding: 8px; border-bottom: 1px solid var(--b3-theme-surface-lighter); display: flex; gap: 8px; background: var(--b3-theme-surface); flex-wrap: wrap; align-items: center;">
        <button class="b3-button b3-button--outline" id="at-btn-merge" title="合并所选">合并</button>
        <button class="b3-button b3-button--outline" id="at-btn-split" title="拆分单元格">拆分</button>
        <div style="width: 1px; height: 16px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
        <button class="b3-button b3-button--outline" id="at-btn-ins-row-above" title="上方插入行">上插行</button>
        <button class="b3-button b3-button--outline" id="at-btn-ins-row-below" title="下方插入行">下插行</button>
        <button class="b3-button b3-button--outline" id="at-btn-ins-col-left" title="左侧插入列">左插列</button>
        <button class="b3-button b3-button--outline" id="at-btn-ins-col-right" title="右侧插入列">右插列</button>
        <div style="width: 1px; height: 16px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
        <button class="b3-button b3-button--outline" id="at-btn-del-row" title="删除行">删行</button>
        <button class="b3-button b3-button--outline" id="at-btn-del-col" title="删除列">删列</button>
        <div style="width: 1px; height: 16px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
        <input type="color" id="at-color-picker" title="背景颜色" style="width: 32px; height: 24px; padding: 0; border: none; cursor: pointer;">
      </div>
      <div class="at-html-dialog-editor" style="padding: 16px; overflow: auto; max-height: 60vh; background: var(--b3-theme-background);">
        <!-- 表格将被挂载在这里 -->
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-btn-cancel">取消</button>
        <button class="b3-button b3-button--text" id="at-btn-save">保存</button>
      </div>
    `,
    width: "800px",
  });

  const editorContainer = dialog.element.querySelector(".at-html-dialog-editor") as HTMLElement;
  editorContainer.appendChild(tableClone);

  // 绑定原生工具栏事件
  const btnMerge = dialog.element.querySelector("#at-btn-merge") as HTMLButtonElement;
  const btnSplit = dialog.element.querySelector("#at-btn-split") as HTMLButtonElement;
  const btnInsRowAbove = dialog.element.querySelector("#at-btn-ins-row-above") as HTMLButtonElement;
  const btnInsRowBelow = dialog.element.querySelector("#at-btn-ins-row-below") as HTMLButtonElement;
  const btnInsColLeft = dialog.element.querySelector("#at-btn-ins-col-left") as HTMLButtonElement;
  const btnInsColRight = dialog.element.querySelector("#at-btn-ins-col-right") as HTMLButtonElement;
  const btnDelRow = dialog.element.querySelector("#at-btn-del-row") as HTMLButtonElement;
  const btnDelCol = dialog.element.querySelector("#at-btn-del-col") as HTMLButtonElement;
  const colorPicker = dialog.element.querySelector("#at-color-picker") as HTMLInputElement;

  // 辅助函数：获取当前选中的单元格
  const getSelectedCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.getRangeAt(0).startContainer;
    while (node && node !== editorContainer) {
      if (node.nodeName.toLowerCase() === "td" || node.nodeName.toLowerCase() === "th") {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode as Node;
    }
    return null;
  };

  btnMerge.addEventListener("click", () => {
    console.log("Merge clicked - 暂未实现多选逻辑");
  });

  btnSplit.addEventListener("click", () => {
    console.log("Split clicked - 暂未实现");
  });

  colorPicker.addEventListener("input", (e) => {
    const cell = getSelectedCell();
    if (cell) {
      cell.style.backgroundColor = (e.target as HTMLInputElement).value;
    }
  });

  btnInsRowAbove.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const newTr = document.createElement("tr");
    for (let i = 0; i < tr.cells.length; i++) {
      const td = document.createElement(tr.cells[i].tagName);
      td.setAttribute("contenteditable", "true");
      td.style.minWidth = "50px";
      newTr.appendChild(td);
    }
    tr.parentElement?.insertBefore(newTr, tr);
  });

  btnInsRowBelow.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const newTr = document.createElement("tr");
    for (let i = 0; i < tr.cells.length; i++) {
      const td = document.createElement(tr.cells[i].tagName);
      td.setAttribute("contenteditable", "true");
      td.style.minWidth = "50px";
      newTr.appendChild(td);
    }
    if (tr.nextSibling) {
      tr.parentElement?.insertBefore(newTr, tr.nextSibling);
    } else {
      tr.parentElement?.appendChild(newTr);
    }
  });

  btnInsColLeft.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const cellIndex = Array.from(tr.cells).indexOf(cell);
    const tableEl = tr.closest("table");
    if (!tableEl) return;
    
    const rows = tableEl.querySelectorAll("tr");
    rows.forEach(r => {
      const targetCell = r.cells[cellIndex];
      const newTd = document.createElement(targetCell ? targetCell.tagName : "td");
      newTd.setAttribute("contenteditable", "true");
      newTd.style.minWidth = "50px";
      if (targetCell) {
        r.insertBefore(newTd, targetCell);
      } else {
        r.appendChild(newTd);
      }
    });
  });

  btnInsColRight.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const cellIndex = Array.from(tr.cells).indexOf(cell);
    const tableEl = tr.closest("table");
    if (!tableEl) return;
    
    const rows = tableEl.querySelectorAll("tr");
    rows.forEach(r => {
      const targetCell = r.cells[cellIndex];
      const newTd = document.createElement(targetCell ? targetCell.tagName : "td");
      newTd.setAttribute("contenteditable", "true");
      newTd.style.minWidth = "50px";
      if (targetCell && targetCell.nextSibling) {
        r.insertBefore(newTd, targetCell.nextSibling);
      } else {
        r.appendChild(newTd);
      }
    });
  });

  btnDelRow.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    tr.remove();
  });

  btnDelCol.addEventListener("click", () => {
    const cell = getSelectedCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const cellIndex = Array.from(tr.cells).indexOf(cell);
    const tableEl = tr.closest("table");
    if (!tableEl) return;
    
    const rows = tableEl.querySelectorAll("tr");
    rows.forEach(r => {
      if (r.cells[cellIndex]) {
        r.cells[cellIndex].remove();
      }
    });
  });

  // 保存逻辑
  const btnSave = dialog.element.querySelector("#at-btn-save") as HTMLButtonElement;
  btnSave.addEventListener("click", async () => {
    // 移除 contenteditable
    const editedCells = tableClone.querySelectorAll("td, th");
    editedCells.forEach(cell => {
      (cell as HTMLElement).removeAttribute("contenteditable");
      (cell as HTMLElement).style.outline = "";
    });

    // 将修改后的 table 替换原先的 tableElement (HtmlTableEditor 会通过 domDocument 提取 innerHTML)
    if (table.parentNode) {
      table.parentNode.replaceChild(tableClone, table);
    }
    
    await te.flush();
    dialog.destroy();
  });

  const btnCancel = dialog.element.querySelector("#at-btn-cancel") as HTMLButtonElement;
  btnCancel.addEventListener("click", () => {
    dialog.destroy();
  });
}
