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
}

export const defaultSettings: PluginSettings = {
  formatType: FormatType.WEAK, // 思源默认用 WEAK（CJK 问题见设计文档 7 节）
  bindTab: true,
  bindEnter: true,
  fixCJKWidth: true,
  showTopBarIcon: true,
};

export async function loadSettings(
  plugin: { loadData: () => Promise<any> },
): Promise<PluginSettings> {
  const saved = await plugin.loadData();
  return { ...defaultSettings, ...saved };
}

export async function saveSettings(
  plugin: { saveData: (data: any) => Promise<void> },
  settings: PluginSettings,
): Promise<void> {
  await plugin.saveData(settings);
}
