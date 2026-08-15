/**
 * types/index.ts - 核心领域模型与公用接口类型定义
 *
 * 集中导出全插件的核心数据模型、坐标体系、命令描述与配置结构。
 */

export type { CellCoord } from "../dom-utils";
export type { ActiveCellState } from "../dock";
export type { TableCommand } from "../commands";
export type { HtmlTableCommand } from "../html-commands";
export type { ParsedTableKramdown } from "../table-model";
export type { CellStyle, CellData, Snapshot } from "../html-dialog-utils";
export type { EchartsOptionConfig } from "../table-to-chart-utils";
export type { ParsedNumber } from "../utils/number-utils";
export type { PluginSettings, AlignType } from "../settings";
export type { SiyuanTextEditorOptions } from "../siyuan-text-editor";
