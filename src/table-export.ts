/**
 * table-export.ts - 表格导出模块
 *
 * 提供将 Markdown 表格导出为 CSV / XLSX 文件的工具与相关逻辑。
 */

import * as XLSX from "xlsx";
import { splitTableRow, isSeparatorLine } from "./table-model";

/**
 * 剥离文本中的 Markdown 格式标记（加粗、斜体、链接、HTML标签、内联代码等）
 *
 * @param text 包含 Markdown 格式的原始文本
 * @returns 剥离格式后的纯文本
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  let result = text;

  // 1. 替换 HTML 标签（如 <br/>, <br>, <span>...</span>）
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<[^>]*>/g, "");

  // 2. 替换图片与链接：![alt](url) -> alt, [text](url) -> text
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // 3. 剥离内联代码：`code` -> code
  result = result.replace(/`([^`]+)`/g, "$1");

  // 4. 剥离删除线：~~text~~ -> text
  result = result.replace(/~~([^~]+)~~/g, "$1");

  // 5. 剥离加粗与斜体：***text***, **text**, *text*, ___text___, __text__, _text_
  result = result.replace(/(\*\*|__)(.*?)\1/g, "$2");
  result = result.replace(/(\*|_)(.*?)\1/g, "$2");

  // 6. 替换转义管道符 \| -> |
  result = result.replace(/\\\|/g, "|");

  return result.trim();
}

/**
 * 从 Kramdown 表格行数组中提取二维纯文本网格 (2D Array)
 *
 * @param tableLines Kramdown 表格包含的文本行
 * @returns 净化后的二维字符串网格
 */
export function parseTableGrid(tableLines: string[]): string[][] {
  const grid: string[][] = [];

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    if (isSeparatorLine(line)) {
      continue; // 跳过表头与数据行之间的分隔线 |---|---|
    }

    const cells = splitTableRow(line);
    const cleanCells = cells.map(cell => stripMarkdown(cell));
    grid.push(cleanCells);
  }

  return grid;
}

/**
 * 生成符合要求的导出文件名（例如：表格导出_20260802_120000.csv）
 *
 * @param ext 文件扩展名 ('csv' | 'xlsx')
 * @param now 可选的基准时间对象，默认使用当前时间
 */
export function generateExportFilename(ext: "csv" | "xlsx", now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  return `表格导出_${timestamp}.${ext}`;
}

/**
 * 触发浏览器 Blob 文件下载
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 将二维网格转换为带 UTF-8 BOM 的 CSV 格式文本
 */
export function formatCSV(grid: string[][]): string {
  const csvLines = grid.map(row => {
    return row.map(cell => {
      // 若包含逗号、双引号或换行符，需用双引号包裹并转义原双引号
      if (/[",\n\r]/.test(cell)) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",");
  });

  // 添加 UTF-8 BOM (\uFEFF) 确保在 Windows Excel 打开时非英文字符不乱码
  return "\uFEFF" + csvLines.join("\r\n");
}

/**
 * 导出 CSV 文件
 *
 * @param tableLines Kramdown 表格文本行
 * @param filename 可选的导出文件名
 */
export function exportToCSV(tableLines: string[], filename?: string): void {
  const grid = parseTableGrid(tableLines);
  const csvContent = formatCSV(grid);
  const name = filename || generateExportFilename("csv");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, name);
}

/**
 * 导出 XLSX 文件
 *
 * @param tableLines Kramdown 表格文本行
 * @param filename 可选的导出文件名
 */
export function exportToXLSX(tableLines: string[], filename?: string): void {
  const grid = parseTableGrid(tableLines);
  const name = filename || generateExportFilename("xlsx");

  const worksheet = XLSX.utils.aoa_to_sheet(grid);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // 在浏览器中生成 XLSX 二进制 Buffer 并下载
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, name);
}
