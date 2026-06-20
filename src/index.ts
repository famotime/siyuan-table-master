/**
 * siyuan-advanced-tables - 思源笔记高级表格插件
 *
 * 基于 @tgrosinger/md-advanced-tables 核心库，
 * 为思源笔记 NodeTable 块提供增强编辑能力。
 */

import { Plugin, showMessage, Setting } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { registerCommands, TABLE_COMMANDS, executeCommand } from "./commands";
import { installKeybind, installKeybindAll } from "./keybind";
import { loadSettings, saveSettings, defaultSettings, PluginSettings } from "./settings";
import { getAllEditor } from "siyuan";
import { registerDock } from "./dock";
import { FloatingToolbar } from "./floating-toolbar";

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
  private floatingToolbar: FloatingToolbar | null = null;

  async onload() {
    console.log(`[siyuan-advanced-tables] v${version} loading...`);

    // 注册自定义图标，使侧栏和顶栏图标一致
    this.addIcons(`<symbol id="iconAdvancedTables" viewBox="0 0 24 24">
      <path d="M12 3v18" style="fill:none!important;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>
      <rect width="18" height="18" x="3" y="3" rx="2" style="fill:none!important;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>
      <path d="M3 9h18" style="fill:none!important;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>
      <path d="M3 15h18" style="fill:none!important;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>
    </symbol>`);

    // 加载设置
    this.settings = await loadSettings(this);
    await saveSettings(this, this.settings);

    // 注册命令
    registerCommands(this, this.settings);

    // 注册 Dock 栏工具箱
    registerDock(this);

    // 顶栏按钮
    if (this.settings.showTopBarIcon) {
      this.addTopBar({
        icon: "iconAdvancedTables",
        title: this.i18n.settingsTitle || "高级表格设置",
        position: "right",
        callback: () => {
          this.openSetting();
        },
      });
    }

    // 安装键盘拦截到所有已打开的编辑器
    this.installKeybindToAllEditors();

    // 监听编辑器切换事件，动态安装/卸载拦截
    this.eventBus.on("switch-protyle", this.onSwitchProtyle);
    this.eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
    this.eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);

    // 初始化浮动工具栏
    this.floatingToolbar = new FloatingToolbar(this);
    this.floatingToolbar.init();

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

    // 销毁浮动工具栏
    if (this.floatingToolbar) {
      this.floatingToolbar.destroy();
      this.floatingToolbar = null;
    }

    console.log("[siyuan-advanced-tables] unloaded");
  }

  openSetting() {
    const setting = new Setting({
      confirmCallback: async () => {
        await saveSettings(this, this.settings);
        this.installKeybindToAllEditors();
        if (this.floatingToolbar) {
          this.floatingToolbar.update();
        }
      },
    });

    // 1. 浮动工具栏配置
    const showFloatingToolbarCheck = document.createElement("input");
    showFloatingToolbarCheck.type = "checkbox";
    showFloatingToolbarCheck.className = "b3-switch fn__flex-center";
    showFloatingToolbarCheck.checked = this.settings.showFloatingToolbar;
    showFloatingToolbarCheck.addEventListener("change", (e) => {
      this.settings.showFloatingToolbar = (e.target as HTMLInputElement).checked;
    });

    setting.addItem({
      title: this.i18n.showFloatingToolbar || "当光标在表格内时显示浮动工具栏",
      description: this.i18n.showFloatingToolbarDesc || "开启后，光标进入表格时将在光标附近显示浮动的快速操作工具栏",
      actionElement: showFloatingToolbarCheck,
    });

    // 2. Tab 键导航配置
    const bindTabCheck = document.createElement("input");
    bindTabCheck.type = "checkbox";
    bindTabCheck.className = "b3-switch fn__flex-center";
    bindTabCheck.checked = this.settings.bindTab;
    bindTabCheck.addEventListener("change", (e) => {
      this.settings.bindTab = (e.target as HTMLInputElement).checked;
    });

    setting.addItem({
      title: this.i18n.bindTab || "绑定 Tab 键导航",
      description: this.i18n.bindTabDesc || "在表格内按 Tab 键可快速跳转到下一个单元格，按 Shift+Tab 可跳转至上一个单元格",
      actionElement: bindTabCheck,
    });

    // 3. Enter 键换行配置
    const bindEnterCheck = document.createElement("input");
    bindEnterCheck.type = "checkbox";
    bindEnterCheck.className = "b3-switch fn__flex-center";
    bindEnterCheck.checked = this.settings.bindEnter;
    bindEnterCheck.addEventListener("change", (e) => {
      this.settings.bindEnter = (e.target as HTMLInputElement).checked;
    });

    setting.addItem({
      title: this.i18n.bindEnter || "绑定 Enter 键换行",
      description: this.i18n.bindEnterDesc || "在表格内按 Enter 键可跳转到下一行的当前列，如果在最后一行则自动插入新行",
      actionElement: bindEnterCheck,
    });

    // 4. CJK 字符对齐校正配置
    const fixCJKWidthCheck = document.createElement("input");
    fixCJKWidthCheck.type = "checkbox";
    fixCJKWidthCheck.className = "b3-switch fn__flex-center";
    fixCJKWidthCheck.checked = this.settings.fixCJKWidth;
    fixCJKWidthCheck.addEventListener("change", (e) => {
      this.settings.fixCJKWidth = (e.target as HTMLInputElement).checked;
    });

    setting.addItem({
      title: this.i18n.fixCJKWidth || "CJK 字符宽度校正",
      description: this.i18n.fixCJKWidthDesc || "对中文、日文、韩文等双字节字符进行宽度估算，以实现排版对齐效果",
      actionElement: fixCJKWidthCheck,
    });

    setting.open(this.i18n.settingsTitle || "高级表格设置");
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
