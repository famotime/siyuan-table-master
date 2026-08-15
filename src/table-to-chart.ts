import { Dialog, showMessage, fetchSyncPost } from "siyuan";
import { TableEditor } from "./table-editor";
import { isSeparatorLine } from "./table-model";
import { buildEchartsOption } from "./table-to-chart-utils";
import { logger } from "./logger";

/**
 * 执行“一键数据图表化”：读取表格数据 → 弹出配置 Dialog → 生成 ECharts 块并插入下方
 */
export async function executeTableToChart(te: TableEditor): Promise<void> {
  try {
    // 1. 重新加载最新表格数据
    await te.ctx.reload();

    const lineCount = te.ctx.getLineCount();
    if (lineCount <= 2) {
      showMessage(te.i18n.errChartRowNotEnough || "表格数据行不足，无法生成图表", 3000, "info");
      return;
    }

    // 2. 提取 Headers 和真实数据行
    const rawHeaders = te.ctx.getRowCellsAt(0);
    // 处理空表头，进行默认填充
    const headers = rawHeaders.map((h, i) => h.trim() || `${te.i18n.column || "列"} ${i + 1}`);

    const dataRows: string[][] = [];
    for (let i = 2; i < lineCount; i++) {
      const line = te.ctx.getLineAt(i);
      if (line && !isSeparatorLine(line)) {
        dataRows.push(te.ctx.getRowCellsAt(i));
      }
    }

    if (dataRows.length === 0) {
      showMessage(te.i18n.errChartNoDataRows || "表格中未找到有效的数据行", 3000, "info");
      return;
    }

    // 3. 弹出配置 Dialog
    showChartConfigDialog(te.ctx.blockId, headers, dataRows, te.i18n);
  } catch (err) {
    logger.error("[siyuan-table-mater] executeTableToChart failed:", err);
    showMessage(te.i18n.errChartReadFailed || "读取表格数据失败", 3000, "error");
  }
}

/**
 * 弹出图表配置对话框
 */
function showChartConfigDialog(
  tableBlockId: string,
  headers: string[],
  dataRows: string[][],
  i18n: any
): void {
  const isEn = i18n.cancel === "Cancel";
  const getMsg = (zh: string, en: string) => isEn ? en : zh;

  const dialog = new Dialog({
    title: i18n.chartTitle || "一键数据图表化 (Table to Chart)",
    content: `
      <div class="b3-dialog__content at-dialog-content-flex">
        <div class="at-dialog-form-group">
          <label>${i18n.chartTitleLabel || "图表标题"}</label>
          <input type="text" id="at-chart-title" class="b3-text-field" placeholder="${i18n.chartTitlePlaceholder || "输入图表标题..."}" style="width: 100%; box-sizing: border-box;" />
        </div>

        <div class="at-dialog-form-row">
          <div class="at-form-field">
            <label>${i18n.chartTypeLabel || "图表类型"}</label>
            <select id="at-chart-type" class="b3-select" style="width: 100%;">
              <option value="bar">${i18n.chartTypeBar || "柱状图 (Bar Chart)"}</option>
              <option value="line">${i18n.chartTypeLine || "折线图 (Line Chart)"}</option>
              <option value="pie">${i18n.chartTypePie || "饼图 (Pie Chart)"}</option>
            </select>
          </div>

          <div class="at-form-field">
            <label>${i18n.chartXColLabel || "X 轴 (类目/时间)"}</label>
            <select id="at-chart-x-col" class="b3-select" style="width: 100%;">
              ${headers.map((h, idx) => `<option value="${idx}">${h}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="at-dialog-form-group">
          <label id="at-chart-y-label">${i18n.chartYColLabelMulti || "Y 轴 (数值) - 支持多选"}</label>
          <div id="at-chart-y-cols-container" class="at-table-preview-container at-dialog-list">
            ${headers.map((h, idx) => `
              <label class="at-dialog-radio-label">
                <input type="checkbox" class="b3-checkbox" name="at-chart-y-col" value="${idx}" />
                <span>${h}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <details class="at-chart-preview-details">
          <summary>${i18n.chartJsonPreview || "生成的 ECharts JSON 配置预览"}</summary>
          <pre id="at-chart-json-preview" class="at-chart-preview-pre"></pre>
        </details>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-chart-cancel">${i18n.cancel || "取消"}</button>
        <button class="b3-button b3-button--text" id="at-chart-confirm">${i18n.confirmGenerate || "确认生成"}</button>
      </div>
    `,
    width: "520px",
  });

  const titleInput = dialog.element.querySelector("#at-chart-title") as HTMLInputElement;
  const typeSelect = dialog.element.querySelector("#at-chart-type") as HTMLSelectElement;
  const xColSelect = dialog.element.querySelector("#at-chart-x-col") as HTMLSelectElement;
  const yLabel = dialog.element.querySelector("#at-chart-y-label") as HTMLLabelElement;
  const yCbs = dialog.element.querySelectorAll("input[name='at-chart-y-col']") as NodeListOf<HTMLInputElement>;
  const previewPre = dialog.element.querySelector("#at-chart-json-preview") as HTMLPreElement;

  // 默认勾选第一个 Y 轴（如果是 X 轴的下一列，体验更好）
  if (yCbs.length > 1) {
    yCbs[1].checked = true;
  } else if (yCbs.length > 0) {
    yCbs[0].checked = true;
  }

  // ── 选项限制与联动 ──

  const getSelectedYIndexes = (): number[] => {
    const indexes: number[] = [];
    yCbs.forEach(cb => {
      if (cb.checked) {
        indexes.push(parseInt(cb.value));
      }
    });
    return indexes;
  };

  const updatePreview = () => {
    const title = titleInput.value || getMsg("数据图表", "Data Chart");
    const type = typeSelect.value as "bar" | "line" | "pie";
    const xIdx = parseInt(xColSelect.value);
    const yIdxs = getSelectedYIndexes();

    if (yIdxs.length === 0) {
      previewPre.innerText = `{\n  // ${i18n.errChartSelectY || "请勾选至少一个 Y 轴数值列"}\n}`;
      return;
    }

    const option = buildEchartsOption({
      title,
      type,
      xColumnIndex: xIdx,
      yColumnIndexes: yIdxs,
      headers,
      rows: dataRows
    });

    previewPre.innerText = JSON.stringify(option, null, 2);
  };

  // 监听输入和变化
  titleInput.addEventListener("input", updatePreview);
  xColSelect.addEventListener("change", updatePreview);

  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;
    if (type === "pie") {
      yLabel.innerText = i18n.chartYColLabelSingle || "Y 轴 (数值) - 饼图模式只支持单选";
      // 饼图只留选中的第一个，其他取消
      const selected = getSelectedYIndexes();
      if (selected.length > 1) {
        let kept = false;
        yCbs.forEach(cb => {
          if (cb.checked) {
            if (!kept) {
              kept = true;
            } else {
              cb.checked = false;
            }
          }
        });
      }
    } else {
      yLabel.innerText = i18n.chartYColLabelMulti || "Y 轴 (数值) - 支持多选";
    }
    updatePreview();
  });

  yCbs.forEach(cb => {
    cb.addEventListener("change", (e) => {
      const type = typeSelect.value;
      if (type === "pie" && (e.target as HTMLInputElement).checked) {
        // 如果是饼图，强制单选：除了当前选中的，其他都取消勾选
        yCbs.forEach(other => {
          if (other !== e.target) {
            other.checked = false;
          }
        });
      }
      updatePreview();
    });
  });

  // 首次运行更新预览
  updatePreview();

  // ── 取消与确认 ──

  dialog.element.querySelector("#at-chart-cancel")?.addEventListener("click", () => {
    dialog.destroy();
  });

  dialog.element.querySelector("#at-chart-confirm")?.addEventListener("click", async () => {
    const title = titleInput.value || getMsg("数据图表", "Data Chart");
    const type = typeSelect.value as "bar" | "line" | "pie";
    const xIdx = parseInt(xColSelect.value);
    const yIdxs = getSelectedYIndexes();

    if (yIdxs.length === 0) {
      showMessage(i18n.errChartSelectY || "请至少勾选一个 Y 轴数值列", 3000, "info");
      return;
    }

    dialog.destroy();

    const option = buildEchartsOption({
      title,
      type,
      xColumnIndex: xIdx,
      yColumnIndexes: yIdxs,
      headers,
      rows: dataRows
    });

    const echartsKramdown = `\`\`\`echarts\n${JSON.stringify(option, null, 2)}\n\`\`\``;

    try {
      const res = await fetchSyncPost("/api/block/insertBlock", {
        dataType: "markdown",
        data: echartsKramdown,
        previousID: tableBlockId,
      });

      if (res && res.code === 0) {
        // 图表生成成功，静默插入
      } else {
        logger.error("[siyuan-table-mater] insertBlock error:", res);
        showMessage(i18n.errChartInsertFailed, 3000, "error");
      }
    } catch (err) {
      logger.error("[siyuan-table-mater] insertBlock failed:", err);
      showMessage(i18n.errOperationFailed || "生成图表失败", 3000, "error");
    }
  });
}

