import { describe, it, expect } from "vitest";
import { sumCells } from "../src/table-editor";

describe("sumCells 千分位数字求和", () => {
  it("解析普通数字求和", () => {
    const res = sumCells(["100", "200", "300"]);
    expect(res.sum).toBe(600);
    expect(res.formattedSum).toBe("600");
    expect(res.skipped).toEqual([]);
  });

  it("解析带千分位的数字求和，结果保留千分位格式", () => {
    const res = sumCells(["4,500", "32,348"]);
    expect(res.sum).toBe(36848);
    expect(res.formattedSum).toBe("36,848");
    expect(res.skipped).toEqual([]);
  });

  it("混合千分位与普通数字求和，结果使用千分位格式", () => {
    const res = sumCells(["4,500", "500"]);
    expect(res.sum).toBe(5000);
    expect(res.formattedSum).toBe("5,000");
    expect(res.skipped).toEqual([]);
  });

  it("支持带小数点的千分位数字求和", () => {
    const res = sumCells(["1,234.50", "2,345.25"]);
    expect(res.sum).toBe(3579.75);
    expect(res.formattedSum).toBe("3,579.75");
    expect(res.skipped).toEqual([]);
  });

  it("支持负数及带千分位的负数求和", () => {
    const res = sumCells(["-1,500", "500"]);
    expect(res.sum).toBe(-1000);
    expect(res.formattedSum).toBe("-1,000");
    expect(res.skipped).toEqual([]);
  });

  it("忽略空字符串并跳过非数字内容", () => {
    const res = sumCells(["4,500", "", "  ", "abc", "32,348"]);
    expect(res.sum).toBe(36848);
    expect(res.formattedSum).toBe("36,848");
    expect(res.skipped).toEqual(["abc"]);
  });

  it("处理带 思源 IAL 标签的文本", () => {
    const res = sumCells(["4,500{: colspan=\"1\"}", "1,000"]);
    expect(res.sum).toBe(5500);
    expect(res.formattedSum).toBe("5,500");
    expect(res.skipped).toEqual([]);
  });
});
