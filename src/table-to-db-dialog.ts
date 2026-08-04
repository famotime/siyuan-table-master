/**
 * table-to-db-dialog.ts
 * 
 * Markdown 表格转数据库的配置与预览对话框模块
 * 对标与借鉴 siyuan-table-to-database 项目的官方写库与热更新架构
 */

import { Dialog, fetchSyncPost, showMessage } from "siyuan";
import { TableDbData, ColumnMeta, DbFieldType, parseTableDataForDb } from "./table-to-db-utils";
import { logger } from "./logger";

/** 字段类型可选项列表 */
const FIELD_TYPE_OPTIONS: { type: DbFieldType; labelZh: string; labelEn: string }[] = [
  { type: "text", labelZh: "文本 (Text)", labelEn: "Text" },
  { type: "number", labelZh: "数字 (Number)", labelEn: "Number" },
  { type: "date", labelZh: "日期 (Date)", labelEn: "Date" },
  { type: "select", labelZh: "单选 (Select)", labelEn: "Select" },
  { type: "mSelect", labelZh: "多选 (Multi-Select)", labelEn: "Multi-Select" },
  { type: "checkbox", labelZh: "复选框 (Checkbox)", labelEn: "Checkbox" },
  { type: "url", labelZh: "网址 (URL)", labelEn: "URL" },
];

/**
 * 弹出“转数据库”预览与配置对话框
 */
export function showTableToDbDialog(
  tableBlockId: string,
  rawHeaders: string[],
  rawRows: string[][],
  i18n: any
): void {
  const dbData = parseTableDataForDb(rawHeaders, rawRows);

  const dialog = new Dialog({
    title: i18n.tableToDbTitle || "Markdown 表格转数据库配置",
    width: "760px",
    content: `
      <div class="b3-dialog__content" style="padding: 16px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto;">
        <div style="font-size: 13px; color: var(--b3-theme-on-surface-light);">
          已自动解析 <b>${dbData.columns.length}</b> 列，<b>${dbData.rows.length}</b> 行数据。请确认或微调各字段属性：
        </div>

        <!-- 字段类型与名称配置区域 -->
        <div style="border: 1px solid var(--b3-theme-surface-border); border-radius: 6px; padding: 12px; background: var(--b3-theme-background);">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: var(--b3-theme-on-background);">字段推断与类型设置</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--b3-theme-surface-border); text-align: left;">
                <th style="padding: 6px 8px; width: 60px;">序号</th>
                <th style="padding: 6px 8px;">列名称</th>
                <th style="padding: 6px 8px; width: 220px;">数据类型</th>
              </tr>
            </thead>
            <tbody>
              ${dbData.columns.map((col, idx) => `
                <tr style="border-bottom: 1px dashed var(--b3-theme-surface-border);">
                  <td style="padding: 6px 8px; color: var(--b3-theme-on-surface-light);">${idx + 1}</td>
                  <td style="padding: 6px 8px;">
                    <input class="b3-text-field" data-col-idx="${idx}" value="${escapeHtml(col.name)}" style="width: 95%;" />
                  </td>
                  <td style="padding: 6px 8px;">
                    <select class="b3-select" data-col-idx="${idx}" style="width: 100%;">
                      ${FIELD_TYPE_OPTIONS.map(opt => `
                        <option value="${opt.type}" ${col.selectedType === opt.type ? "selected" : ""}>
                          ${opt.labelZh} ${opt.inferredType === opt.type ? " (推荐)" : ""}
                        </option>
                      `).join("")}
                    </select>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- 预览前 5 行数据 -->
        <div style="border: 1px solid var(--b3-theme-surface-border); border-radius: 6px; padding: 12px; background: var(--b3-theme-background);">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: var(--b3-theme-on-background);">数据预览 (前 5 行)</div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: var(--b3-theme-surface); border-bottom: 1px solid var(--b3-theme-surface-border);">
                  ${dbData.columns.map(col => `<th style="padding: 6px 8px; white-space: nowrap;">${escapeHtml(col.name)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${dbData.rows.slice(0, 5).map(row => `
                  <tr style="border-bottom: 1px solid var(--b3-theme-surface-border);">
                    ${dbData.columns.map((_, i) => `<td style="padding: 6px 8px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(row[i] || "")}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
          <button class="b3-button b3-button--cancel" id="at-db-btn-cancel">取消</button>
          <button class="b3-button b3-button--text" id="at-db-btn-confirm" style="background-color: var(--b3-theme-primary); color: var(--b3-theme-on-primary);">生成数据库</button>
        </div>
      </div>
    `
  });

  const dialogEl = dialog.element;

  dialogEl.querySelector("#at-db-btn-cancel")?.addEventListener("click", () => {
    dialog.destroy();
  });

  dialogEl.querySelector("#at-db-btn-confirm")?.addEventListener("click", async () => {
    const nameInputs = dialogEl.querySelectorAll<HTMLInputElement>("input[data-col-idx]");

    const finalColumns: ColumnMeta[] = [];
    nameInputs.forEach((inputEl) => {
      const idx = parseInt(inputEl.getAttribute("data-col-idx") || "0", 10);
      const selectEl = dialogEl.querySelector<HTMLSelectElement>(`select[data-col-idx="${idx}"]`);
      const colName = inputEl.value.trim() || `列 ${idx + 1}`;
      const selectedType = (selectEl?.value || "text") as DbFieldType;

      finalColumns.push({
        index: idx,
        name: colName,
        inferredType: dbData.columns[idx]?.inferredType || "text",
        selectedType: selectedType
      });
    });

    dialog.destroy();
    await createAttributeViewDatabase(tableBlockId, finalColumns, rawRows, i18n);
  });
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 创建原生 Attribute View 数据库块并填充数据行（对标 siyuan-table-to-database 架构）
 */
async function createAttributeViewDatabase(
  tableBlockId: string,
  columns: ColumnMeta[],
  rows: string[][],
  i18n: any
): Promise<void> {
  try {
    const avID = generateLuteId();
    const primaryName = columns[0]?.name || "主键";
    const nonPrimaryCols = columns.slice(1);

    // 1. 构建 AV JSON (spec 5 骨架)
    const blockKeyID = generateLuteId();
    const viewID = generateLuteId();
    const tableID = generateLuteId();

    const keyValues: any[] = [
      { key: { id: blockKeyID, name: primaryName, type: "block", icon: "", desc: "", template: "" }, values: [] }
    ];
    const colList: any[] = [{ id: blockKeyID, wrap: false, hidden: false, pin: false, width: "" }];
    const cellDefs: { keyID: string; type: string; colIndex: number; options?: any[] }[] = [];

    nonPrimaryCols.forEach((col) => {
      const keyID = generateLuteId();
      const siyuanType = mapToSiyuanAvType(col.selectedType);
      let options: any[] | undefined = undefined;

      if (siyuanType === "select" || siyuanType === "mSelect") {
        options = buildOptionListForCol(rows, col.index);
      }

      keyValues.push({
        key: {
          id: keyID,
          name: col.name,
          type: siyuanType,
          icon: "",
          desc: "",
          template: "",
          ...(options ? { options } : {})
        },
        values: []
      });
      colList.push({ id: keyID, wrap: false, hidden: false, pin: false, width: "" });
      cellDefs.push({ keyID, type: siyuanType, colIndex: col.index, options });
    });

    const avJson = {
      spec: 5,
      id: avID,
      name: "表格转数据库",
      keyValues,
      keyIDs: keyValues.map(kv => kv.key.id),
      viewID,
      views: [
        {
          id: viewID,
          icon: "",
          name: "Default",
          hideAttrViewName: false,
          desc: "",
          pageSize: 50,
          type: "table",
          table: { spec: 0, id: tableID, showIcon: true, columns: colList },
          itemIds: [],
          filters: [],
          sorts: []
        }
      ]
    };

    // 2. 写入数据库 AV 存储文件 (/data/storage/av/${avID}.json)
    await putFileContent(`/data/storage/av/${avID}.json`, JSON.stringify(avJson, null, 2));

    // 3. 在 Markdown 表格后插入 NodeAttributeView 数据库节点
    const avBlockId = generateLuteId();
    const ts = generateLuteId().split("-")[0];
    const dom = `<div data-node-id="${avBlockId}" data-type="NodeAttributeView" data-av-id="${avID}" data-av-type="custom" class="av" updated="${ts}"></div>`;

    await fetchSyncPost("/api/block/insertBlock", {
      dataType: "dom",
      data: dom,
      previousID: tableBlockId
    });

    // 4. 构造数据行 blocksValues 并追加写库
    const blocksValues: any[][] = [];
    rows.forEach((r) => {
      const primaryVal = (r[0] || "").trim();
      if (!primaryVal) return;

      const rowValues: any[] = [
        { keyID: blockKeyID, type: "block", block: { content: primaryVal } }
      ];

      cellDefs.forEach((def) => {
        rowValues.push(buildAvCellVal(def.keyID, def.type, r[def.colIndex], def.options));
      });

      blocksValues.push(rowValues);
    });

    if (blocksValues.length > 0) {
      await fetchSyncPost("/api/av/appendAttributeViewDetachedBlocksWithValues", {
        avID,
        blocksValues
      });
    }

    // 获取当前表格所在文档的 rootID
    let rootID = "";
    try {
      const blockInfo = await fetchSyncPost("/api/block/getBlockInfo", { id: tableBlockId });
      rootID = blockInfo?.data?.rootID || blockInfo?.rootID || "";
    } catch (e) {
      logger.warn("[siyuan-table-master] getBlockInfo notice:", e);
    }

    // 5. 触发思源编辑器与属性视图即时热刷新（解决需手动刷新文档问题）
    if (rootID) {
      try {
        await fetchSyncPost("/api/ui/reloadProtyle", { id: rootID });
      } catch (e) {
        logger.warn("[siyuan-table-master] reloadProtyle notice:", e);
      }
    }
    try {
      await fetchSyncPost("/api/ui/reloadAttributeView", { id: avID });
    } catch (_) {}

    showMessage(i18n.tableToDbSuccess || "已成功将 Markdown 表格转换为数据库！", 3000, "info");
  } catch (err) {
    logger.error("[siyuan-table-master] createAttributeViewDatabase failed:", err);
    showMessage(i18n.errOperationFailed || "创建数据库失败", 3000, "error");
  }
}

/**
 * 上传 JSON 存储文件
 */
async function putFileContent(path: string, content: string): Promise<void> {
  const form = new FormData();
  form.append("path", path);
  form.append("isDir", "false");
  form.append("modTime", String(Math.floor(Date.now() / 1000)));
  form.append("file", new Blob([content], { type: "application/json" }), "file");

  const resp = await fetch("/api/file/putFile", { method: "POST", body: form });
  if (!resp.ok) {
    throw new Error(`putFile failed: ${resp.status}`);
  }
}

/**
 * 为单选/多选列生成选项配置列表
 */
function buildOptionListForCol(rows: string[][], colIdx: number): any[] {
  const seen = new Set<string>();
  const opts: any[] = [];

  rows.forEach((r) => {
    const val = (r[colIdx] || "").trim();
    if (!val) return;
    const parts = val.split(/[,;、|]/).map(p => p.trim()).filter(Boolean);

    parts.forEach((p) => {
      const key = p.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ name: p, color: String((opts.length % 14) + 1), desc: "" });
      }
    });
  });

  return opts;
}

/**
 * 严格按照思源 AV Cell 规范构造单元格 JSON 结构
 */
function buildAvCellVal(keyID: string, type: string, rawVal: any, options?: any[]): any {
  const v = (rawVal == null ? "" : String(rawVal)).trim();
  const base = { keyID, type };

  switch (type) {
    case "text":
      return { ...base, text: { content: v } };

    case "number": {
      const empty = v === "";
      const n = empty ? 0 : Number(v.replace(/,/g, ""));
      const ok = !empty && !isNaN(n);
      return {
        ...base,
        number: {
          content: isNaN(n) ? 0 : n,
          isNotEmpty: ok,
          format: "",
          formattedContent: ok ? String(n) : "",
        },
      };
    }

    case "checkbox": {
      const checked = ["true", "✓", "✔", "☑", "是", "1", "yes", "y"].includes(v.toLowerCase());
      return { ...base, checkbox: { checked } };
    }

    case "select":
    case "mSelect": {
      if (!v) return { ...base, mSelect: [] };
      const opts = options || [];
      const findOpt = (name: string) => opts.find(o => o.name.toLowerCase() === name.toLowerCase());

      const parts = v.split(/[,;、|]/).map(p => p.trim()).filter(Boolean);
      const arr = parts.map(p => {
        const o = findOpt(p);
        return { content: o ? o.name : p, color: (o && o.color) || "1" };
      });

      return { ...base, mSelect: arr };
    }

    case "url":
      return { ...base, url: { content: v } };

    case "date": {
      const ms = parseDateToMs(v);
      const notEmpty = !isNaN(ms);
      return {
        ...base,
        date: {
          content: notEmpty ? ms : 0,
          isNotEmpty: notEmpty,
          hasEndDate: false,
          isNotTime: true,
          content2: 0,
          isNotEmpty2: false,
          formattedContent: "",
        },
      };
    }

    default:
      return { ...base, text: { content: v } };
  }
}

/**
 * 常用日期字符串解析为毫秒时间戳
 */
function parseDateToMs(s: string): number {
  if (!s) return NaN;
  const norm = s
    .replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "")
    .replace(/\./g, "-").replace(/\//g, "-");
  return Date.parse(norm);
}

/**
 * 映射前端 DbFieldType 到思源笔记 AV 官方字段类型
 */
function mapToSiyuanAvType(type: DbFieldType): string {
  switch (type) {
    case "text": return "text";
    case "number": return "number";
    case "date": return "date";
    case "select": return "select";
    case "mSelect": return "mSelect";
    case "checkbox": return "checkbox";
    case "url": return "url";
    default: return "text";
  }
}

/**
 * 生成 22 位 Lute 格式时间戳随机 ID
 */
function generateLuteId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const randomChars = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomChars}`;
}
