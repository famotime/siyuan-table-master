/**
 * siyuan-advanced-tables - 思源笔记高级表格插件
 *
 * 基于 @tgrosinger/md-advanced-tables 核心库，
 * 为思源笔记 NodeTable 块提供增强编辑能力。
 */

import { Plugin, showMessage, Menu } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { registerCommands, TABLE_COMMANDS, executeCommand } from "./commands";
import { installKeybind, installKeybindAll } from "./keybind";
import { loadSettings, saveSettings, defaultSettings, PluginSettings } from "./settings";
import { getAllEditor } from "siyuan";
import { registerDock } from "./dock";

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

    // 注册 Dock 栏工具箱
    registerDock(this);

    // 顶栏按钮
    if (this.settings.showTopBarIcon) {
      const topBarIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18" style="fill:none!important"/><rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important"/><path d="M3 9h18" style="fill:none!important"/><path d="M3 15h18" style="fill:none!important"/></svg>`;
      this.addTopBar({
        icon: topBarIcon,
        title: "高级表格快捷菜单",
        position: "right",
        callback: (event: MouseEvent) => {
          this.showTopBarMenu(event);
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
    showMessage("设置面板将在后续版本实现", 3000);
  }

  // ── 私有方法 ──

  /** 弹出顶栏快捷操作菜单 */
  private showTopBarMenu(event: MouseEvent) {
    const menu = new Menu("advanced-tables-topbar-menu");

    menu.addItem({
      icon: "iconSparkles",
      label: "格式化表格",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "format-table");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addSeparator();

    menu.addItem({
      icon: "iconAlignCenter",
      label: "居中对齐列",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "center-align-column");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addItem({
      icon: "iconMath",
      label: "计算公式",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "evaluate-formulas");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addItem({
      icon: "iconRefresh",
      label: "转置表格",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "transpose");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addSeparator();

    menu.addItem({
      icon: "iconTable",
      label: "插入行",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "insert-row");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addItem({
      icon: "iconTrashcan",
      label: "删除行",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "delete-row");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addItem({
      icon: "iconTable",
      label: "插入列",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "insert-column");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.addItem({
      icon: "iconTrashcan",
      label: "删除列",
      click: async () => {
        const cmd = TABLE_COMMANDS.find(c => c.id === "delete-column");
        if (cmd) await executeCommand(cmd, this.settings);
      },
    });

    menu.open({
      x: event.clientX,
      y: event.clientY,
    });
  }

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
