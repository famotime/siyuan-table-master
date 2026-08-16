import { describe, it, expect } from "vitest";
import {
  TABLE_THEMES,
  applyTableThemeToMatrix,
  FormatPainter,
} from "../src/html-table-styles";
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

describe("html-table-styles", () => {
  describe("theme configs", () => {
    it("should define all 6 table themes", () => {
      expect(TABLE_THEMES["business-blue"]).toBeDefined();
      expect(TABLE_THEMES["mint-green"]).toBeDefined();
      expect(TABLE_THEMES["minimal-gray"]).toBeDefined();
      expect(TABLE_THEMES["modern-dark"]).toBeDefined();
      expect(TABLE_THEMES["grid-frame"]).toBeDefined();
      expect(TABLE_THEMES["clean-stripeless"]).toBeDefined();
    });
  });

  describe("applyTableThemeToMatrix", () => {
    it("should apply business-blue theme with header and alternating zebra rows", () => {
      const m = makeSampleMatrix(4, 2);
      applyTableThemeToMatrix(m, "business-blue", true, false);

      // Header row
      expect(m[0][0].style.bg).toBe(TABLE_THEMES["business-blue"].headerBg);
      expect(m[0][0].style.color).toBe(TABLE_THEMES["business-blue"].headerColor);

      // Row 1 (first data row - odd)
      expect(m[1][0].style.bg).toBe(TABLE_THEMES["business-blue"].oddRowBg);

      // Row 2 (second data row - even zebra)
      expect(m[2][0].style.bg).toBe(TABLE_THEMES["business-blue"].evenRowBg);
    });

    it("should apply total row styling when hasTotal is true", () => {
      const m = makeSampleMatrix(4, 2);
      applyTableThemeToMatrix(m, "mint-green", true, true);

      // Header row
      expect(m[0][0].style.bg).toBe(TABLE_THEMES["mint-green"].headerBg);

      // Total row (last row)
      expect(m[3][0].style.bg).toBe(TABLE_THEMES["mint-green"].totalRowBg);
      expect(m[3][0].style.color).toBe(TABLE_THEMES["mint-green"].totalRowColor);
    });

    it("should switch text color to white for modern-dark and back to dark for other themes", () => {
      const m = makeSampleMatrix(3, 2);

      // 1. Switch to modern-dark
      applyTableThemeToMatrix(m, "modern-dark", true, false);
      expect(m[1][0].style.color).toBe("#F9FAFB");
      expect(m[2][0].style.color).toBe("#F9FAFB");

      // 2. Switch to business-blue -> text color should be restored to #1F2937
      applyTableThemeToMatrix(m, "business-blue", true, false);
      expect(m[1][0].style.color).toBe("#1F2937");
      expect(m[2][0].style.color).toBe("#1F2937");

      // 3. Switch to minimal-gray -> text color should be #111827
      applyTableThemeToMatrix(m, "minimal-gray", true, false);
      expect(m[1][0].style.color).toBe("#111827");
      expect(m[2][0].style.color).toBe("#111827");
    });

    it("should preserve custom non-default cell background and text colors when switching themes", () => {
      const m = makeSampleMatrix(3, 2);

      // Set custom highlight on cell (1, 1)
      m[1][1].style.bg = "#EF4444"; // custom red background
      m[1][1].style.color = "#F59E0B"; // custom orange text

      // 1. Switch to modern-dark
      applyTableThemeToMatrix(m, "modern-dark", true, false);
      // Default cell (1, 0) should take modern-dark theme styles
      expect(m[1][0].style.bg).toBe(TABLE_THEMES["modern-dark"].oddRowBg);
      expect(m[1][0].style.color).toBe(TABLE_THEMES["modern-dark"].dataRowColor);
      // Custom cell (1, 1) should preserve custom colors
      expect(m[1][1].style.bg).toBe("#EF4444");
      expect(m[1][1].style.color).toBe("#F59E0B");

      // 2. Switch to mint-green
      applyTableThemeToMatrix(m, "mint-green", true, false);
      // Default cell (1, 0) should take mint-green theme styles
      expect(m[1][0].style.bg).toBe(TABLE_THEMES["mint-green"].oddRowBg);
      expect(m[1][0].style.color).toBe(TABLE_THEMES["mint-green"].dataRowColor);
      // Custom cell (1, 1) should still preserve custom colors
      expect(m[1][1].style.bg).toBe("#EF4444");
      expect(m[1][1].style.color).toBe("#F59E0B");
    });
  });

  describe("FormatPainter", () => {
    it("should sample and apply cell styles", () => {
      const painter = new FormatPainter();
      expect(painter.active()).toBe(false);

      const srcCell = createCell(0, 0, {
        style: {
          bg: "#4472C4",
          color: "#FFFFFF",
          fs: 16,
          alignH: "align-h-center",
        },
      });

      painter.sample(srcCell.style);
      expect(painter.active()).toBe(true);

      const dstCell = createCell(1, 1, { content: "Target" });
      painter.applyTo(dstCell);

      expect(dstCell.style.bg).toBe("#4472C4");
      expect(dstCell.style.color).toBe("#FFFFFF");
      expect(dstCell.style.fs).toBe(16);
      expect(dstCell.style.alignH).toBe("align-h-center");
      expect(dstCell.content).toBe("Target"); // Content unchanged

      painter.clear();
      expect(painter.active()).toBe(false);
    });
  });
});
