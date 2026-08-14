import { describe, it, expect } from "vitest";
import { QuickCalc } from "../src/quick-calc";

describe("QuickCalc parsing & formatting", () => {
  const pluginFake = {
    settings: { enableQuickCalc: true },
    i18n: {}
  } as any;
  const quickCalc = new QuickCalc(pluginFake);

  describe("parseNumber", () => {
    const parse = (text: string) => (quickCalc as any).parseNumber(text);

    it("解析纯数字", () => {
      expect(parse("123")).toEqual({ value: 123, hasPercent: false, hasComma: false });
      expect(parse("  456.78  ")).toEqual({ value: 456.78, hasPercent: false, hasComma: false });
    });

    it("解析带千分位逗号的数字", () => {
      expect(parse("1,234.56")).toEqual({ value: 1234.56, hasPercent: false, hasComma: true });
      expect(parse("1,234,567")).toEqual({ value: 1234567, hasPercent: false, hasComma: true });
    });

    it("解析百分数", () => {
      expect(parse("12.5%")).toEqual({ value: 0.125, hasPercent: true, hasComma: false });
      expect(parse("0.5%")).toEqual({ value: 0.005, hasPercent: true, hasComma: false });
    });

    it("解析带千分位和百分号的数字", () => {
      expect(parse("1,200%")).toEqual({ value: 12, hasPercent: true, hasComma: true });
    });

    it("解析非法字符串返回 null", () => {
      expect(parse("abc")).toBeNull();
      expect(parse("1.2.3")).toBeNull();
      expect(parse("")).toBeNull();
    });
    it("解析负数与浮点数", () => {
      expect(parse("-123.45")).toEqual({ value: -123.45, hasPercent: false, hasComma: false });
      expect(parse("-1,234.50")).toEqual({ value: -1234.5, hasPercent: false, hasComma: true });
      expect(parse("-5%")).toEqual({ value: -0.05, hasPercent: true, hasComma: false });
    });

    it("解析零", () => {
      expect(parse("0")).toEqual({ value: 0, hasPercent: false, hasComma: false });
      expect(parse("0.0")).toEqual({ value: 0, hasPercent: false, hasComma: false });
      expect(parse("0%")).toEqual({ value: 0, hasPercent: true, hasComma: false });
    });
  });

  describe("formatResult", () => {
    const format = (value: number, allPercent: boolean, anyComma: boolean) =>
      (quickCalc as any).formatResult(value, allPercent, anyComma);

    it("格式化百分比", () => {
      expect(format(0.225, true, false)).toBe("22.5%");
      expect(format(0.123456, true, false)).toBe("12.3456%");
    });

    it("格式化千分位", () => {
      expect(format(1234.56, false, true)).toBe("1,234.56");
      expect(format(1234567, false, true)).toBe("1,234,567");
    });

    it("格式化百分比加千分位", () => {
      expect(format(12.5, true, true)).toBe("1,250%");
    });

    it("常规数字格式化最多保留四位小数且去除尾部多余0", () => {
      expect(format(12.3, false, false)).toBe("12.3");
      expect(format(12.34567, false, false)).toBe("12.3457");
      expect(format(12.0000, false, false)).toBe("12");
      expect(format(-12.5, false, false)).toBe("-12.5");
    });
  });

  describe("updateStats & DOM selection", () => {
    it("正确计算包含 IAL 的单元格文本", () => {
      const parse = (text: string) => {
        const pureText = text.replace(/\{:[^}]+\}/g, "").trim();
        return (quickCalc as any).parseNumber(pureText);
      };
      expect(parse("5,000{: colspan=\"1\"}")).toEqual({
        value: 5000,
        hasPercent: false,
        hasComma: true
      });
      expect(parse("8,000")).toEqual({
        value: 8000,
        hasPercent: false,
        hasComma: true
      });
    });
  });
});
