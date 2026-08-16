import { describe, it, expect } from "vitest";
import {
  colLettersToIndex,
  indexToColLetters,
  parseCellRef,
  adjustRef,
  adjustExpr,
  FormulaAggregates,
  evaluateFormula,
  smartFillContent,
} from "../src/html-formula-engine";
import { createCell, CellData } from "../src/html-dialog-utils";

describe("html-formula-engine", () => {
  describe("coordinate conversions", () => {
    it("should convert column letters to index and back", () => {
      expect(colLettersToIndex("A")).toBe(0);
      expect(colLettersToIndex("Z")).toBe(25);
      expect(colLettersToIndex("AA")).toBe(26);

      expect(indexToColLetters(0)).toBe("A");
      expect(indexToColLetters(25)).toBe("Z");
      expect(indexToColLetters(26)).toBe("AA");
    });

    it("should parse cell references with and without $", () => {
      const r1 = parseCellRef("B3");
      expect(r1).toEqual({ raw: "B3", col: 1, row: 2, absCol: false, absRow: false });

      const r2 = parseCellRef("$C$5");
      expect(r2).toEqual({ raw: "$C$5", col: 2, row: 4, absCol: true, absRow: true });

      const r3 = parseCellRef("$A2");
      expect(r3).toEqual({ raw: "$A2", col: 0, row: 1, absCol: true, absRow: false });
    });

    it("should adjust relative refs and keep absolute refs unchanged", () => {
      expect(adjustRef("A1", 2, 1)).toBe("B3");
      expect(adjustRef("$A$1", 2, 1)).toBe("$A$1");
      expect(adjustRef("$A1", 2, 1)).toBe("$A3");
      expect(adjustRef("A$1", 2, 1)).toBe("B$1");
    });

    it("should adjust full formula expressions", () => {
      expect(adjustExpr("=A1+B1", 1, 0)).toBe("=A2+B2");
      expect(adjustExpr("=SUM($A$1:A5)*2", 1, 0)).toBe("=SUM($A$1:A6)*2");
    });
  });

  describe("aggregates", () => {
    const numbers = [10, 20, 30, 40, 50];

    it("should compute sum, average, count, min, max correctly", () => {
      expect(FormulaAggregates.sum(numbers)).toBe(150);
      expect(FormulaAggregates.average(numbers)).toBe(30);
      expect(FormulaAggregates.count(numbers)).toBe(5);
      expect(FormulaAggregates.min(numbers)).toBe(10);
      expect(FormulaAggregates.max(numbers)).toBe(50);
    });

    it("should compute median, variance, stdev, product correctly", () => {
      expect(FormulaAggregates.median(numbers)).toBe(30);
      expect(FormulaAggregates.median([10, 20, 30, 40])).toBe(25);
      expect(FormulaAggregates.variance([2, 4, 4, 4, 5, 5, 7, 9])).toBe(4);
      expect(FormulaAggregates.stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
      expect(FormulaAggregates.product([2, 3, 4])).toBe(24);
    });
  });

  describe("evaluateFormula", () => {
    const sampleMatrix: CellData[][] = [
      [createCell(0, 0, { content: "10" }), createCell(0, 1, { content: "20" }), createCell(0, 2, { content: "30" })],
      [createCell(1, 0, { content: "40" }), createCell(1, 1, { content: "50" }), createCell(1, 2, { content: "60" })],
      [createCell(2, 0, { content: "=A1+B1" }), createCell(2, 1, { content: "0" }), createCell(2, 2, { content: "" })],
    ];

    it("should evaluate basic arithmetic", () => {
      expect(evaluateFormula("=10+20*2", sampleMatrix).value).toBe(50);
      expect(evaluateFormula("=(10+20)*2", sampleMatrix).value).toBe(60);
      expect(evaluateFormula("=100/4-5", sampleMatrix).value).toBe(20);
    });

    it("should evaluate cell references", () => {
      expect(evaluateFormula("=A1+B1", sampleMatrix).value).toBe(30);
      expect(evaluateFormula("=C1*2", sampleMatrix).value).toBe(60);
    });

    it("should evaluate aggregate functions on ranges", () => {
      expect(evaluateFormula("=SUM(A1:C1)", sampleMatrix).value).toBe(60);
      expect(evaluateFormula("=AVERAGE(A1:C1)", sampleMatrix).value).toBe(20);
      expect(evaluateFormula("=MAX(A1:C2)", sampleMatrix).value).toBe(60);
    });

    it("should detect division by zero", () => {
      const res = evaluateFormula("=100/0", sampleMatrix);
      expect(res.error).toBe("#DIV/0!");
    });

    it("should detect formula cycles", () => {
      const cyclicMatrix: CellData[][] = [
        [createCell(0, 0, { content: "=B1+1" }), createCell(0, 1, { content: "=A1+1" })],
      ];
      const res = evaluateFormula("=A1", cyclicMatrix);
      expect(res.error).toBe("#CYCLE!");
    });
  });

  describe("smartFillContent", () => {
    it("should shift formula references downward", () => {
      expect(smartFillContent("=A1+B1", 1, 0, 1)).toBe("=A2+B2");
      expect(smartFillContent("=A1+B1", 1, 0, 3)).toBe("=A4+B4");
    });

    it("should auto-increment integers", () => {
      expect(smartFillContent("1", 1, 0, 1)).toBe("2");
      expect(smartFillContent("1", 1, 0, 4)).toBe("5");
    });

    it("should auto-increment numbered text labels", () => {
      expect(smartFillContent("第1期", 1, 0, 1)).toBe("第2期");
      expect(smartFillContent("Item 1", 1, 0, 2)).toBe("Item 3");
    });

    it("should preserve pure non-numeric text", () => {
      expect(smartFillContent("Hello", 1, 0, 1)).toBe("Hello");
    });
  });
});
