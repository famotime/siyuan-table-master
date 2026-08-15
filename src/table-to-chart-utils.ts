/**
 * table-to-chart-utils.ts - 表格图表化纯函数工具
 *
 * 提供 ECharts Option JSON 构造、百分比列识别、双 Y 轴智能判定等纯函数。
 * 纯同步、无 DOM 及思源运行时依赖，便于单元测试。
 */

import { sanitizeValue } from "./text-to-table-utils";

export interface EchartsOptionConfig {
  title: string;
  type: "bar" | "line" | "pie";
  xColumnIndex: number;
  yColumnIndexes: number[];
  headers: string[];
  rows: string[][];
}

/**
 * 检查某列是否主要由百分比数据组成（非空单元格中超过 50% 以 % 结尾）
 */
export function isPercentCol(colIdx: number, rows: string[][]): boolean {
  const nonMockRows = rows.filter(row => row[colIdx] && row[colIdx].trim() !== "");
  if (nonMockRows.length === 0) return false;
  let percentCount = 0;
  for (const row of nonMockRows) {
    if (row[colIdx].trim().endsWith("%")) {
      percentCount++;
    }
  }
  return percentCount / nonMockRows.length >= 0.5;
}

/**
 * 构造 ECharts Option JSON 对象
 */
export function buildEchartsOption(config: EchartsOptionConfig): any {
  const xData = config.rows.map(row => row[config.xColumnIndex]?.trim() || "");

  // 1. 收集各 Y 轴列的统计特征：最大值与是否为百分比
  const colStats = config.yColumnIndexes.map(idx => {
    const vals = config.rows.map(row => sanitizeValue(row[idx]));
    const maxVal = Math.max(...vals, 0);
    const isPercent = isPercentCol(idx, config.rows);
    return {
      index: idx,
      maxVal,
      isPercent,
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
  const allYArePercent = config.yColumnIndexes.length > 0 && config.yColumnIndexes.every(idx => isPercentCol(idx, config.rows));

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
      data: config.yColumnIndexes.map(idx => config.headers[idx]),
    },
    // 保留透明背景，确保完美跟随思源的深浅色主题
    backgroundColor: "transparent",
  };

  if (config.type === "pie") {
    // 饼图：取第一个 Y 轴列
    const yIdx = config.yColumnIndexes[0] ?? 0;
    const seriesData = config.rows.map((row, rIdx) => ({
      name: xData[rIdx] || `数据 ${rIdx + 1}`,
      value: sanitizeValue(row[yIdx]),
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
          shadowColor: "rgba(0, 0, 0, 0.5)",
        },
      },
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
          name: leftIsAllPercent ? "百分比" : (rightIsAllPercent ? "数值" : undefined),
          axisLabel: leftIsAllPercent ? { formatter: "{value}%" } : undefined,
        },
        {
          type: "value",
          name: rightIsAllPercent ? "百分比" : (leftIsAllPercent ? "数值" : undefined),
          axisLabel: rightIsAllPercent ? { formatter: "{value}%" } : undefined,
          splitLine: { show: false }, // 隐藏右轴网格分割线以防视觉混乱
        },
      ];
    } else {
      option.yAxis = {
        type: "value",
      };
      if (allYArePercent) {
        option.yAxis.axisLabel = {
          formatter: "{value}%",
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
