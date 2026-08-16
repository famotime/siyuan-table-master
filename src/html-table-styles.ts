/**
 * html-table-styles.ts - HTML 表格商务主题、冻结与格式刷纯函数
 *
 * 包含：
 * 1. 6 套预设商务主题配色与内联样式生成（双重渲染保真）
 * 2. 表头与首列冻结 (position: sticky) 样式配置
 * 3. 格式刷 (Format Painter) 样式采样与批量刷取
 * 4. 精细边框线型模板 (无/细/粗/红框/自定义)
 */

import { CellData, CellStyle } from "./html-dialog-utils";

export type TableThemeKey =
  | "business-blue"
  | "mint-green"
  | "minimal-gray"
  | "modern-dark"
  | "grid-frame"
  | "clean-stripeless";

export interface TableThemeConfig {
  key: TableThemeKey;
  label: string;
  headerBg: string;
  headerColor: string;
  headerBorder: string;
  oddRowBg: string;
  evenRowBg: string;
  dataRowColor: string;
  totalRowBg: string;
  totalRowColor: string;
  totalBorderTop: string;
  cellBorder: string;
  cellPadding: string;
}

export const TABLE_THEMES: Record<TableThemeKey, TableThemeConfig> = {
  "business-blue": {
    key: "business-blue",
    label: "经典商务蓝",
    headerBg: "#4472C4",
    headerColor: "#FFFFFF",
    headerBorder: "1px solid #2F5597",
    oddRowBg: "#FFFFFF",
    evenRowBg: "#F2F4F8",
    dataRowColor: "#1F2937",
    totalRowBg: "#D9E1F2",
    totalRowColor: "#1F2937",
    totalBorderTop: "2px solid #4472C4",
    cellBorder: "1px solid #D9D9D9",
    cellPadding: "8px 12px",
  },
  "mint-green": {
    key: "mint-green",
    label: "优雅薄荷绿",
    headerBg: "#10B981",
    headerColor: "#FFFFFF",
    headerBorder: "1px solid #059669",
    oddRowBg: "#FFFFFF",
    evenRowBg: "#ECFDF5",
    dataRowColor: "#1F2937",
    totalRowBg: "#D1FAE5",
    totalRowColor: "#065F46",
    totalBorderTop: "2px solid #10B981",
    cellBorder: "1px solid #A7F3D0",
    cellPadding: "8px 12px",
  },
  "minimal-gray": {
    key: "minimal-gray",
    label: "极简石墨灰",
    headerBg: "#374151",
    headerColor: "#FFFFFF",
    headerBorder: "1px solid #1F2937",
    oddRowBg: "#FFFFFF",
    evenRowBg: "#F9FAFB",
    dataRowColor: "#111827",
    totalRowBg: "#E5E7EB",
    totalRowColor: "#111827",
    totalBorderTop: "2px solid #374151",
    cellBorder: "1px solid #E5E7EB",
    cellPadding: "8px 12px",
  },
  "modern-dark": {
    key: "modern-dark",
    label: "现代暗黑",
    headerBg: "#1F2937",
    headerColor: "#F9FAFB",
    headerBorder: "1px solid #374151",
    oddRowBg: "#111827",
    evenRowBg: "#1F2937",
    dataRowColor: "#F9FAFB",
    totalRowBg: "#374151",
    totalRowColor: "#F3F4F6",
    totalBorderTop: "2px solid #6B7280",
    cellBorder: "1px solid #374151",
    cellPadding: "8px 12px",
  },
  "grid-frame": {
    key: "grid-frame",
    label: "经典网格线",
    headerBg: "#F3F4F6",
    headerColor: "#111827",
    headerBorder: "1px solid #9CA3AF",
    oddRowBg: "#FFFFFF",
    evenRowBg: "#FFFFFF",
    dataRowColor: "#111827",
    totalRowBg: "#F3F4F6",
    totalRowColor: "#111827",
    totalBorderTop: "2px solid #4B5563",
    cellBorder: "1px solid #9CA3AF",
    cellPadding: "6px 10px",
  },
  "clean-stripeless": {
    key: "clean-stripeless",
    label: "清爽无边框",
    headerBg: "transparent",
    headerColor: "#111827",
    headerBorder: "none",
    oddRowBg: "transparent",
    evenRowBg: "transparent",
    dataRowColor: "#111827",
    totalRowBg: "transparent",
    totalRowColor: "#111827",
    totalBorderTop: "2px solid #1F2937",
    cellBorder: "none",
    cellPadding: "8px 12px",
  },
};

function normalizeColor(c?: string): string {
  if (!c) return "";
  const clean = c.trim().toLowerCase();
  const rgbMatch = clean.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  if (clean.length === 4 && clean.startsWith("#")) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

const DEFAULT_OR_THEME_BGS = new Set([
  "",
  "transparent",
  "#ffffff",
  "#4472c4",
  "#10b981",
  "#374151",
  "#1f2937",
  "#f3f4f6",
  "#f2f4f8",
  "#ecfdf5",
  "#f9fafb",
  "#111827",
  "#d9e1f2",
  "#d1fae5",
  "#e5e7eb",
]);

const DEFAULT_OR_THEME_COLORS = new Set([
  "",
  "inherit",
  "#000000",
  "#111827",
  "#1f2937",
  "#374151",
  "#065f46",
  "#ffffff",
  "#f9fafb",
  "#f3f4f6",
]);

export function isDefaultOrThemeBg(bg?: string): boolean {
  return DEFAULT_OR_THEME_BGS.has(normalizeColor(bg));
}

export function isDefaultOrThemeColor(color?: string): boolean {
  return DEFAULT_OR_THEME_COLORS.has(normalizeColor(color));
}

/**
 * 将指定商务主题应用到表格二维矩阵
 * 若单元格已设置用户自定义的非默认底色或文字颜色，切换主题时自动保留
 */
export function applyTableThemeToMatrix(
  matrix: CellData[][],
  themeKey: TableThemeKey,
  hasHeader = true,
  hasTotal = false
): void {
  const theme = TABLE_THEMES[themeKey];
  if (!theme || matrix.length === 0) return;

  const rowCount = matrix.length;

  for (let r = 0; r < rowCount; r++) {
    const isHeaderRow = hasHeader && r === 0;
    const isTotalRow = hasTotal && r === rowCount - 1;

    for (let c = 0; c < matrix[r].length; c++) {
      const cell = matrix[r][c];

      if (isHeaderRow) {
        if (isDefaultOrThemeBg(cell.style.bg)) {
          cell.style.bg = theme.headerBg;
        }
        if (isDefaultOrThemeColor(cell.style.color)) {
          cell.style.color = theme.headerColor;
        }
        cell.style.alignH = "align-h-center";
      } else if (isTotalRow) {
        if (isDefaultOrThemeBg(cell.style.bg)) {
          cell.style.bg = theme.totalRowBg;
        }
        if (isDefaultOrThemeColor(cell.style.color)) {
          cell.style.color = theme.totalRowColor;
        }
      } else {
        // 数据行斑马条纹
        const isEven = (r - (hasHeader ? 1 : 0)) % 2 === 1;
        if (isDefaultOrThemeBg(cell.style.bg)) {
          cell.style.bg = isEven ? theme.evenRowBg : theme.oddRowBg;
        }
        if (isDefaultOrThemeColor(cell.style.color)) {
          cell.style.color = theme.dataRowColor;
        }
      }
    }
  }
}

/**
 * 格式刷状态管理
 */
export class FormatPainter {
  private sampledStyle: CellStyle | null = null;
  private isActive = false;

  /**
   * 采样当前单元格样式
   */
  sample(style: CellStyle): void {
    this.sampledStyle = { ...style };
    this.isActive = true;
  }

  /**
   * 检查格式刷是否处于激活取样状态
   */
  active(): boolean {
    return this.isActive && this.sampledStyle !== null;
  }

  /**
   * 获取采样样式
   */
  getSampled(): CellStyle | null {
    return this.sampledStyle ? { ...this.sampledStyle } : null;
  }

  /**
   * 将采样样式应用到目标单元格
   */
  applyTo(cell: CellData): void {
    if (!this.sampledStyle) return;
    cell.style = {
      ...cell.style,
      bg: this.sampledStyle.bg,
      color: this.sampledStyle.color,
      alignH: this.sampledStyle.alignH,
      alignV: this.sampledStyle.alignV,
      fs: this.sampledStyle.fs,
      lh: this.sampledStyle.lh,
    };
  }

  /**
   * 清除/取消格式刷激活态
   */
  clear(): void {
    this.sampledStyle = null;
    this.isActive = false;
  }
}
