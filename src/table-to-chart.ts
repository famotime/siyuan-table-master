import { Dialog, showMessage, fetchSyncPost } from "siyuan";
import { TableEditor } from "./table-editor";
import { isSeparatorLine } from "./table-model";
import { sanitizeValue } from "./text-to-table-utils";

/**
 * 执行“一键数据图表化”：读取表格数据 → 弹出配置 Dialog → 生成 ECharts 块并插入下方
 */
export async function executeTableToChart(te: TableEditor): Promise<void> {
  try {
    // 1. 重新加载最新表格数据
    await te.ctx.reload();

    const lineCount = te.ctx.getLineCount();
    if (lineCount <= 2) {
      showMessage("表格数据行不足，无法生成图表", 3000, "info");
      return;
    }

    // 2. 提取 Headers 和真实数据行
    const rawHeaders = te.ctx.getRowCellsAt(0);
    // 处理空表头，进行默认填充
    const headers = rawHeaders.map((h, i) => h.trim() || `列 ${i + 1}`);

    const dataRows: string[][] = [];
    for (let i = 2; i < lineCount; i++) {
      const line = te.ctx.getLineAt(i);
      if (line && !isSeparatorLine(line)) {
        dataRows.push(te.ctx.getRowCellsAt(i));
      }
    }

    if (dataRows.length === 0) {
      showMessage("表格中未找到有效的数据行", 3000, "info");
      return;
    }

    // 3. 弹出配置 Dialog
    showChartConfigDialog(te.ctx.blockId, headers, dataRows);
  } catch (err) {
    console.error("[siyuan-table-mater] executeTableToChart failed:", err);
    showMessage("读取表格数据失败", 3000, "error");
  }
}

/**
 * 弹出图表配置对话框
 */
function showChartConfigDialog(
  tableBlockId: string,
  headers: string[],
  dataRows: string[][]
): void {
  const dialog = new Dialog({
    title: "一键数据图表化 (Table to Chart)",
    content: `
      <div class="b3-dialog__content" style="padding: 16px 24px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 13px; font-weight: 600; color: var(--b3-theme-on-background);">图表标题</label>
          <input type="text" id="at-chart-title" class="b3-text-field" placeholder="输入图表标题..." style="width: 100%; box-sizing: border-box;" />
        </div>

        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--b3-theme-on-background);">图表类型</label>
            <select id="at-chart-type" class="b3-select" style="width: 100%;">
              <option value="bar">柱状图 (Bar Chart)</option>
              <option value="line">折线图 (Line Chart)</option>
              <option value="pie">饼图 (Pie Chart)</option>
            </select>
          </div>

          <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--b3-theme-on-background);">X 轴 (类目/时间)</label>
            <select id="at-chart-x-col" class="b3-select" style="width: 100%;">
              ${headers.map((h, idx) => `<option value="${idx}">${h}</option>`).join("")}
            </select>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label id="at-chart-y-label" style="font-size: 13px; font-weight: 600; color: var(--b3-theme-on-background);">Y 轴 (数值) - 支持多选</label>
          <div id="at-chart-y-cols-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; border: 1px solid var(--b3-border-color); border-radius: 4px; padding: 8px; background-color: var(--b3-theme-background-surface, rgba(0,0,0,0.02));">
            ${headers.map((h, idx) => `
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--b3-theme-on-surface);">
                <input type="checkbox" class="b3-checkbox" name="at-chart-y-col" value="${idx}" />
                <span>${h}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <details style="border: 1px solid var(--b3-border-color); border-radius: 6px; padding: 8px 12px; background-color: var(--b3-theme-background-surface, rgba(0,0,0,0.02));">
          <summary style="font-size: 13px; font-weight: 600; cursor: pointer; color: var(--b3-theme-on-background); user-select: none; outline: none;">生成的 ECharts JSON 配置预览</summary>
          <pre id="at-chart-json-preview" style="margin: 8px 0 0; padding: 10px; background-color: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 6px; font-family: monospace; font-size: 11px; max-height: 120px; overflow-y: auto; color: var(--b3-theme-primary); white-space: pre-wrap; word-break: break-all;"></pre>
        </details>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="at-chart-cancel">取消</button>
        <button class="b3-button b3-button--text" id="at-chart-confirm">确认生成</button>
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
    const title = titleInput.value || "数据图表";
    const type = typeSelect.value as "bar" | "line" | "pie";
    const xIdx = parseInt(xColSelect.value);
    const yIdxs = getSelectedYIndexes();

    if (yIdxs.length === 0) {
      previewPre.innerText = "{\n  // 请勾选至少一个 Y 轴数值列\n}";
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
      yLabel.innerText = "Y 轴 (数值) - 饼图仅支持单选";
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
      yLabel.innerText = "Y 轴 (数值) - 支持多选";
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
    const title = titleInput.value || "数据图表";
    const type = typeSelect.value as "bar" | "line" | "pie";
    const xIdx = parseInt(xColSelect.value);
    const yIdxs = getSelectedYIndexes();

    if (yIdxs.length === 0) {
      showMessage("请至少勾选一个 Y 轴数值列", 3000, "info");
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
        showMessage("图表生成成功，已插入表格下方", 2000);
      } else {
        console.error("[siyuan-table-mater] insertBlock error:", res);
        showMessage("图表块插入失败", 3000, "error");
      }
    } catch (err) {
      console.error("[siyuan-table-mater] insertBlock failed:", err);
      showMessage("生成图表失败", 3000, "error");
    }
  });
}

/**
 * 构造 ECharts Option JSON 对象
 */
function buildEchartsOption(config: {
  title: string;
  type: "bar" | "line" | "pie";
  xColumnIndex: number;
  yColumnIndexes: number[];
  headers: string[];
  rows: string[][];
}): any {
  const xData = config.rows.map(row => row[config.xColumnIndex]?.trim() || "");

  // 检查某列是否主要由百分比数据组成
  const isPercentCol = (colIdx: number): boolean => {
    const nonMockRows = config.rows.filter(row => row[colIdx] && row[colIdx].trim() !== "");
    if (nonMockRows.length === 0) return false;
    let percentCount = 0;
    for (const row of nonMockRows) {
      if (row[colIdx].trim().endsWith("%")) {
        percentCount++;
      }
    }
    return percentCount / nonMockRows.length >= 0.5;
  };

  // 1. 收集各 Y 轴列的统计特征：最大值与是否为百分比
  const colStats = config.yColumnIndexes.map(idx => {
    const vals = config.rows.map(row => sanitizeValue(row[idx]));
    const maxVal = Math.max(...vals, 0);
    const isPercent = isPercentCol(idx);
    return {
      index: idx,
      maxVal,
      isPercent
    };
  });

  // 2. 自动判定是否启用双 Y 轴及映射关系
  let useDualY = false;
  const colYAxisIndexes = new Map<number, number>(); // colIndex -> yAxisIndex (0=左, 1=右)

  const hasPercent = colStats.some(s => s.isPercent);
  const hasNonPercent = colStats.some(s => !s.isPercent);

  // 如果在非饼图场景下，包含折线图或柱状图
  if (config.type !== "pie") {
    if (hasPercent && hasNonPercent) {
      // 混合量纲：常规数值走左轴，百分比走右轴
      useDualY = true;
      colStats.forEach(s => {
        colYAxisIndexes.set(s.index, s.isPercent ? 1 : 0);
      });
    } else {
      // 同一量纲下：根据最大值的倍数差判断是否需要双轴 (差异大等于 10 倍)
      const validMaxVals = colStats.map(s => s.maxVal).filter(v => v > 0);
      if (validMaxVals.length > 1) {
        const globalMax = Math.max(...validMaxVals);
        const globalMin = Math.min(...validMaxVals);
        if (globalMax / globalMin >= 10) {
          useDualY = true;
          colStats.forEach(s => {
            // 凡是最大值低于全局最大值 10% 的，分配到右轴 (1)；其余分到左轴 (0)
            colYAxisIndexes.set(s.index, s.maxVal < globalMax * 0.1 ? 1 : 0);
          });
        }
      }
    }
  }

  // 兜底映射
  if (!useDualY) {
    config.yColumnIndexes.forEach(idx => colYAxisIndexes.set(idx, 0));
  }

  // 只有当所有勾选的 Y 轴数据列都是百分比时，才格式化 Y 轴刻度为百分比（单 Y 轴模式下使用）
  const allYArePercent = config.yColumnIndexes.length > 0 && config.yColumnIndexes.every(idx => isPercentCol(idx));

  const option: any = {
    title: {
      text: config.title,
      left: "center",
    },
    tooltip: {
      trigger: config.type === "pie" ? "item" : "axis",
    },
    legend: {
      orient: "horizontal",
      bottom: "bottom",
      data: config.yColumnIndexes.map(idx => config.headers[idx])
    },
    // 保留透明背景，确保完美跟随思源的深浅色主题
    backgroundColor: "transparent",
  };

  if (config.type === "pie") {
    // 饼图：取第一个 Y 轴列
    const yIdx = config.yColumnIndexes[0] ?? 0;
    const seriesData = config.rows.map((row, rIdx) => ({
      name: xData[rIdx] || `数据 ${rIdx + 1}`,
      value: sanitizeValue(row[yIdx])
    }));

    option.series = [{
      name: config.headers[yIdx] || "值",
      type: "pie",
      radius: "55%",
      center: ["50%", "50%"],
      data: seriesData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: "rgba(0, 0, 0, 0.5)"
        }
      }
    }];
  } else {
    // 柱状图或折线图
    option.xAxis = {
      type: "category",
      data: xData,
    };

    if (useDualY) {
      const leftCols = colStats.filter(s => colYAxisIndexes.get(s.index) === 0);
      const rightCols = colStats.filter(s => colYAxisIndexes.get(s.index) === 1);
      const leftIsAllPercent = leftCols.length > 0 && leftCols.every(s => s.isPercent);
      const rightIsAllPercent = rightCols.length > 0 && rightCols.every(s => s.isPercent);

      option.yAxis = [
        {
          type: "value",
          axisLabel: leftIsAllPercent ? { formatter: "{value}%" } : undefined
        },
        {
          type: "value",
          axisLabel: rightIsAllPercent ? { formatter: "{value}%" } : undefined,
          splitLine: { show: false } // 隐藏右轴网格分割线以防视觉混乱
        }
      ];
    } else {
      option.yAxis = {
        type: "value",
      };
      if (allYArePercent) {
        option.yAxis.axisLabel = {
          formatter: "{value}%"
        };
      }
    }

    option.series = config.yColumnIndexes.map(yIdx => {
      const seriesName = config.headers[yIdx];
      const seriesData = config.rows.map(row => sanitizeValue(row[yIdx]));
      const yAxisIdx = colYAxisIndexes.get(yIdx) ?? 0;
      return {
        name: seriesName,
        type: config.type,
        yAxisIndex: yAxisIdx,
        data: seriesData,
        // 如果是折线图，可以添加平滑效果，使其更加美观
        smooth: config.type === "line",
      };
    });
  }

  return option;
}
