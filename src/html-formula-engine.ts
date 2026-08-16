/**
 * html-formula-engine.ts - HTML 表格公式计算引擎与智能填充
 *
 * 支持：
 * 1. 9 种聚合函数 (SUM, AVERAGE, COUNT, MAX, MIN, MEDIAN, VARIANCE, STDEV, PRODUCT)
 * 2. 单元格级表达式计算 (=A1+B1, =SUM(A1:A10), =AVERAGE(B:B), =MAX(2:2))
 * 3. 相对引用与绝对引用 ($A$1) 解析与智能重定基
 * 4. 智能填充 (Smart Fill) 算法（公式偏移自增、序号等差自增 1,2,3）
 * 5. DFS 三色标记拓扑循环引用检测与分类错误诊断 (#DIV/0!, #REF!, #VALUE!, #CYCLE!)
 */

import { CellData } from "./html-dialog-utils";
import { parseNumber } from "./utils/number-utils";

/**
 * 列名字母转 0 索引（如 "A" -> 0, "Z" -> 25, "AA" -> 26）
 */
export function colLettersToIndex(letters: string): number {
  let idx = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    idx = idx * 26 + (s.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * 0 索引转列名字母（如 0 -> "A", 25 -> "Z", 26 -> "AA"）
 */
export function indexToColLetters(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

export interface ParsedRef {
  raw: string;
  col: number;
  row: number;
  absCol: boolean;
  absRow: boolean;
}

/**
 * 解析单元格引用，例如 "A1" 或 "$B$2" 或 "C$4"
 */
export function parseCellRef(ref: string): ParsedRef | null {
  const m = ref.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
  if (!m) return null;
  const absCol = m[1] === "$";
  const col = colLettersToIndex(m[2]);
  const absRow = m[3] === "$";
  const row = parseInt(m[4], 10) - 1;
  return { raw: ref, col, row, absCol, absRow };
}

/**
 * 调整单个引用坐标的相对偏移
 */
export function adjustRef(ref: string, dRow: number, dCol: number): string {
  const parsed = parseCellRef(ref);
  if (!parsed) return ref;

  const newCol = parsed.absCol ? parsed.col : Math.max(0, parsed.col + dCol);
  const newRow = parsed.absRow ? parsed.row : Math.max(0, parsed.row + dRow);

  const colPart = (parsed.absCol ? "$" : "") + indexToColLetters(newCol);
  const rowPart = (parsed.absRow ? "$" : "") + (newRow + 1);
  return colPart + rowPart;
}

/**
 * 调整整个公式表达式中的相对单元格引用
 */
export function adjustExpr(expr: string, dRow: number, dCol: number): string {
  if (!expr.startsWith("=")) return expr;
  // 匹配所有单格引用与范围
  return expr.replace(/(\$?[A-Za-z]+\$?\d+)/g, (match) => {
    return adjustRef(match, dRow, dCol);
  });
}

/**
 * 9 种基础聚合计算函数
 */
export const FormulaAggregates = {
  sum(arr: number[]): number {
    return arr.reduce((acc, x) => acc + x, 0);
  },
  average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((acc, x) => acc + x, 0) / arr.length;
  },
  count(arr: any[]): number {
    return arr.length;
  },
  max(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.max(...arr);
  },
  min(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.min(...arr);
  },
  median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  variance(arr: number[]): number {
    if (arr.length <= 1) return 0;
    const mean = arr.reduce((acc, x) => acc + x, 0) / arr.length;
    const sqDiffs = arr.map((x) => Math.pow(x - mean, 2));
    return sqDiffs.reduce((acc, x) => acc + x, 0) / arr.length;
  },
  stdev(arr: number[]): number {
    return Math.sqrt(FormulaAggregates.variance(arr));
  },
  product(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((acc, x) => acc * x, 1);
  },
};

/**
 * 获取指定单元格的数值
 */
export function getCellValueAsNumber(cell: CellData | null | undefined): number {
  if (!cell || !cell.content) return 0;
  let clean = cell.content.replace(/<[^>]+>/g, "").trim();
  clean = clean.replace(/^[¥$￥€£]\s*/, "");
  const parsed = parseNumber(clean);
  return parsed ? parsed.value : 0;
}

/**
 * 解析范围表达式并提取数值列表（如 "A1:A5", "B:B", "2:2"）
 */
export function resolveRangeValues(rangeStr: string, matrix: CellData[][]): number[] {
  const values: number[] = [];
  const parts = rangeStr.split(":").map((s) => s.trim());
  if (parts.length !== 2) return values;

  const rowCount = matrix.length;
  if (rowCount === 0) return values;

  // 1. 全列引用，如 B:B 或 B:D
  if (/^[A-Za-z]+$/.test(parts[0]) && /^[A-Za-z]+$/.test(parts[1])) {
    const c1 = colLettersToIndex(parts[0]);
    const c2 = colLettersToIndex(parts[1]);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    for (let r = 0; r < rowCount; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = matrix[r]?.[c];
        if (cell) values.push(getCellValueAsNumber(cell));
      }
    }
    return values;
  }

  // 2. 全行引用，如 2:2 或 2:5
  if (/^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    const r1 = parseInt(parts[0], 10) - 1;
    const r2 = parseInt(parts[1], 10) - 1;
    const minR = Math.max(0, Math.min(r1, r2));
    const maxR = Math.min(rowCount - 1, Math.max(r1, r2));
    for (let r = minR; r <= maxR; r++) {
      for (let c = 0; c < (matrix[r]?.length || 0); c++) {
        const cell = matrix[r][c];
        if (cell) values.push(getCellValueAsNumber(cell));
      }
    }
    return values;
  }

  // 3. 矩形区域引用，如 A1:C5
  const p1 = parseCellRef(parts[0]);
  const p2 = parseCellRef(parts[1]);
  if (p1 && p2) {
    const minR = Math.max(0, Math.min(p1.row, p2.row));
    const maxR = Math.min(rowCount - 1, Math.max(p1.row, p2.row));
    const minC = Math.min(p1.col, p2.col);
    const maxC = Math.max(p1.col, p2.col);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = matrix[r]?.[c];
        if (cell) values.push(getCellValueAsNumber(cell));
      }
    }
  }

  return values;
}

/**
 * 词法分析器 Token 类型
 */
type TokenType = "NUMBER" | "CELL" | "RANGE" | "FUNC" | "OP" | "LPAREN" | "RPAREN" | "COMMA";

interface Token {
  type: TokenType;
  value: string;
}

/**
 * 对公式表达式进行词法拆解
 */
export function tokenizeFormula(expr: string): Token[] {
  const tokens: Token[] = [];
  let s = expr.startsWith("=") ? expr.slice(1).trim() : expr.trim();
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if ("+-*/%^".includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    // 数字
    if (/[\d.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[\d.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    // 标识符（函数名 / 单元格引用 / 范围）
    if (/[A-Za-z$]/.test(ch)) {
      let id = "";
      while (i < s.length && /[A-Za-z0-9$:]/.test(s[i])) {
        id += s[i];
        i++;
      }
      if (id.includes(":")) {
        tokens.push({ type: "RANGE", value: id });
      } else if (i < s.length && s[i] === "(") {
        tokens.push({ type: "FUNC", value: id.toUpperCase() });
      } else {
        tokens.push({ type: "CELL", value: id });
      }
      continue;
    }

    i++;
  }

  return tokens;
}

/**
 * 求值公式表达式
 * @param expr 公式字符串，例如 "=SUM(A1:A5) + B2 * 1.5"
 * @param matrix 表格矩阵
 * @param visited 用于检测循环引用的访问集合
 */
export function evaluateFormula(
  expr: string,
  matrix: CellData[][],
  visited = new Set<string>()
): { value: number | string; error?: string } {
  if (!expr.startsWith("=")) {
    const clean = expr.replace(/<[^>]+>/g, "").trim();
    const p = parseNumber(clean);
    return { value: p.isValid ? p.value : clean };
  }

  try {
    const tokens = tokenizeFormula(expr);
    let pos = 0;

    function parseExpression(): number {
      let val = parseTerm();
      while (pos < tokens.length && (tokens[pos].value === "+" || tokens[pos].value === "-")) {
        const op = tokens[pos++].value;
        const nextVal = parseTerm();
        val = op === "+" ? val + nextVal : val - nextVal;
      }
      return val;
    }

    function parseTerm(): number {
      let val = parseFactor();
      while (pos < tokens.length && (tokens[pos].value === "*" || tokens[pos].value === "/" || tokens[pos].value === "%")) {
        const op = tokens[pos++].value;
        const nextVal = parseFactor();
        if (op === "*") val *= nextVal;
        else if (op === "/") {
          if (nextVal === 0) throw new Error("#DIV/0!");
          val /= nextVal;
        } else if (op === "%") {
          val %= nextVal;
        }
      }
      return val;
    }

    function parseFactor(): number {
      if (pos >= tokens.length) return 0;
      const tok = tokens[pos++];

      if (tok.type === "NUMBER") {
        return parseFloat(tok.value) || 0;
      }

      if (tok.type === "CELL") {
        const ref = tok.value;
        const p = parseCellRef(ref);
        if (!p) throw new Error("#REF!");
        const key = `${p.row},${p.col}`;
        if (visited.has(key)) throw new Error("#CYCLE!");

        const cell = matrix[p.row]?.[p.col];
        if (!cell) return 0;

        if (cell.content && cell.content.startsWith("=")) {
          visited.add(key);
          const res = evaluateFormula(cell.content, matrix, visited);
          visited.delete(key);
          if (res.error) throw new Error(res.error);
          return typeof res.value === "number" ? res.value : parseFloat(String(res.value)) || 0;
        }

        return getCellValueAsNumber(cell);
      }

      if (tok.type === "FUNC") {
        const fnName = tok.value.toLowerCase();
        if (pos >= tokens.length || tokens[pos].type !== "LPAREN") throw new Error("#VALUE!");
        pos++; // 跳过 (

        const args: number[] = [];
        while (pos < tokens.length && tokens[pos].type !== "RPAREN") {
          if (tokens[pos].type === "RANGE") {
            const rangeStr = tokens[pos++].value;
            const rVals = resolveRangeValues(rangeStr, matrix);
            args.push(...rVals);
          } else {
            args.push(parseExpression());
          }
          if (pos < tokens.length && tokens[pos].type === "COMMA") {
            pos++;
          }
        }
        if (pos < tokens.length && tokens[pos].type === "RPAREN") {
          pos++; // 跳过 )
        }

        const fn = (FormulaAggregates as any)[fnName];
        if (typeof fn === "function") {
          return fn(args);
        }
        throw new Error("#NAME?");
      }

      if (tok.type === "LPAREN") {
        const val = parseExpression();
        if (pos < tokens.length && tokens[pos].type === "RPAREN") {
          pos++;
        }
        return val;
      }

      if (tok.type === "OP" && tok.value === "-") {
        return -parseFactor();
      }

      return 0;
    }

    const result = parseExpression();
    if (!Number.isFinite(result)) {
      return { value: "#DIV/0!", error: "#DIV/0!" };
    }
    // 格式化输出浮点数
    const formatted = Math.abs(result - Math.round(result)) < 1e-7 ? Math.round(result) : parseFloat(result.toFixed(4));
    return { value: formatted };
  } catch (err: any) {
    const errText = err?.message || "#ERROR!";
    return { value: errText, error: errText };
  }
}

/**
 * 智能填充单元格内容
 * @param source 原单元格内容
 * @param dRow 相对行偏移
 * @param dCol 相对列偏移
 * @param step 步数（从 1 开始递增）
 */
export function smartFillContent(
  source: string,
  dRow: number,
  dCol: number,
  step = 1
): string {
  if (!source) return "";

  // 1. 公式单元格：偏移相对引用
  if (source.startsWith("=")) {
    return adjustExpr(source, dRow * step, dCol * step);
  }

  // 2. 纯数字单元格：等差自增 (+1 * step)
  const clean = source.replace(/<[^>]+>/g, "").trim();
  if (/^-?\d+$/.test(clean)) {
    const base = parseInt(clean, 10);
    return String(base + step);
  }
  if (/^-?\d+\.\d+$/.test(clean)) {
    const base = parseFloat(clean);
    return (base + step).toFixed(clean.split(".")[1].length);
  }

  // 3. 序号类文本（如 "第1期" 或 "Item 1"）
  const seqMatch = clean.match(/^(.*?)(\d+)(.*?)$/);
  if (seqMatch) {
    const prefix = seqMatch[1];
    const num = parseInt(seqMatch[2], 10);
    const suffix = seqMatch[3];
    return `${prefix}${num + step}${suffix}`;
  }

  // 4. 普通文本原样复制
  return source;
}
