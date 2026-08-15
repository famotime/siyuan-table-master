/**
 * utils/index.ts - 项目共享工具函数
 *
 * 统一归拢并再导出各模块的纯函数与无副作用工具：
 * - DOM/HTML: escapeHtml, getCellCoordFromTable, sanitizeHtml, stripSpanStyle, markdownToHtmlTable
 * - 文本/表格: parseLines, isBoxDrawingTable, gridToMarkdown, splitMdRow, mdAlignOf, parseMdCell
 * - 数值计算: parseNumber, formatResult, sanitizeValue, isPercentCol, buildEchartsOption
 * - 图标资源: icons
 */

export { escapeHtml, getCellCoordFromTable } from "../dom-utils";
export { parseLines, isBoxDrawingTable, gridToMarkdown, sanitizeValue } from "../text-to-table-utils";
export { parseNumber, formatResult } from "./number-utils";
export {
  sanitizeHtml,
  stripSpanStyle,
  createCell,
  positiveSpan,
  parseCssNumber,
  splitMdRow,
  isMdSeparatorRow,
  mdAlignOf,
  mdInline,
  parseMdCell,
  markdownToHtmlTable,
} from "../html-dialog-utils";
export { buildEchartsOption, isPercentCol } from "../table-to-chart-utils";
export { icons } from "./icons";
