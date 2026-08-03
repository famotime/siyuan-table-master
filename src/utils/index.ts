/**
 * utils/index.ts - 项目共享工具函数
 *
 * 从各处提取的公共工具：
 * - escapeHtml: 从 dom-utils 统一导出
 * - gridToMarkdown / parseLines / isBoxDrawingTable: 从 text-to-table-utils 统一导出
 *
 * 注意：函数定义与实现仍在原模块中维护，
 * 本文件仅作命名空间式再导出，便于外部消费。
 */

export { escapeHtml, getCellCoordFromTable } from "../dom-utils";
export { parseLines, isBoxDrawingTable, gridToMarkdown } from "../text-to-table-utils";
export { icons } from "./icons";

