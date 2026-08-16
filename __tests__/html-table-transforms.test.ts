import { describe, it, expect } from "vitest";
import {
  transposeMatrix,
  splitMatrix,
  duplicateRowAt,
  duplicateColAt,
  distributeColWidths,
  sortMatrixByCol,
  hasMergedCells,
  buildVisualGrid,
  parseSortKey,
} from "../src/html-table-transforms";
import { createCell, CellData } from "../src/html-dialog-utils";

function makeSampleMatrix(rows: number, cols: number): CellData[][] {
  const matrix: CellData[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(createCell(r, c, { content: `R${r}C${c}` }));
    }
    matrix.push(row);
  }
  return matrix;
}

describe("html-table-transforms", () => {
  describe("hasMergedCells", () => {
    it("should return false for regular 2x2 matrix", () => {
      const m = makeSampleMatrix(2, 2);
      expect(hasMergedCells(m)).toBe(false);
    });

    it("should return true when a cell has colSpan > 1", () => {
      const m = makeSampleMatrix(2, 2);
      m[0][0].colSpan = 2;
      expect(hasMergedCells(m)).toBe(true);
    });

    it("should return true when a cell has rowSpan > 1", () => {
      const m = makeSampleMatrix(2, 2);
      m[0][0].rowSpan = 2;
      expect(hasMergedCells(m)).toBe(true);
    });
  });

  describe("buildVisualGrid", () => {
    it("should build 2x2 grid for regular matrix", () => {
      const m = makeSampleMatrix(2, 2);
      const grid = buildVisualGrid(m);
      expect(grid.length).toBe(2);
      expect(grid[0].length).toBe(2);
      expect(grid[0][0]?.content).toBe("R0C0");
      expect(grid[1][1]?.content).toBe("R1C1");
    });

    it("should expand colSpan across grid columns", () => {
      const m: CellData[][] = [
        [createCell(0, 0, { content: "Header", colSpan: 2 })],
        [createCell(1, 0, { content: "A" }), createCell(1, 1, { content: "B" })],
      ];
      const grid = buildVisualGrid(m);
      expect(grid[0][0]?.content).toBe("Header");
      expect(grid[0][1]?.content).toBe("Header");
      expect(grid[1][0]?.content).toBe("A");
      expect(grid[1][1]?.content).toBe("B");
    });
  });

  describe("transposeMatrix", () => {
    it("should transpose a 2x3 matrix to 3x2", () => {
      const m = [
        [createCell(0, 0, { content: "A" }), createCell(0, 1, { content: "B" }), createCell(0, 2, { content: "C" })],
        [createCell(1, 0, { content: "1" }), createCell(1, 1, { content: "2" }), createCell(1, 2, { content: "3" })],
      ];
      const res = transposeMatrix(m);
      expect(res.success).toBe(true);
      expect(res.matrix?.length).toBe(3);
      expect(res.matrix?.[0].length).toBe(2);
      expect(res.matrix?.[0][0].content).toBe("A");
      expect(res.matrix?.[0][1].content).toBe("1");
      expect(res.matrix?.[1][0].content).toBe("B");
      expect(res.matrix?.[1][1].content).toBe("2");
      expect(res.matrix?.[2][0].content).toBe("C");
      expect(res.matrix?.[2][1].content).toBe("3");
    });

    it("should intercept and reject transposing tables with merged cells", () => {
      const m = makeSampleMatrix(2, 2);
      m[0][0].colSpan = 2;
      const res = transposeMatrix(m);
      expect(res.success).toBe(false);
      expect(res.error).toContain("合并单元格");
    });
  });

  describe("splitMatrix", () => {
    it("should split a 4-row matrix at row 2 into two 2-row matrices", () => {
      const m = makeSampleMatrix(4, 2);
      const res = splitMatrix(m, 2, false);
      expect(res.success).toBe(true);
      expect(res.top?.length).toBe(2);
      expect(res.bottom?.length).toBe(2);
      expect(res.top?.[0][0].content).toBe("R0C0");
      expect(res.bottom?.[0][0].content).toBe("R2C0");
    });

    it("should copy header to bottom matrix when copyHeader is true", () => {
      const m = makeSampleMatrix(4, 2);
      const res = splitMatrix(m, 2, true);
      expect(res.success).toBe(true);
      expect(res.top?.length).toBe(2);
      expect(res.bottom?.length).toBe(3); // 1 header + 2 data
      expect(res.bottom?.[0][0].content).toBe("R0C0");
      expect(res.bottom?.[1][0].content).toBe("R2C0");
    });

    it("should reject invalid split positions", () => {
      const m = makeSampleMatrix(3, 2);
      expect(splitMatrix(m, 0).success).toBe(false);
      expect(splitMatrix(m, 3).success).toBe(false);
    });
  });

  describe("duplicateRowAt & duplicateColAt", () => {
    it("should duplicate row at specified index", () => {
      const m = makeSampleMatrix(2, 2);
      const res = duplicateRowAt(m, 0);
      expect(res.length).toBe(3);
      expect(res[0][0].content).toBe("R0C0");
      expect(res[1][0].content).toBe("R0C0");
      expect(res[2][0].content).toBe("R1C0");
    });

    it("should duplicate col at specified index", () => {
      const m = makeSampleMatrix(2, 2);
      const res = duplicateColAt(m, 0);
      expect(res[0].length).toBe(3);
      expect(res[0][0].content).toBe("R0C0");
      expect(res[0][1].content).toBe("R0C0");
      expect(res[0][2].content).toBe("R0C1");
    });
  });

  describe("distributeColWidths", () => {
    it("should return equal percentages for columns", () => {
      const m = makeSampleMatrix(2, 4);
      const widths = distributeColWidths(m);
      expect(widths.length).toBe(4);
      expect(widths[0]).toBe("25.00%");
      expect(widths[3]).toBe("25.00%");
    });
  });

  describe("parseSortKey & sortMatrixByCol", () => {
    it("should parse number correctly", () => {
      expect(parseSortKey("100").val).toBe(100);
      expect(parseSortKey("¥ 1,234.50").val).toBe(1234.5);
      expect(parseSortKey("-15%").val).toBe(-0.15);
    });

    it("should parse date correctly", () => {
      const res = parseSortKey("2026-08-16");
      expect(res.type).toBe("date");
      expect(typeof res.val).toBe("number");
    });

    it("should sort rows by numeric column ascending and descending", () => {
      const m: CellData[][] = [
        [createCell(0, 0, { content: "Header" }), createCell(0, 1, { content: "Score" })],
        [createCell(1, 0, { content: "Alice" }), createCell(1, 1, { content: "85" })],
        [createCell(2, 0, { content: "Bob" }), createCell(2, 1, { content: "92" })],
        [createCell(3, 0, { content: "Charlie" }), createCell(3, 1, { content: "78" })],
      ];

      const asc = sortMatrixByCol(m, 1, true, true);
      expect(asc[1][0].content).toBe("Charlie"); // 78
      expect(asc[2][0].content).toBe("Alice"); // 85
      expect(asc[3][0].content).toBe("Bob"); // 92

      const desc = sortMatrixByCol(m, 1, false, true);
      expect(desc[1][0].content).toBe("Bob"); // 92
      expect(desc[2][0].content).toBe("Alice"); // 85
      expect(desc[3][0].content).toBe("Charlie"); // 78
    });

    it("should preserve total row at the bottom during sort", () => {
      const m: CellData[][] = [
        [createCell(0, 0, { content: "Item" }), createCell(0, 1, { content: "Cost" })],
        [createCell(1, 0, { content: "B" }), createCell(1, 1, { content: "20" })],
        [createCell(2, 0, { content: "A" }), createCell(2, 1, { content: "10" })],
        [createCell(3, 0, { content: "合计" }), createCell(3, 1, { content: "30" })],
      ];

      const sorted = sortMatrixByCol(m, 1, true, true);
      expect(sorted[1][0].content).toBe("A"); // 10
      expect(sorted[2][0].content).toBe("B"); // 20
      expect(sorted[3][0].content).toBe("合计"); // Total row preserved at bottom
    });
  });
});
