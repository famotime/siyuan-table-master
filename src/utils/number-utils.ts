/**
 * number-utils.ts - 数值解析与格式化纯函数工具
 *
 * 用于即时计算、表格汇总等场景中的千分位、百分比、货币及常规数值解析与格式化。
 * 纯同步、无副作用，方便单元测试。
 */

export interface ParsedNumber {
  value: number;
  hasPercent: boolean;
  hasComma: boolean;
}

/**
 * 解析单元格中的数值字符串（支持纯数字、千分位逗号、百分比）
 */
export function parseNumber(text: string): ParsedNumber | null {
  let cleanText = text.trim();
  if (cleanText === "") return null;

  let hasPercent = false;
  if (cleanText.endsWith("%")) {
    hasPercent = true;
    cleanText = cleanText.slice(0, -1).trim();
  }

  let hasComma = false;
  if (cleanText.includes(",")) {
    hasComma = true;
    cleanText = cleanText.replace(/,/g, "");
  }

  const num = Number(cleanText);
  if (isNaN(num)) return null;

  return {
    value: hasPercent ? num / 100 : num,
    hasPercent,
    hasComma,
  };
}

/**
 * 格式化计算结果（支持百分比、千分位、最多保留 4 位小数并去除尾部多余 0）
 */
export function formatResult(value: number, allPercent: boolean, anyComma: boolean): string {
  if (allPercent) {
    const valPercent = Number((value * 100).toFixed(4));
    if (anyComma) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(valPercent) + "%";
    }
    return valPercent.toString() + "%";
  }

  if (anyComma) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
  }

  return Number(value.toFixed(4)).toString();
}
