import { describe, it, expect } from "vitest";
import { buildEchartsOption, isPercentCol } from "../src/table-to-chart-utils";

describe("table-to-chart-utils", () => {
  const headers = ["月份", "收入", "利润率", "支出"];
  const rows = [
    ["1月", "10000", "20%", "8000"],
    ["2月", "12000", "25%", "9000"],
    ["3月", "15000", "30%", "10500"],
  ];

  describe("isPercentCol", () => {
    it("正确识别主要由百分比构成的列", () => {
      expect(isPercentCol(2, rows)).toBe(true);
    });

    it("正确识别普通数值列", () => {
      expect(isPercentCol(1, rows)).toBe(false);
      expect(isPercentCol(3, rows)).toBe(false);
    });

    it("空列或非百分比列返回 false", () => {
      expect(isPercentCol(0, rows)).toBe(false);
      expect(isPercentCol(1, [])).toBe(false);
    });
  });

  describe("buildEchartsOption - 柱状图与折线图", () => {
    it("生成单 Y 轴柱状图 Option", () => {
      const option = buildEchartsOption({
        title: "月度收支",
        type: "bar",
        xColumnIndex: 0,
        yColumnIndexes: [1, 3],
        headers,
        rows,
      });

      expect(option.title.text).toBe("月度收支");
      expect(option.backgroundColor).toBe("transparent");
      expect(option.tooltip.trigger).toBe("axis");
      expect(option.yAxis.type).toBe("value");
      expect(option.series).toHaveLength(2);
      expect(option.series[0].name).toBe("收入");
      expect(option.series[0].type).toBe("bar");
      expect(option.series[0].data).toEqual([10000, 12000, 15000]);
      expect(option.series[1].name).toBe("支出");
      expect(option.series[1].type).toBe("bar");
      expect(option.series[1].data).toEqual([8000, 9000, 10500]);
    });

    it("生成折线图 Option", () => {
      const option = buildEchartsOption({
        title: "月度收入趋势",
        type: "line",
        xColumnIndex: 0,
        yColumnIndexes: [1],
        headers,
        rows,
      });

      expect(option.tooltip.trigger).toBe("axis");
      expect(option.series[0].type).toBe("line");
      expect(option.series[0].smooth).toBe(true);
    });

    it("混合量纲（常规数值 + 百分比）时自动启用双 Y 轴", () => {
      const option = buildEchartsOption({
        title: "收入与利润率",
        type: "bar",
        xColumnIndex: 0,
        yColumnIndexes: [1, 2], // 1=收入(数值), 2=利润率(百分比)
        headers,
        rows,
      });

      expect(option.yAxis).toHaveLength(2);
      expect(option.yAxis[0].name).toBe("数值");
      expect(option.yAxis[1].name).toBe("百分比");
      expect(option.yAxis[1].axisLabel.formatter).toBe("{value}%");

      // 收入走左轴 (0)，利润率走右轴 (1)
      expect(option.series[0].yAxisIndex).toBe(0);
      expect(option.series[1].yAxisIndex).toBe(1);
      expect(option.series[1].data).toEqual([20, 25, 30]);
    });

    it("同一量纲但极差大于等于 10 倍时自动启用双 Y 轴", () => {
      const diffRows = [
        ["A", "10000", "50"],
        ["B", "15000", "80"],
      ];
      const diffHeaders = ["类别", "大指标", "小指标"];

      const option = buildEchartsOption({
        title: "量纲差异测试",
        type: "bar",
        xColumnIndex: 0,
        yColumnIndexes: [1, 2],
        headers: diffHeaders,
        rows: diffRows,
      });

      expect(option.yAxis).toHaveLength(2);
      expect(option.series[0].yAxisIndex).toBe(0); // 大指标
      expect(option.series[1].yAxisIndex).toBe(1); // 小指标 (< 10% globalMax)
    });
  });

  describe("buildEchartsOption - 饼图", () => {
    it("生成饼图 Option", () => {
      const option = buildEchartsOption({
        title: "收入占比",
        type: "pie",
        xColumnIndex: 0,
        yColumnIndexes: [1],
        headers,
        rows,
      });

      expect(option.tooltip.trigger).toBe("item");
      expect(option.series).toHaveLength(1);
      expect(option.series[0].type).toBe("pie");
      expect(option.series[0].data).toEqual([
        { name: "1月", value: 10000 },
        { name: "2月", value: 12000 },
        { name: "3月", value: 15000 },
      ]);
    });
  });
});
