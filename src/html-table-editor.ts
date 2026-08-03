import { fetchSyncPost } from "siyuan";

export interface HtmlTableEditorOptions {
  blockId: string;
}

export class HtmlTableEditor {
  public blockId: string;
  private rawHtml: string = "";
  private domDocument: Document | null = null;
  private tableElement: HTMLTableElement | null = null;

  constructor(options: HtmlTableEditorOptions) {
    this.blockId = options.blockId;
  }

  async reload(): Promise<void> {
    try {
      const res = await fetchSyncPost("/api/block/getBlockKramdown", {
        id: this.blockId,
      });

      let kramdown = "";
      if (res && res.code === 0 && res.data) {
        if (typeof res.data === "string") {
          kramdown = res.data;
        } else if (typeof res.data === "object" && res.data !== null) {
          kramdown = (res.data as any).kramdown;
        }
      }

      this.rawHtml = String(kramdown ?? "");
      
      // NodeHTMLBlock 的内容可能是 <div><protyle-html>...<table>...</protyle-html></div>
      // 我们将其解析为完整的 DOM，修改其中的 table，再还原
      const parser = new DOMParser();
      // 使用 "text/html" 会自动补全 html/body，不过没关系，我们可以从 body 提取
      this.domDocument = parser.parseFromString(this.rawHtml, "text/html");
      this.tableElement = this.domDocument.querySelector("table");
    } catch (err) {
      console.error("[siyuan-table-mater] HtmlTableEditor reload failed:", err);
    }
  }

  async flush(): Promise<void> {
    if (!this.domDocument) return;

    try {
      // 提取我们修改后的 HTML，因为 DOMParser 帮我们包了 html/body
      // rawHtml 中如果是没有包裹 html/body 的，就拿 body.innerHTML
      // 注意：这里可能需要精确匹配原有结构，但通常 body.innerHTML 即可
      const newHtml = this.domDocument.body.innerHTML;

      await fetchSyncPost("/api/block/updateBlock", {
        id: this.blockId,
        dataType: "markdown", // NodeHTMLBlock 的数据类型在 updateBlock 中依然是 markdown 或 kramdown
        data: newHtml,
      });

      this.rawHtml = newHtml;
    } catch (err) {
      console.error("[siyuan-table-mater] HtmlTableEditor flush failed:", err);
    }
  }

  // ============== 编辑功能占位 ==============
  
  public getTable(): HTMLTableElement | null {
      return this.tableElement;
  }
}
