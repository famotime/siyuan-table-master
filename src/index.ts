/**
 * siyuan-advanced-tables - 思源笔记高级表格插件
 *
 * 基于 @tgrosinger/md-advanced-tables 核心库，
 * 为思源笔记 NodeTable 块提供增强编辑能力。
 */

import { Plugin } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { registerCommands } from "./commands";
import { installKeybind, installKeybindAll } from "./keybind";
import { loadSettings, saveSettings, defaultSettings, PluginSettings } from "./settings";
import { getAllEditor } from "siyuan";

let PluginInfo = { version: "" };
try {
  PluginInfo = PluginInfoString as any;
} catch (_err) {
  console.log("[siyuan-advanced-tables] Plugin info parse error");
}
const { version } = PluginInfo;

export default class AdvancedTablesPlugin extends Plugin {
  public settings!: PluginSettings;
  private keybindUninstall: (() => void) | null = null;

  async onload() {
    console.log(`[siyuan-advanced-tables] v${version} loading...`);

    // 加载设置
    this.settings = await loadSettings(this);
    await saveSettings(this, this.settings);

    // 注册命令
    registerCommands(this, this.settings);

    // 顶栏按钮
    if (this.settings.showTopBarIcon) {
      this.addTopBar({
        icon: "iconTable",
        title: "高级表格",
        position: "right",
        callback: () => {
          // TODO: M2 阶段打开 Dock 工具栏
          this.showMessage("高级表格已就绪 — 使用命令面板或快捷键操作", 3000);
        },
      });
    }

    // 安装键盘拦截到所有已打开的编辑器
    this.installKeybindToAllEditors();

    // 监听编辑器切换事件，动态安装/卸载拦截
    this.eventBus.on("switch-protyle", this.onSwitchProtyle);
    this.eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
    this.eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);

    console.log(`[siyuan-advanced-tables] v${version} loaded`);
  }

  onunload() {
    console.log("[siyuan-advanced-tables] unloading...");

    // 移除键盘拦截
    if (this.keybindUninstall) {
      this.keybindUninstall();
      this.keybindUninstall = null;
    }

    // 成对解绑事件
    this.eventBus.off("switch-protyle", this.onSwitchProtyle);
    this.eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
    this.eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);

    console.log("[siyuan-advanced-tables] unloaded");
  }

  openSetting() {
    // TODO: M2 阶段实现设置面板
    this.showMessage("设置面板将在后续版本实现", 3000);
  }

  // ── 私有方法 ──

  /** 安装键盘拦截到所有编辑器 */
  private installKeybindToAllEditors() {
    // 先卸载旧的
    if (this.keybindUninstall) {
      this.keybindUninstall();
    }

    try {
      const editors = getAllEditor();
      this.keybindUninstall = installKeybindAll(
        () => editors,
        this.settings,
      );
    } catch (err) {
      console.warn("[siyuan-advanced-tables] installKeybindAll failed:", err);
    }
  }

  /** 编辑器切换时重新安装拦截 */
  private onSwitchProtyle = () => {
    this.installKeybindToAllEditors();
  };

  /** 编辑器加载完成时安装拦截 */
  private onLoadedProtyle = () => {
    this.installKeybindToAllEditors();
  };
}
