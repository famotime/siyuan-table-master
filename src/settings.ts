/**
 * settings.ts - 插件配置
 */

import { FormatType } from "@tgrosinger/md-advanced-tables";

export interface PluginSettings {
  /** 格式化风格：NORMAL=带 padding 对齐，WEAK=无 padding */
  formatType: FormatType;
  /** 绑定 Tab 键导航 */
  bindTab: boolean;
  /** 绑定 Enter 键下一行 */
  bindEnter: boolean;
  /** CJK 宽度校正 */
  fixCJKWidth: boolean;
  /** 显示顶栏图标 */
  showTopBarIcon: boolean;
  /** 当光标在表格内时是否出现浮动工具栏 */
  showFloatingToolbar: boolean;
  /** 是否启用粘性表头 */
  enableStickyHeader: boolean;
  /** 是否启用剪贴板智能粘贴 */
  enableSmartPaste: boolean;
  /** 是否启用单元格选区即时计算 */
  enableQuickCalc: boolean;
  /** 是否启用拖拽行列重排 */
  enableDragReorder: boolean;
}

export const defaultSettings: PluginSettings = {
  formatType: FormatType.WEAK, // 思源默认用 WEAK（CJK 问题见设计文档 7 节）
  bindTab: true,
  bindEnter: true,
  fixCJKWidth: true,
  showTopBarIcon: true,
  showFloatingToolbar: true,
  enableStickyHeader: true,
  enableSmartPaste: true,
  enableQuickCalc: true,
  enableDragReorder: true,
};

const SETTINGS_KEY = "config";

export async function loadSettings(
  plugin: { loadData: (key: string) => Promise<any> },
): Promise<PluginSettings> {
  const saved = await plugin.loadData(SETTINGS_KEY);
  return { ...defaultSettings, ...saved };
}

export async function saveSettings(
  plugin: { saveData: (key: string, data: any) => Promise<void> },
  settings: PluginSettings,
): Promise<void> {
  await plugin.saveData(SETTINGS_KEY, settings);
}
