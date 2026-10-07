import { describe, it, expect } from "vitest";
import { setCellAt, getCellAt } from "../src/table-fill-utils";

describe("单元格 IAL 回写保留", () => {
  it("setCellAt 只改目标单元格，其余单元格 IAL 不丢失", () => {
    const lines = ['|{: colspan="1"}App|{: colspan="1"}B|', '|---|---|', '|{: colspan="1"}x|y|'];
    // domRow 1 -> lineIndex 2（第一条数据行）
    setCellAt(lines, 1, 1, "改后");
    expect(lines[2]).toBe('| {: colspan="1"}x | 改后 |');
  });
  it("getCellAt 取到的是清理后的内容", () => {
    const lines = ['|{: colspan="1"}A|{: colspan="1"}B|', '|---|---|', '|{: colspan="1"}x|{: colspan="1"}y|'];
    // domRow 0 -> 表头行 lineIndex 0
    expect(getCellAt(lines, 0, 0)).toBe("A");
    // domRow 1 -> 第一条数据行
    expect(getCellAt(lines, 1, 0)).toBe("x");
    expect(getCellAt(lines, 1, 1)).toBe("y");
  });
});
