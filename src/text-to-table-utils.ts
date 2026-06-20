/**
 * text-to-table-utils.ts - 文本转表格纯函数工具
 *
 * 纯同步、无 DOM 依赖，方便独立单元测试。
 * escapeHtml 统一从 dom-utils 导入。
 */

export { escapeHtml } from "./dom-utils";

/**
 * 按指定分隔符将文本行解析为二维网格
 *
 * @param sep - 分隔符："box-drawing" | "," | "，" | "\t" | " " | 自定义字符串
 * @param lines - 原始文本行
 */
export function parseLines(sep: string, lines: string[]): string[][] {
  if (sep === "box-drawing") {
    // 过滤掉边框线，保留数据行
    const borderLineRegex = /^[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╪┼┠┨┯┷┿┝┥┰┸╂\s\-+*#=]+$/;
    const dataLines = lines.filter(line => {
      const trimmed = line.trim();
      return !borderLineRegex.test(trimmed);
    });

    return dataLines.map(line => {
      // 统一将制图竖线转换为普通管道符
      const normalized = line.trim().replace(/[│┃║]/g, "|");
      let parts = normalized.split("|");
      // 剥除表格外边缘多余的空单元格
      if (normalized.startsWith("|")) {
        parts.shift();
      }
      if (normalized.endsWith("|")) {
        parts.pop();
      }
      return parts.map(p => p.trim());
    });
  } else {
    const activeSep = sep === "\t" ? "\t" : sep;
    return lines.map(line => line.split(activeSep).map(p => p.trim()));
  }
}

/**
 * 检测文本是否符合制图表格特征（含 2+ 行制图字符）
 */
export function isBoxDrawingTable(lines: string[]): boolean {
  const boxDrawingRegex = /[─-╿]/;
  let count = 0;
  for (const line of lines) {
    if (boxDrawingRegex.test(line)) {
      count++;
    }
  }
  return count >= 2;
}

/**
 * 将二维网格转换为 GFM Markdown 表格
 */
export function gridToMarkdown(grid: string[][]): string {
  if (grid.length === 0) return "";
  const colCount = Math.max(...grid.map(r => r.length));

  const lines: string[] = [];

  // 1. 表头行
  const header = grid[0] ?? [];
  const headerCells = Array.from({ length: colCount }, (_, i) => header[i] ?? "");
  lines.push(`| ${headerCells.join(" | ")} |`);

  // 2. 对齐分割行
  const sepCells = Array.from({ length: colCount }, () => "---");
  lines.push(`| ${sepCells.join(" | ")} |`);

  // 3. 数据行
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const rowCells = Array.from({ length: colCount }, (_, i) => row[i] ?? "");
    lines.push(`| ${rowCells.join(" | ")} |`);
  }

  return lines.join("\n");
}
