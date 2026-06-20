/**
 * siyuan-table-mater - 思源笔记“表哥”表格插件
 *
 * 基于 @tgrosinger/md-advanced-tables 核心库，
 * 为思源笔记 NodeTable 块提供增强编辑能力。
 */

import { Plugin, showMessage, Setting, getActiveEditor } from "siyuan";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { registerCommands, TABLE_COMMANDS, executeCommand } from "./commands";
import { installKeybind, installKeybindAll } from "./keybind";
import { loadSettings, saveSettings, defaultSettings, PluginSettings } from "./settings";
import { getAllEditor } from "siyuan";
import { registerDock } from "./dock";
import { FloatingToolbar } from "./floating-toolbar";
import { SmartPaste } from "./smart-paste";
import { QuickCalc } from "./quick-calc";
import { DragReorder } from "./drag-reorder";
import { isCursorInTable } from "./siyuan-text-editor";
import { findTableBlock, rangeToCellCoord, highlightActiveRowAndCol } from "./dom-utils";

// ── 设置面板工具 ——

/** 开关配置项描述 */
interface ToggleSettingItem {
  key: keyof PluginSettings;
  i18nTitleKey: string;
  defaultTitle: string;
  i18nDescKey: string;
  defaultDesc: string;
}

/** 创建开关 setting 项并绑定双向同步 */
function createToggleSetting(
  setting: Setting,
  settings: PluginSettings,
  i18n: Record<string, string>,
  item: ToggleSettingItem,
): void {
  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "b3-switch fn__flex-center";
  check.checked = settings[item.key] as boolean;
  check.addEventListener("change", (e) => {
    (settings as any)[item.key] = (e.target as HTMLInputElement).checked;
  });
  setting.addItem({
    title: i18n[item.i18nTitleKey] || item.defaultTitle,
    description: i18n[item.i18nDescKey] || item.defaultDesc,
    actionElement: check,
  });
}

let PluginInfo = { version: "" };
try {
  PluginInfo = PluginInfoString as any;
} catch (_err) {
  console.log("[siyuan-table-mater] plugin info parse error");
}
const { version } = PluginInfo;

export default class TableMaterPlugin extends Plugin {
  public settings!: PluginSettings;
  private keybindUninstall: (() => void) | null = null;
  public floatingToolbar: FloatingToolbar | null = null;
  private smartPaste: SmartPaste | null = null;
  private quickCalc: QuickCalc | null = null;
  private dragReorder: DragReorder | null = null;
  private globalSelectionListener: (() => void) | null = null;

  async onload() {
    console.log(`[siyuan-table-mater] v${version} loading...`);

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
    this.updateStickyHeaderClass();

    // 注册命令
    registerCommands(this, this.settings);

    // 注册 Dock 栏工具箱
    registerDock(this);

    // 全局高亮光标所在行列
    this.initGlobalHighlight();

    // 顶栏按钮
    if (this.settings.showTopBarIcon) {
      this.addTopBar({
        icon: "iconAdvancedTables",
        title: this.i18n.settingsTitle || "表哥设置",
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

    // 监听编辑器右键菜单，添加“文本转表格”快捷入口
    this.eventBus.on("click-edit-contextmenu", this.onClickContextMenu);

    // 初始化浮动工具栏
    this.floatingToolbar = new FloatingToolbar(this);
    this.floatingToolbar.init();

    // 初始化智能粘贴
    this.smartPaste = new SmartPaste(this);
    this.smartPaste.init();

    // 初始化即时计算
    this.quickCalc = new QuickCalc(this);
    this.quickCalc.init();

    // 初始化拖拽行列重排
    this.dragReorder = new DragReorder(this);
    this.dragReorder.init();

    console.log(`[siyuan-table-mater] v${version} loaded`);
  }

  onunload() {
    console.log("[siyuan-table-mater] unloading...");

    // 注销全局高亮监听
    this.destroyGlobalHighlight();

    // 移除键盘拦截
    if (this.keybindUninstall) {
      this.keybindUninstall();
      this.keybindUninstall = null;
    }

    // 成对解绑事件
    this.eventBus.off("switch-protyle", this.onSwitchProtyle);
    this.eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
    this.eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);
    this.eventBus.off("click-edit-contextmenu", this.onClickContextMenu);

    // 销毁浮动工具栏
    if (this.floatingToolbar) {
      this.floatingToolbar.destroy();
      this.floatingToolbar = null;
    }

    // 销毁智能粘贴
    if (this.smartPaste) {
      this.smartPaste.destroy();
      this.smartPaste = null;
    }

    // 销毁即时计算
    if (this.quickCalc) {
      this.quickCalc.destroy();
      this.quickCalc = null;
    }

    // 销毁拖拽重排
    if (this.dragReorder) {
      this.dragReorder.destroy();
      this.dragReorder = null;
    }

    // 移除粘性表头类
    document.body.classList.remove("at-enable-sticky-header");

    console.log("[siyuan-table-mater] unloaded");
  }

  updateStickyHeaderClass() {
    if (this.settings.enableStickyHeader) {
      document.body.classList.add("at-enable-sticky-header");
    } else {
      document.body.classList.remove("at-enable-sticky-header");
    }
  }

  private onClickContextMenu = (event: CustomEvent) => {
    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) return;

    // 如果光标在表格内，则不显示“将文本转换为表格”右键菜单
    const { inTable } = isCursorInTable(activeEditor);
    if (inTable) return;

    event.detail.menu.addItem({
      icon: "iconAdvancedTables",
      label: "将文本转换为表格",
      click: () => {
        const cmd = TABLE_COMMANDS.find((c) => c.id === "text-to-table");
        if (cmd) {
          executeCommand(cmd, this.settings);
        }
      },
    });
  };

  openSetting() {
    // 打开设置时，为了防遮挡，隐藏可能残留在界面上的工具栏与拖拽手柄
    if (this.floatingToolbar) {
      (this.floatingToolbar as any).hide();
    }
    if (this.dragReorder) {
      this.dragReorder.hideHandles();
    }

    const setting = new Setting({
      confirmCallback: async () => {
        await saveSettings(this, this.settings);
        this.updateStickyHeaderClass();
        this.installKeybindToAllEditors();
        if (this.floatingToolbar) {
          this.floatingToolbar.update();
        }
      },
    });

    const TOGGLES: ToggleSettingItem[] = [
      { key: "showFloatingToolbar", i18nTitleKey: "showFloatingToolbar", defaultTitle: "当光标在表格内时显示浮动工具栏", i18nDescKey: "showFloatingToolbarDesc", defaultDesc: "开启后，光标进入表格时将在光标附近显示浮动的快速操作工具栏" },
      { key: "enableStickyHeader", i18nTitleKey: "enableStickyHeader", defaultTitle: "启用表格粘性表头 (Sticky Header)", i18nDescKey: "enableStickyHeaderDesc", defaultDesc: "开启后，长表格滚动时表头单元格将自动固定在编辑区顶部" },
      { key: "enableSmartPaste", i18nTitleKey: "enableSmartPaste", defaultTitle: "启用剪贴板智能粘贴", i18nDescKey: "enableSmartPasteDesc", defaultDesc: "开启后，粘贴表格数据（来自 Excel、网页等）时，将自动转换或多单元格填充" },
      { key: "enableQuickCalc", i18nTitleKey: "enableQuickCalc", defaultTitle: "启用框选单元格即时计算", i18nDescKey: "enableQuickCalcDesc", defaultDesc: "开启后，在表格中按住 Alt 键拖动框选数值单元格，将在底部显示求和、平均值、计数等即时统计信息" },
      { key: "enableDragReorder", i18nTitleKey: "enableDragReorder", defaultTitle: "启用拖拽行列重排", i18nDescKey: "enableDragReorderDesc", defaultDesc: "开启后，在表格内将显示行与列的拖拽手柄，可通过鼠标拖动直接调整行列顺序" },
      { key: "bindTab", i18nTitleKey: "bindTab", defaultTitle: "绑定 Tab 键导航", i18nDescKey: "bindTabDesc", defaultDesc: "在表格内按 Tab 键可快速跳转到下一个单元格，按 Shift+Tab 可跳转至上一个单元格" },
      { key: "bindEnter", i18nTitleKey: "bindEnter", defaultTitle: "绑定 Enter 键换行", i18nDescKey: "bindEnterDesc", defaultDesc: "在表格内按 Enter 键可跳转到下一行的当前列，如果在最后一行则自动插入新行" },
      { key: "fixCJKWidth", i18nTitleKey: "fixCJKWidth", defaultTitle: "CJK 字符宽度校正", i18nDescKey: "fixCJKWidthDesc", defaultDesc: "对中文、日文、韩文等双字节字符进行宽度估算，以实现排版对齐效果" },
    ];

    for (const item of TOGGLES) {
      createToggleSetting(setting, this.settings, this.i18n, item);
    }

    setting.open(this.i18n.settingsTitle || "表哥设置");
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
      console.warn("[siyuan-table-mater] installKeybindAll failed:", err);
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

  /** 初始化全局行列高亮监听，摆脱侧栏依赖 */
  private initGlobalHighlight() {
    this.globalSelectionListener = () => {
      requestAnimationFrame(() => {
        let inTable = false;
        let tableBlock: HTMLElement | null = null;
        let coord: any = null;

        // 1. 优先通过 Selection API 检测光标是否在表格内
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          tableBlock = findTableBlock(range.startContainer);
          if (tableBlock) {
            inTable = true;
            coord = rangeToCellCoord(range, tableBlock);
          }
        }

        // 2. 兜底：通过编辑器 API 检测
        if (!inTable) {
          const activeEditor = getActiveEditor();
          if (activeEditor?.protyle) {
            const res = isCursorInTable(activeEditor);
            if (res.inTable && res.tableBlock) {
              inTable = true;
              tableBlock = res.tableBlock;
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                coord = rangeToCellCoord(range, tableBlock);
              }
            }
          }
        }

        if (inTable && tableBlock && coord) {
          // 当前在表格内且获取到坐标，应用高亮
          highlightActiveRowAndCol(tableBlock, coord);
        } else {
          // 惰性失焦检测：如果光标完全移出当前表格块，清除高亮样式
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let node = range.startContainer as HTMLElement;
            let currentBlock: HTMLElement | null = null;
            while (node && node !== document.body) {
              if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-node-id")) {
                currentBlock = node;
                break;
              }
              node = node.parentNode as HTMLElement;
            }
            if (!currentBlock || currentBlock.dataset.type !== "NodeTable") {
              highlightActiveRowAndCol(null, null);
            }
          } else {
            highlightActiveRowAndCol(null, null);
          }
        }
      });
    };

    document.addEventListener("selectionchange", this.globalSelectionListener);
  }

  /** 注销全局行列高亮监听 */
  private destroyGlobalHighlight() {
    if (this.globalSelectionListener) {
      document.removeEventListener("selectionchange", this.globalSelectionListener);
      this.globalSelectionListener = null;
    }
    highlightActiveRowAndCol(null, null);
  }
}
