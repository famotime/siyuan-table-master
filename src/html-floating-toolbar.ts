import { getActiveEditor } from "siyuan";
import { findHtmlTableBlock } from "./dom-utils";
import { HTML_TABLE_COMMANDS, executeHtmlCommand } from "./html-commands";
import { SVG_ICONS } from "./dock";
import type TableMaterPlugin from "./index";

export class HtmlFloatingToolbar {
  private plugin: TableMaterPlugin;
  private container: HTMLElement | null = null;
  private contextTag: HTMLElement | null = null;
  private htmlBadge: HTMLElement | null = null;
  private buttonsWrapper: HTMLElement | null = null;
  private activeHtmlTable: { blockId: string; block: HTMLElement; table: HTMLTableElement } | null = null;
  private selectionListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;
  public isExecuting = false;
  private executeTimeoutId: any = null;
  private transitionTimeoutId: any = null;

  constructor(plugin: TableMaterPlugin) {
    this.plugin = plugin;
  }

  init() {
    this.createContainer();

    this.selectionListener = () => {
      requestAnimationFrame(() => {
        this.update();
      });
    };
    document.addEventListener("selectionchange", this.selectionListener);

    this.scrollListener = () => {
      requestAnimationFrame(() => {
        this.reposition();
      });
    };
    document.addEventListener("scroll", this.scrollListener, true);
    window.addEventListener("resize", this.scrollListener);
  }

  destroy() {
    if (this.selectionListener) {
      document.removeEventListener("selectionchange", this.selectionListener);
      this.selectionListener = null;
    }
    if (this.scrollListener) {
      document.removeEventListener("scroll", this.scrollListener, true);
      window.removeEventListener("resize", this.scrollListener);
      this.scrollListener = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.executeTimeoutId) {
      clearTimeout(this.executeTimeoutId);
    }
    if (this.transitionTimeoutId) {
      clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }
  }

  private createContainer() {
    this.container = document.createElement("div");
    // 我们可以复用原有的 css 类以保持一致性，但可以增加 html 特有样式
    this.container.className = "at-floating-toolbar at-floating-hidden at-html-floating-toolbar";
    this.container.setAttribute("role", "toolbar");

    // [HTML] 角标
    this.htmlBadge = document.createElement("div");
    this.htmlBadge.className = "at-floating-html-badge";
    this.htmlBadge.innerText = "HTML";
    this.htmlBadge.style.backgroundColor = "var(--b3-theme-primary)";
    this.htmlBadge.style.color = "var(--b3-theme-on-primary)";
    this.htmlBadge.style.padding = "2px 6px";
    this.htmlBadge.style.borderRadius = "4px";
    this.htmlBadge.style.fontSize = "12px";
    this.htmlBadge.style.fontWeight = "bold";
    this.htmlBadge.style.marginRight = "4px";
    this.container.appendChild(this.htmlBadge);

    this.contextTag = document.createElement("div");
    this.contextTag.className = "at-floating-context";
    this.container.appendChild(this.contextTag);

    this.buttonsWrapper = document.createElement("div");
    this.buttonsWrapper.className = "at-floating-buttons";
    this.container.appendChild(this.buttonsWrapper);

    document.body.appendChild(this.container);
  }

  public update() {
    if (this.isExecuting) return;

    if (document.querySelector(".b3-dialog")) {
      this.hide();
      return;
    }

    if (!this.plugin.settings.showFloatingToolbar) {
      this.hide();
      return;
    }

    const activeEditor = getActiveEditor();
    if (!activeEditor?.protyle) {
      this.hide();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    const htmlTableInfo = findHtmlTableBlock(range.startContainer);

    if (!htmlTableInfo) {
      this.hide();
      return;
    }

    const blockId = htmlTableInfo.block.dataset.nodeId;
    if (!blockId) {
      this.hide();
      return;
    }

    this.activeHtmlTable = {
      blockId,
      block: htmlTableInfo.block,
      table: htmlTableInfo.table
    };

    // 这里由于没有行坐标计算，我们直接展示全部操作按钮
    this.renderButtons();
    
    if (this.container) {
      this.container.classList.remove("at-floating-hidden");
      if (this.contextTag && this.buttonsWrapper) {
        this.contextTag.style.opacity = "1";
        this.buttonsWrapper.style.opacity = "1";
        this.buttonsWrapper.style.transform = "scale(1)";
      }
      this.reposition(range.startContainer);
    }
  }

  private reposition(startContainer: Node) {
    if (!this.container || this.container.classList.contains("at-floating-hidden") || !this.activeHtmlTable) {
      return;
    }

    // 简单地把工具栏放在鼠标/光标所在的元素上方
    let cellEl = startContainer.nodeType === Node.ELEMENT_NODE ? (startContainer as Element) : startContainer.parentElement;
    
    // 找到 td 或 th
    while (cellEl && cellEl.tagName.toLowerCase() !== "td" && cellEl.tagName.toLowerCase() !== "th" && cellEl !== document.body) {
      cellEl = cellEl.parentElement;
    }

    if (!cellEl || (cellEl.tagName.toLowerCase() !== "td" && cellEl.tagName.toLowerCase() !== "th")) {
      this.hide();
      return;
    }

    const cellRect = cellEl.getBoundingClientRect();
    const toolbarRect = this.container.getBoundingClientRect();

    let left = cellRect.left + (cellRect.width - toolbarRect.width) / 2;
    const viewportWidth = window.innerWidth;
    if (left < 8) left = 8;
    if (left + toolbarRect.width > viewportWidth - 8) {
      left = viewportWidth - toolbarRect.width - 8;
    }

    let top = cellRect.top - toolbarRect.height - 8;
    if (top < 8) {
      top = cellRect.bottom + 8;
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  private renderButtons() {
    if (!this.container || !this.buttonsWrapper) return;

    if (this.contextTag) {
      this.contextTag.innerText = "表格";
    }

    this.buttonsWrapper.innerHTML = "";

    const cmdIds = [
      "html-insert-row-above",
      "html-insert-row-below",
      "html-insert-col-left",
      "html-insert-col-right",
      "html-merge-cells",
      "html-split-cell",
      "html-delete-row",
      "html-delete-col"
    ];

    cmdIds.forEach((cmdId) => {
      const cmd = HTML_TABLE_COMMANDS.find((c) => c.id === cmdId);
      if (!cmd) return;

      const btn = document.createElement("button");
      btn.className = "at-floating-btn";
      btn.setAttribute("aria-label", this.plugin.i18n[cmd.id] || cmd.nameZh);
      // 如果没有特定的 SVG，用名字首字或者占位符，这里简单复用原有的 insert icon，之后可替换
      btn.innerHTML = cmd.icon && SVG_ICONS[cmd.icon] ? SVG_ICONS[cmd.icon] : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`;

      const tooltipEl = document.createElement("div");
      tooltipEl.className = "at-custom-tooltip";
      tooltipEl.innerText = this.plugin.i18n[cmd.id] || cmd.nameZh;
      btn.appendChild(tooltipEl);

      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.isExecuting) return;

        this.isExecuting = true;
        if (this.executeTimeoutId) clearTimeout(this.executeTimeoutId);

        try {
          await executeHtmlCommand(cmd, this.plugin.i18n);
        } finally {
          this.executeTimeoutId = setTimeout(() => {
            this.isExecuting = false;
            this.update();
          }, 350);
        }
      });

      this.buttonsWrapper?.appendChild(btn);
    });
  }

  public hide() {
    if (this.transitionTimeoutId) {
      clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }
    if (this.container) {
      this.container.classList.add("at-floating-hidden");
      this.activeHtmlTable = null;
      if (this.contextTag && this.buttonsWrapper) {
        this.contextTag.style.opacity = "1";
        this.buttonsWrapper.style.opacity = "1";
        this.buttonsWrapper.style.transform = "scale(1)";
      }
    }
  }
}
