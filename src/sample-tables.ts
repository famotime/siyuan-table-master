import { getActiveEditor, showMessage, fetchSyncPost } from "siyuan";

export const SAMPLE_MARKDOWN_TABLE = `| 项目名称 | 状态 | 负责人 | 预算 (元) |
| :--- | :---: | :---: | ---: |
| 需求分析与规划 | 完成 | 张三 | 5,000 |
| 界面设计与原型 | 进行中 | 李四 | 8,000 |
| 核心模块开发 | 未开始 | 王五 | 25,000 |
| 系统集成与测试 | 未开始 | 赵六 | 10,000 |`;

export const SAMPLE_HTML_TABLE = `<div>
<div style="text-align: center;">
<table align="center" style="border-collapse: collapse; margin: 10px auto; border: 0.1px solid #888888; font-size: 14px; line-height: 1.4;">
<caption style="font-size: 16px">2024年销售数据统计表</caption>
<colgroup>
<col style="width: auto">
<col style="width: auto">
<col style="width: auto">
<col style="width: auto">
<col style="width: auto">
<col style="width: auto">
</colgroup>
  <tbody><tr>
    <td rowspan="2" style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">区域</td>
    <td colspan="2" style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">第一季度</td>
    <td colspan="2" style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">第二季度</td>
    <td rowspan="2" style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">年度总计</td>
  </tr>
  <tr>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">销售额(万元)</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">完成率</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">销售额(万元)</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">完成率</td>
  </tr>
  <tr>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">华东区</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">1,250</td>
    <td style="color: green; text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">98%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">1,480</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">102%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">2,730</td>
  </tr>
  <tr>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">华南区</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">980</td>
    <td style="color: orange; text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">85%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">1,120</td>
    <td style="color: green; text-align: center; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">95%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">2,100</td>
  </tr>
  <tr>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">华北区</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">1,100</td>
    <td style="color: green; text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">92%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">1,350</td>
    <td style="color: red; text-align: left; vertical-align: bottom; padding: 4px; border: 0.1px solid #888888">78%</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">2,450</td>
  </tr>
  <tr>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">合计</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">3,330</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">—</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">3,950</td>
    <td style="text-align: center; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">—</td>
    <td style="text-align: left; vertical-align: middle; padding: 4px; border: 0.1px solid #888888">7,280</td>
  </tr>
</tbody></table>
</div>
</div>`;

/**
 * 在当前光标位置创建示例 Markdown 表格
 */
export async function createSampleMarkdownTable(i18n: any = {}): Promise<void> {
  await insertSampleTable(SAMPLE_MARKDOWN_TABLE, i18n.createSampleMdSuccess || "已成功创建示例 Markdown 表格", i18n);
}

/**
 * 在当前光标位置创建示例 HTML 复杂表格
 */
export async function createSampleHtmlTable(i18n: any = {}): Promise<void> {
  await insertSampleTable(SAMPLE_HTML_TABLE, i18n.createSampleHtmlSuccess || "已成功创建示例 HTML 复杂表格", i18n);
}

async function insertSampleTable(tableContent: string, successMsg: string, i18n: any = {}): Promise<void> {
  const activeEditor = getActiveEditor();
  if (!activeEditor?.protyle) {
    showMessage(i18n.errFocusEditor || "请先聚焦编辑器", 2000, "error");
    return;
  }

  let previousID: string | undefined;
  let parentID: string | undefined;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    let node = range.startContainer as HTMLElement | null;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement && node.dataset.nodeId) {
        previousID = node.dataset.nodeId;
        break;
      }
      node = node.parentNode as HTMLElement | null;
    }
  }

  if (!previousID) {
    if (activeEditor.protyle.block?.id) {
      parentID = activeEditor.protyle.block.id;
    } else {
      showMessage(i18n.errFocusEditor || "请先聚焦编辑器", 2000, "error");
      return;
    }
  }

  try {
    const param: any = {
      dataType: "markdown",
      data: tableContent,
    };
    if (previousID) {
      param.previousID = previousID;
    } else if (parentID) {
      param.parentID = parentID;
    }

    const res = await fetchSyncPost("/api/block/insertBlock", param);
    if (res && res.code === 0) {
      showMessage(successMsg, 2000, "info");
    } else {
      showMessage(i18n.errOperationFailed || "创建示例表格失败", 3000, "error");
    }
  } catch (err) {
    console.error("[siyuan-table-mater] insertSampleTable failed:", err);
    showMessage(i18n.errOperationFailed || "创建示例表格失败", 3000, "error");
  }
}
