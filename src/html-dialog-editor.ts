import { Dialog, showMessage } from "siyuan";
import { HtmlTableEditor } from "./html-table-editor";
import type TableMaterPlugin from "./index";
import { icons } from "./utils/icons";
import { logger } from "./logger";
import {
  CellStyle,
  CellData,
  Snapshot,
  sanitizeHtml,
  stripSpanStyle,
  createCell,
  positiveSpan,
  parseCssNumber,
  markdownToHtmlTable,
} from "./html-dialog-utils";
import {
  transposeMatrix,
  splitMatrix,
  duplicateRowAt,
  duplicateColAt,
  distributeColWidths,
  sortMatrixByCol,
} from "./html-table-transforms";
import {
  evaluateFormula,
  smartFillContent,
  FormulaAggregates,
  getCellValueAsNumber,
  indexToColLetters,
} from "./html-formula-engine";
import {
  TABLE_THEMES,
  TableThemeKey,
  applyTableThemeToMatrix,
  FormatPainter,
} from "./html-table-styles";
import {
  normalizeHtmlTable,
} from "./html-clipboard";

export function openHtmlDialogEditor(_plugin: TableMaterPlugin, te: HtmlTableEditor) {
  const tableOriginal = te.getTable();
  if (!tableOriginal) {
    showMessage("未检测到有效的 HTML 表格");
    return;
  }

  const tableClone = tableOriginal.cloneNode(true) as HTMLTableElement;

  let matrix: CellData[][] = [];
  let gridMap: (CellData | null)[][] = [];
  let startCell: CellData | null = null;
  let endCell: CellData | null = null;
  let borderWidth = 0.1;
  let paddingWidth = 4;
  let fontSize = 14;
  let lineHeight = 1.4;
  let colorTarget: "background" | "color" | "textBackground" = "background";

  let tableCaption = "";
  let captionStyle = { fontSize: 16, background: "", color: "" };
  let selectedCaption = false;

  const formatPainter = new FormatPainter();
  let currentTheme: TableThemeKey | "" = "";
  let isHeaderFrozen = false;
  let isFirstColFrozen = false;
  let showCoordinates = false;
  let colWidths: string[] = [];
  let rowHeights: number[] = [];

  const HISTORY_LIMIT = 20;
  let undoStack: Snapshot[] = [];
  let redoStack: Snapshot[] = [];

  const presetColors = [
    "#8A170F", "#224429", "#19198F", "#A88100", "#B84D00", "#8A0F8A",
    "#2c3e50", "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#f39c12",
    "#d35400", "#c0392b", "#7f8c8d",
  ];

  const dialogHtml = `
    <div class="at-dialog-root">
      <!-- 商业软件分组工具栏 - 第一层：全局操作区 -->
      <div class="at-toolbar at-toolbar-global">
        <!-- 全局：基础与历史 -->
        <div class="at-toolbar-section">
          <button class="at-btn" id="at-btn-import" data-tooltip="导入 HTML / Markdown 代码">${icons.import}</button>
          <button class="at-btn" id="at-btn-copy" data-tooltip="复制当前表格 HTML 代码">${icons.copy}</button>
          <button class="at-btn" id="at-btn-caption" data-tooltip="显示/隐藏表格标题">${icons.caption}</button>
          <button class="at-btn" id="at-btn-select-all" data-tooltip="选择表格所有单元格">${icons.selectAll}</button>
          <div style="width: 1px; height: 14px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
          <button class="at-btn" id="at-btn-undo" data-tooltip="撤销上一步操作 (Ctrl+Z)">${icons.undo}</button>
          <button class="at-btn" id="at-btn-redo" data-tooltip="重做撤销的操作 (Ctrl+Y)">${icons.redo}</button>
        </div>

        <!-- 全局：商务主题与变换 -->
        <div class="at-toolbar-section">
          <select class="at-select" id="at-select-theme" data-tooltip="选择预设商务表格主题风格" title="选择预设商务表格主题风格">
            <option value="">预设主题...</option>
            <option value="business-blue">经典商务蓝</option>
            <option value="mint-green">优雅薄荷绿</option>
            <option value="minimal-gray">极简石墨灰</option>
            <option value="modern-dark">现代暗黑</option>
            <option value="grid-frame">经典网格线</option>
            <option value="clean-stripeless">清爽无边框</option>
          </select>
          <button class="at-btn" id="at-btn-transpose" data-tooltip="表格转置 (90° 行列互换)">${icons.transpose}<span style="font-size:11px;">转置</span></button>
          <button class="at-btn" id="at-btn-autofit" data-tooltip="自适应排版：根据单元格内容自动调整各列宽度">${icons.autoFit}<span style="font-size:11px;">自适应</span></button>
          <button class="at-btn" id="at-btn-distribute-cols" data-tooltip="均分各列宽度">${icons.distributeCols}<span style="font-size:11px;">均分列</span></button>
          <button class="at-btn" id="at-btn-formula-quick" data-tooltip="插入计算公式 (如 =SUM(A1:A5))">${icons.formula}<span style="font-size:11px;">公式</span></button>
          <button class="at-btn" id="at-btn-smart-fill" data-tooltip="向下/向右智能填充 (公式偏移/序号递增)">${icons.smartFill}<span style="font-size:11px;">填充</span></button>
        </div>

        <!-- 全局：表格尺寸参数 -->
        <div class="at-toolbar-section">
          <div style="display: flex; align-items: center; gap: 2px;">
            <span class="at-toolbar-label-icon" data-tooltip="表格行高 (倍数)" title="表格行高 (倍数)">${icons.lineHeight}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-lh-minus" data-tooltip="减小行高" title="减小行高">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-lh-val" value="1.4" data-tooltip="输入全局行高" title="输入全局行高" />
              <div class="at-adjust-btn" id="at-lh-plus" data-tooltip="增大行高" title="增大行高">${icons.plus}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 2px; margin-left: 4px;">
            <span class="at-toolbar-label-icon" data-tooltip="表格边框粗细 (px)" title="表格边框粗细 (px)">${icons.border}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-bw-minus" data-tooltip="减小边框" title="减小边框">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-bw-val" value="0.1" data-tooltip="输入全局边框粗细(px)" title="输入全局边框粗细(px)" />
              <div class="at-adjust-btn" id="at-bw-plus" data-tooltip="增大边框" title="增大边框">${icons.plus}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 2px; margin-left: 4px;">
            <span class="at-toolbar-label-icon" data-tooltip="单元格内边距 (px)" title="单元格内边距 (px)">${icons.padding}</span>
            <div class="at-adjust-box">
              <div class="at-adjust-btn" id="at-pad-minus" data-tooltip="减小内边距" title="减小内边距">${icons.minus}</div>
              <input type="text" class="at-adjust-input" id="at-pad-val" value="4" data-tooltip="输入单元格内边距(px)" title="输入单元格内边距(px)" />
              <div class="at-adjust-btn" id="at-pad-plus" data-tooltip="增大内边距" title="增大内边距">${icons.plus}</div>
            </div>
          </div>
          <div style="width: 1px; height: 14px; background: var(--b3-theme-surface-lighter); margin: 0 4px;"></div>
          <button class="at-btn" id="at-btn-reset-globals" data-tooltip="重置默认行高(1.4)、边框(0.1px)与内边距(4px)" title="重置默认行高(1.4)、边框(0.1px)与内边距(4px)">
            ${icons.resetZoom}
            <span style="font-size: 11px;">重置</span>
          </button>
        </div>
      </div>

      <div class="at-body-container">
        <!-- 表格内容滚动与画布容器 -->
        <div class="at-table-scroll" id="at-table-scroll-container">
          <div id="at-tableCenterWrapper">
            <table class="at-editor-table" id="at-main-table">
              <tbody id="at-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="at-side-panel-wrapper">
          <div class="at-panel-toggle" id="at-panel-toggle" data-tooltip="收缩/展开侧面板" title="收缩/展开侧面板">
            ${icons.chevronRight}
          </div>

          <!-- 商业软件分组工具栏 - 第二侧边面板：单元格操作区 -->
          <div class="at-side-panel" id="at-side-panel">
            <!-- 行列操作 -->
            <div class="at-panel-section">
              <div class="at-panel-title">行列与结构</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-merge" data-tooltip="合并选中的多格">${icons.merge}<span class="at-btn-label">合并</span></button>
                <button class="at-btn" id="at-btn-split" data-tooltip="拆分选中的合并单元格">${icons.split}<span class="at-btn-label">拆分</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-insert-col-left" data-tooltip="左侧插入列">${icons.insertColLeft}<span class="at-btn-label">左插入</span></button>
                <button class="at-btn" id="at-btn-insert-col-right" data-tooltip="右侧插入列">${icons.insertColRight}<span class="at-btn-label">右插入</span></button>
                <button class="at-btn" id="at-btn-insert-row-above" data-tooltip="上方插入行">${icons.insertRowAbove}<span class="at-btn-label">上插入</span></button>
                <button class="at-btn" id="at-btn-insert-row-below" data-tooltip="下方插入行">${icons.insertRowBelow}<span class="at-btn-label">下插入</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-dup-row" data-tooltip="复制选中行并在下方插入">${icons.duplicateRow}<span class="at-btn-label">复制行</span></button>
                <button class="at-btn" id="at-btn-dup-col" data-tooltip="复制选中列并在右侧插入">${icons.duplicateCol}<span class="at-btn-label">复制列</span></button>
                <button class="at-btn" id="at-btn-delete-row" data-tooltip="删除当前行">${icons.deleteRow}<span class="at-btn-label">删行</span></button>
                <button class="at-btn" id="at-btn-delete-col" data-tooltip="删除当前列">${icons.deleteCol}<span class="at-btn-label">删列</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-sort-asc" data-tooltip="按当前列升序排序">${icons.sortAsc}<span class="at-btn-label">升序</span></button>
                <button class="at-btn" id="at-btn-sort-desc" data-tooltip="按当前列降序排序">${icons.sortDesc}<span class="at-btn-label">降序</span></button>
                <button class="at-btn" id="at-btn-side-autofit" data-tooltip="自适应排版：自动贴合单元格内容宽度">${icons.autoFit}<span class="at-btn-label">自适应</span></button>
              </div>

              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-move-row-up" data-tooltip="行上移">${icons.moveRowUp}<span class="at-btn-label">上移</span></button>
                <button class="at-btn" id="at-btn-move-row-down" data-tooltip="行下移">${icons.moveRowDown}<span class="at-btn-label">下移</span></button>
                <button class="at-btn" id="at-btn-move-col-left" data-tooltip="列左移">${icons.moveColLeft}<span class="at-btn-label">左移</span></button>
                <button class="at-btn" id="at-btn-move-col-right" data-tooltip="列右移">${icons.moveColRight}<span class="at-btn-label">右移</span></button>
              </div>
            </div>

            <!-- 排版对齐 -->
            <div class="at-panel-section">
              <div class="at-panel-title">排版对齐</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-h-left" data-tooltip="水平居左">${icons.alignLeft}<span class="at-btn-label">居左</span></button>
                <button class="at-btn" id="at-btn-h-center" data-tooltip="水平居中">${icons.alignCenter}<span class="at-btn-label">居中</span></button>
                <button class="at-btn" id="at-btn-h-right" data-tooltip="水平居右">${icons.alignRight}<span class="at-btn-label">居右</span></button>
              </div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-v-top" data-tooltip="垂直居顶">${icons.alignTop}<span class="at-btn-label">居顶</span></button>
                <button class="at-btn" id="at-btn-v-middle" data-tooltip="垂直居中">${icons.alignMiddle}<span class="at-btn-label">居中</span></button>
                <button class="at-btn" id="at-btn-v-bottom" data-tooltip="垂直居底">${icons.alignBottom}<span class="at-btn-label">居底</span></button>
              </div>
            </div>

            <!-- 样式与颜色 -->
            <div class="at-panel-section">
              <div class="at-panel-title">样式与主题</div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-format-painter" data-tooltip="格式刷：单击采样选中样式，再点击/框选目标单元格">${icons.formatPainter}<span class="at-btn-label">格式刷</span></button>
                <button class="at-btn" id="at-btn-freeze-header" data-tooltip="冻结表头行 (Sticky)">${icons.freeze}<span class="at-btn-label">冻结表头</span></button>
                <button class="at-btn" id="at-btn-freeze-col" data-tooltip="冻结首列 (Sticky)">${icons.freeze}<span class="at-btn-label">冻结首列</span></button>
              </div>
              <div class="at-btn-row">
                <button class="at-btn" id="at-btn-bg-color" data-tooltip="设置单元格背景颜色">${icons.bgColor}<span class="at-btn-label">背景色</span></button>
                <button class="at-btn" id="at-btn-text-color" data-tooltip="设置单元格文字颜色">${icons.textColor}<span class="at-btn-label">文字色</span></button>
                <button class="at-btn" id="at-btn-clear" data-tooltip="清除选中单元格样式格式">${icons.clear}<span class="at-btn-label">清格式</span></button>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                <span class="at-toolbar-label-icon" style="font-size: 11px; opacity: 0.8; display: inline-flex; align-items: center; gap: 2px; width: auto; height: 24px; padding: 0 4px;" data-tooltip="修改选中单元格字号" title="修改选中单元格字号">${icons.fontSize} 字号:</span>
                <div class="at-adjust-box">
                  <div class="at-adjust-btn" id="at-fs-minus" data-tooltip="减小字号" title="减小字号">${icons.minus}</div>
                  <input type="text" class="at-adjust-input" id="at-fs-val" value="14" data-tooltip="输入字号(px)" title="输入字号(px)" />
                  <div class="at-adjust-btn" id="at-fs-plus" data-tooltip="增大字号" title="增大字号">${icons.plus}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部专业状态栏 -->
      <div class="at-status-bar">
        <div class="at-status-section">
          <span class="at-status-badge" id="at-status-text">拖拽框选单元格</span>
          <span id="at-coords-text" style="opacity: 0.7;">-</span>
        </div>

        <div class="at-status-section">
          <div class="at-zoom-ctrl">
            <button class="at-btn" id="at-btn-zoom-out" data-tooltip="缩小画布 (50%-150%)" title="缩小画布 (50%-150%)" style="height: 20px; min-width: 20px; padding: 0;">${icons.zoomOut}</button>
            <input type="range" id="at-zoom-slider" class="at-zoom-slider" min="50" max="150" value="100" step="5" title="缩放画布比例" />
            <button class="at-btn" id="at-btn-zoom-in" data-tooltip="放大画布 (50%-150%)" title="放大画布 (50%-150%)" style="height: 20px; min-width: 20px; padding: 0;">${icons.zoomIn}</button>
            <span id="at-zoom-val" style="min-width: 36px; text-align: center; font-size: 11px; font-weight: 600;">100%</span>
            <button class="at-btn" id="at-btn-zoom-reset" data-tooltip="重置缩放与贴合" title="重置缩放与贴合" style="height: 20px; min-width: 20px; padding: 0 4px;">${icons.resetZoom}</button>
          </div>
        </div>

        <div class="at-status-section">
          <button class="b3-button b3-button--cancel" id="at-btn-dialog-cancel" data-tooltip="取消并关闭编辑器" title="取消并关闭编辑器">取消</button>
          <button class="b3-button b3-button--primary" id="at-btn-dialog-save" style="background-color: var(--b3-theme-primary); color: var(--b3-theme-on-primary);" data-tooltip="保存修改并更新表格" title="保存修改并更新表格">保存更新</button>
        </div>
      </div>

      <!-- 颜色选择器 -->
      <div id="at-colorPicker"><div class="at-c-grid" id="at-colorGrid"></div></div>

      <!-- 右键菜单 -->
      <div id="at-contextMenu">
        <div class="at-menu-item" data-action="merge">${icons.merge} 合并单元格</div>
        <div class="at-menu-item" data-action="split">${icons.split} 拆分单元格</div>
        <div class="at-menu-item" data-action="alignCenter">${icons.alignCenter} 水平垂直居中</div>
        <div class="at-menu-item" data-action="autofit">${icons.autoFit} 自适应内容排版</div>
        <div class="at-menu-item" data-action="formatPainter">${icons.formatPainter} 格式刷取样</div>
        <div class="at-menu-item" data-action="formula">${icons.formula} 插入计算公式</div>
        <div class="at-menu-item" data-action="smartFill">${icons.smartFill} 智能填充</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="dupRow">${icons.duplicateRow} 复制当前行</div>
        <div class="at-menu-item" data-action="dupCol">${icons.duplicateCol} 复制当前列</div>
        <div class="at-menu-item" data-action="sortAsc">${icons.sortAsc} 按此列升序</div>
        <div class="at-menu-item" data-action="sortDesc">${icons.sortDesc} 按此列降序</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="insertColLeft">${icons.insertColLeft} 左侧插入列</div>
        <div class="at-menu-item" data-action="insertColRight">${icons.insertColRight} 右侧插入列</div>
        <div class="at-menu-item" data-action="insertRowAbove">${icons.insertRowAbove} 上方插入行</div>
        <div class="at-menu-item" data-action="insertRowBelow">${icons.insertRowBelow} 下方插入行</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="deleteRow">${icons.deleteRow} 删除当前行</div>
        <div class="at-menu-item" data-action="deleteCol">${icons.deleteCol} 删除当前列</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="moveRowUp">${icons.moveRowUp} 行上移</div>
        <div class="at-menu-item" data-action="moveRowDown">${icons.moveRowDown} 行下移</div>
        <div class="at-menu-item" data-action="moveColLeft">${icons.moveColLeft} 列左移</div>
        <div class="at-menu-item" data-action="moveColRight">${icons.moveColRight} 列右移</div>
        <div class="at-menu-divider"></div>
        <div class="at-menu-item" data-action="clearStyle">${icons.clear} 清除样式格式</div>
        <div class="at-menu-item" data-action="copyCellContent">${icons.copy} 复制单元格文本</div>
      </div>

      <!-- 导入弹窗 -->
      <div id="at-importModal">
        <div class="at-modal-box">
          <div style="font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 6px;">${icons.import} 导入表格代码（支持 HTML / Markdown）</div>
          <div style="font-size: 12px; opacity: 0.8;">支持导入表格标题 (Caption) 及单元格数据；自动过滤 MSO 垃圾标签与 XSS 风险。</div>
          <textarea id="at-importCode" class="at-modal-textarea" placeholder="粘贴 <table>...</table> 或 | Markdown | 表格 | 代码..."></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="b3-button b3-button--cancel" id="at-btn-cancel-import">取消</button>
            <button class="b3-button b3-button--text" id="at-btn-confirm-import">导入并替换</button>
          </div>
        </div>
      </div>

      <!-- 公式向导弹窗（可拖拽、带问号帮助浮窗与表格坐标系） -->
      <div id="at-formulaModal">
        <div class="at-modal-box" id="at-formula-modal-box">
          <div class="at-modal-header-draggable" id="at-formula-modal-header">
            <div style="font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 6px;">
              <span class="at-drag-grip" title="按住拖拽移动窗口">${icons.drag}</span>
              <span>${icons.formula} 插入表格计算公式</span>
            </div>
            <div class="at-help-wrapper">
              <button class="at-btn at-btn-icon at-help-btn" id="at-formula-help-btn" type="button" data-tooltip="查看公式使用说明与语法帮助" title="查看公式使用说明与语法帮助">
                ${icons.help}
              </button>
              <div class="at-formula-help-popover" id="at-formula-help-popover">
                <div class="at-help-pop-title">📐 公式语法说明与使用指南</div>
                <div class="at-help-section">
                  <div class="at-help-sec-title">1. 基本语法</div>
                  <div class="at-help-sec-desc">公式必须以 <code>=</code> 等号开头，支持四则运算与括号优先级，如 <code>=A1+B1*1.2</code>。</div>
                </div>
                <div class="at-help-section">
                  <div class="at-help-sec-title">2. 单元格坐标与区域引用</div>
                  <div class="at-help-sec-desc">
                    <div>• <b>单个格：</b>列字母+行号（如 <code>A1</code> 为首格，<code>C3</code> 为第3列第3行）。</div>
                    <div>• <b>连续区域：</b>用冒号 <code>:</code> 连接（如 <code>A1:A5</code> 为纵向区域，<code>A1:D1</code> 为横向区域，<code>A1:C3</code> 为二维矩阵）。</div>
                    <div>• <b>整列整行：</b>如 <code>A:A</code> 或 <code>2:2</code>。</div>
                    <div>• <b>绝对引用：</b>使用 <code>$A$1</code> 锁定坐标，智能填充或复制时不会随行列位移而改变。</div>
                  </div>
                </div>
                <div class="at-help-section">
                  <div class="at-help-sec-title">3. 支持的常用聚合函数</div>
                  <div class="at-help-fn-table">
                    <div class="at-help-fn-row"><code>SUM(区域)</code><span>区域所有数值求和</span></div>
                    <div class="at-help-fn-row"><code>AVERAGE(区域)</code><span>计算算术平均值</span></div>
                    <div class="at-help-fn-row"><code>COUNT(区域)</code><span>统计有效数值单元格数</span></div>
                    <div class="at-help-fn-row"><code>MAX(区域)</code><span>获取最大值</span></div>
                    <div class="at-help-fn-row"><code>MIN(区域)</code><span>获取最小值</span></div>
                    <div class="at-help-fn-row"><code>MEDIAN(区域)</code><span>计算中位数</span></div>
                    <div class="at-help-fn-row"><code>PRODUCT(区域)</code><span>所有数值相乘</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="font-size: 12px; opacity: 0.8;">输入等号开头的公式表达式（支持跨行跨列区域与四则运算，如 =SUM(A1:A5) 或 =A1*1.2）：</div>
          <input type="text" id="at-formula-input" class="b3-text-field" style="width: 100%; box-sizing: border-box; font-family: monospace;" placeholder="=SUM(A1:A5)" />
          <div>
            <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">常用函数快捷填入：</div>
            <div class="at-chip-list" id="at-formula-chips">
              <span class="at-chip" data-fn="SUM">SUM (求和)</span>
              <span class="at-chip" data-fn="AVERAGE">AVERAGE (均值)</span>
              <span class="at-chip" data-fn="COUNT">COUNT (计数)</span>
              <span class="at-chip" data-fn="MAX">MAX (最大值)</span>
              <span class="at-chip" data-fn="MIN">MIN (最小值)</span>
              <span class="at-chip" data-fn="MEDIAN">MEDIAN (中位数)</span>
              <span class="at-chip" data-fn="PRODUCT">PRODUCT (乘积)</span>
            </div>
          </div>
          <div style="font-size: 12px; background: var(--b3-theme-background); padding: 8px; border-radius: 4px; border: 1px solid var(--b3-theme-surface-lighter);">
            <span>实时计算预览：</span>
            <span id="at-formula-preview" style="font-weight: bold; color: var(--b3-theme-primary);">-</span>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="b3-button b3-button--cancel" id="at-btn-cancel-formula">取消</button>
            <button class="b3-button b3-button--text" id="at-btn-confirm-formula">填入单元格</button>
          </div>
        </div>
      </div>

      <div class="at-toast" id="at-toast"></div>
    </div>
  `;

  const dialog = new Dialog({
    title: "HTML 表格高级编辑器",
    content: dialogHtml,
    width: "92vw",
  });

  const dialogEl = dialog.element;
  const tbody = dialogEl.querySelector("#at-tbody") as HTMLElement;
  const table = dialogEl.querySelector("#at-main-table") as HTMLTableElement;
  const statusText = dialogEl.querySelector("#at-status-text") as HTMLElement;
  const coordsText = dialogEl.querySelector("#at-coords-text") as HTMLElement;
  const toastEl = dialogEl.querySelector("#at-toast") as HTMLElement;

  function showToast(msg: string) {
    if (!toastEl) return;
    toastEl.innerText = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  let currentZoom = 100;
  const tableCenterWrapper = dialogEl.querySelector("#at-tableCenterWrapper") as HTMLElement;
  const panelToggle = dialogEl.querySelector("#at-panel-toggle") as HTMLElement;
  const sidePanel = dialogEl.querySelector("#at-side-panel") as HTMLElement;
  panelToggle?.addEventListener("click", () => {
    sidePanel.classList.toggle("collapsed");
    panelToggle.innerHTML = sidePanel.classList.contains("collapsed") ? icons.chevronLeft : icons.chevronRight;
  });

  const zoomSlider = dialogEl.querySelector("#at-zoom-slider") as HTMLInputElement;
  const zoomVal = dialogEl.querySelector("#at-zoom-val") as HTMLElement;
  const btnZoomOut = dialogEl.querySelector("#at-btn-zoom-out") as HTMLElement;
  const btnZoomIn = dialogEl.querySelector("#at-btn-zoom-in") as HTMLElement;
  const btnZoomReset = dialogEl.querySelector("#at-btn-zoom-reset") as HTMLElement;

  function updateZoom(newZoom: number) {
    currentZoom = Math.min(150, Math.max(50, newZoom));
    if (tableCenterWrapper) {
      tableCenterWrapper.style.transform = `scale(${currentZoom / 100})`;
    }
    if (zoomSlider) zoomSlider.value = String(currentZoom);
    if (zoomVal) zoomVal.innerText = `${currentZoom}%`;
  }

  if (zoomSlider) {
    zoomSlider.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (Number.isFinite(val)) updateZoom(val);
    });
  }
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => updateZoom(currentZoom - 10));
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => updateZoom(currentZoom + 10));
  if (btnZoomReset) btnZoomReset.addEventListener("click", () => updateZoom(100));

  function getMatrixColumnCount(): number {
    return matrix.reduce((max, row) => Math.max(max, row.length), 0);
  }

  function rebuildGridMap() {
    gridMap = [];
    const rows = matrix.length;
    const cols = getMatrixColumnCount();

    for (let r = 0; r < rows; r++) {
      gridMap[r] = [];
      for (let c = 0; c < cols; c++) {
        gridMap[r][c] = null;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const cell = matrix[r][c];
        if (!cell) continue;
        if (gridMap[r]?.[c]) continue;
        for (let i = r; i < r + cell.rowSpan; i++) {
          for (let j = c; j < c + cell.colSpan; j++) {
            if (!gridMap[i]) gridMap[i] = [];
            gridMap[i][j] = cell;
          }
        }
      }
    }
  }

  function getMasterCell(r: number, c: number): CellData | null {
    return gridMap[r]?.[c] ?? null;
  }

  function isCurrentCell(cell: CellData | null): boolean {
    return !!cell && matrix[cell.r]?.[cell.c] === cell;
  }

  function resetSelection() {
    startCell = null;
    endCell = null;
    selectedCaption = false;
  }

  function snapshotState(): Snapshot {
    return {
      matrix: matrix.map((row) =>
        row.map((cell) => ({
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          style: { ...cell.style },
          backup: cell.backup
            ? { content: cell.backup.content, style: { ...cell.backup.style } }
            : undefined,
        }))
      ),
      tableCaption,
      captionStyle: { ...captionStyle },
      fontSize,
      lineHeight,
      borderWidth,
      paddingWidth,
      colWidths: [...colWidths],
      rowHeights: [...rowHeights],
    };
  }

  function updateHistoryButtons() {
    const btnUndo = dialogEl.querySelector("#at-btn-undo") as HTMLButtonElement;
    const btnRedo = dialogEl.querySelector("#at-btn-redo") as HTMLButtonElement;
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  }

  function restoreState(s: Snapshot) {
    matrix = s.matrix.map((row, r) =>
      row.map((cell, c) => {
        const nc = createCell(r, c, {
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          style: { ...cell.style },
        });
        if (cell.backup) {
          nc.backup = { content: cell.backup.content, style: { ...cell.backup.style } };
        }
        return nc;
      })
    );
    tableCaption = s.tableCaption;
    captionStyle = { ...s.captionStyle };
    fontSize = s.fontSize;
    lineHeight = s.lineHeight;
    borderWidth = s.borderWidth;
    paddingWidth = s.paddingWidth;
    colWidths = s.colWidths ? [...s.colWidths] : [];
    rowHeights = s.rowHeights ? [...s.rowHeights] : [];

    resetSelection();
    renderTable();

    const bwValEl = dialogEl.querySelector("#at-bw-val") as HTMLInputElement | null;
    const padValEl = dialogEl.querySelector("#at-pad-val") as HTMLInputElement | null;
    if (bwValEl) bwValEl.value = String(borderWidth);
    if (padValEl) padValEl.value = String(paddingWidth);
  }

  function pushHistory(preSnapshot?: Snapshot) {
    undoStack.push(preSnapshot || snapshotState());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotState());
    restoreState(undoStack.pop()!);
    updateHistoryButtons();
    showToast("已撤销");
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotState());
    restoreState(redoStack.pop()!);
    updateHistoryButtons();
    showToast("已重做");
  }

  function getSelectionBounds() {
    if (!isCurrentCell(startCell) || !isCurrentCell(endCell)) return null;
    return {
      minR: Math.min(startCell!.r, endCell!.r),
      maxR: Math.max(startCell!.r, endCell!.r),
      minC: Math.min(startCell!.c, endCell!.c),
      maxC: Math.max(startCell!.c, endCell!.c),
    };
  }

  function getSelectedMasterCells(bounds?: { minR: number; maxR: number; minC: number; maxC: number } | null): CellData[] {
    const b = bounds || getSelectionBounds();
    if (!b) return [];
    const masters = new Set<CellData>();
    for (let r = b.minR; r <= b.maxR; r++) {
      for (let c = b.minC; c <= b.maxC; c++) {
        const m = getMasterCell(r, c);
        if (m) masters.add(m);
      }
    }
    return Array.from(masters);
  }

  function canMergeSelection(): boolean {
    const bounds = getSelectionBounds();
    if (!bounds) return false;
    const { minR, maxR, minC, maxC } = bounds;
    if (minR === maxR && minC === maxC) return false;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const m = getMasterCell(r, c);
        if (!m) return false;
        if (m.r < minR || m.r + m.rowSpan - 1 > maxR || m.c < minC || m.c + m.colSpan - 1 > maxC) {
          return false;
        }
      }
    }
    return true;
  }

  function canMoveRowUp(r: number): boolean {
    if (r <= 0 || r >= matrix.length) return false;
    const C = getMatrixColumnCount();
    for (let c = 0; c < C; c++) {
      const m1 = getMasterCell(r, c);
      const m0 = getMasterCell(r - 1, c);
      if (!m1 || m1.r !== r || m1.rowSpan !== 1) return false;
      if (!m0 || m0.r !== r - 1 || m0.rowSpan !== 1) return false;
    }
    return true;
  }

  function canMoveRowDown(r: number): boolean {
    if (r < 0 || r >= matrix.length - 1) return false;
    const C = getMatrixColumnCount();
    for (let c = 0; c < C; c++) {
      const m1 = getMasterCell(r, c);
      const m2 = getMasterCell(r + 1, c);
      if (!m1 || m1.r !== r || m1.rowSpan !== 1) return false;
      if (!m2 || m2.r !== r + 1 || m2.rowSpan !== 1) return false;
    }
    return true;
  }

  function canMoveColLeft(c: number): boolean {
    if (c <= 0) return false;
    const R = matrix.length;
    for (let r = 0; r < R; r++) {
      const m1 = getMasterCell(r, c);
      const m0 = getMasterCell(r, c - 1);
      if (!m1 || m1.c !== c || m1.colSpan !== 1) return false;
      if (!m0 || m0.c !== c - 1 || m0.colSpan !== 1) return false;
    }
    return true;
  }

  function canMoveColRight(c: number): boolean {
    const C = getMatrixColumnCount();
    if (c < 0 || c >= C - 1) return false;
    const R = matrix.length;
    for (let r = 0; r < R; r++) {
      const m1 = getMasterCell(r, c);
      const m2 = getMasterCell(r, c + 1);
      if (!m1 || m1.c !== c || m1.colSpan !== 1) return false;
      if (!m2 || m2.c !== c + 1 || m2.colSpan !== 1) return false;
    }
    return true;
  }

  function updateColGroup() {
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }

    colgroup.innerHTML = "";
    if (showCoordinates) {
      const guideCol = document.createElement("col");
      guideCol.style.width = "36px";
      colgroup.appendChild(guideCol);
    }

    const maxCols = getMatrixColumnCount();
    for (let c = 0; c < maxCols; c++) {
      const col = document.createElement("col");
      col.dataset.col = String(c);
      if (colWidths[c]) {
        col.style.width = colWidths[c];
      }
      colgroup.appendChild(col);
    }
  }

  function updateGlobalStyles() {
    table.style.setProperty("--at-bw", borderWidth + "px");
    table.style.setProperty("--at-pad", paddingWidth + "px");
    table.style.border = `${borderWidth}px solid var(--b3-theme-surface-lighter)`;
    const tds = table.querySelectorAll("td, th");
    tds.forEach((td) => {
      (td as HTMLElement).style.border = `${borderWidth}px solid var(--b3-theme-surface-lighter)`;
      (td as HTMLElement).style.padding = paddingWidth + "px";
    });

    const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
    const lhValEl = dialogEl.querySelector("#at-lh-val") as HTMLInputElement | null;
    const bwValEl = dialogEl.querySelector("#at-bw-val") as HTMLInputElement | null;
    const padValEl = dialogEl.querySelector("#at-pad-val") as HTMLInputElement | null;
    if (fsValEl && document.activeElement !== fsValEl) fsValEl.value = String(fontSize);
    if (lhValEl && document.activeElement !== lhValEl) lhValEl.value = String(lineHeight);
    if (bwValEl && document.activeElement !== bwValEl) bwValEl.value = String(borderWidth);
    if (padValEl && document.activeElement !== padValEl) padValEl.value = String(paddingWidth);
  }

  function updateSidebarButtonsState() {
    const hasCell = isCurrentCell(startCell) && isCurrentCell(endCell);
    const hasSel = hasCell || selectedCaption;

    const setDisabled = (selector: string, disabled: boolean) => {
      const btn = dialogEl.querySelector(selector) as HTMLButtonElement | null;
      if (btn) btn.disabled = disabled;
    };

    setDisabled("#at-btn-merge", !hasCell || !canMergeSelection());
    setDisabled("#at-btn-split", !hasCell || !(startCell && (startCell.rowSpan > 1 || startCell.colSpan > 1)));

    setDisabled("#at-btn-insert-col-left", !hasCell);
    setDisabled("#at-btn-insert-col-right", !hasCell);
    setDisabled("#at-btn-insert-row-above", !hasCell);
    setDisabled("#at-btn-insert-row-below", !hasCell);

    setDisabled("#at-btn-dup-row", !hasCell);
    setDisabled("#at-btn-dup-col", !hasCell);
    setDisabled("#at-btn-sort-asc", !hasCell);
    setDisabled("#at-btn-sort-desc", !hasCell);

    setDisabled("#at-btn-delete-row", !hasCell || matrix.length <= 1);
    setDisabled("#at-btn-delete-col", !hasCell || getMatrixColumnCount() <= 1);

    setDisabled("#at-btn-move-row-up", !hasCell || !canMoveRowUp(startCell!.r));
    setDisabled("#at-btn-move-row-down", !hasCell || !canMoveRowDown(startCell!.r));
    setDisabled("#at-btn-move-col-left", !hasCell || !canMoveColLeft(startCell!.c));
    setDisabled("#at-btn-move-col-right", !hasCell || !canMoveColRight(startCell!.c));

    [
      "#at-btn-h-left", "#at-btn-h-center", "#at-btn-h-right",
      "#at-btn-v-top", "#at-btn-v-middle", "#at-btn-v-bottom",
      "#at-btn-bg-color", "#at-btn-text-color", "#at-btn-clear",
      "#at-btn-format-painter", "#at-btn-freeze-header", "#at-btn-freeze-col",
    ].forEach((id) => setDisabled(id, !hasSel));
  }

  function updateSelectionView() {
    table.querySelectorAll(".selected-cell").forEach((el) => el.classList.remove("selected-cell"));
    const captionEl = table.querySelector("caption");
    if (captionEl) captionEl.classList.remove("selected-caption");

    if (!selectedCaption && (!isCurrentCell(startCell) || !isCurrentCell(endCell))) {
      startCell = null;
      endCell = null;
    }

    if (selectedCaption && captionEl) {
      captionEl.classList.add("selected-caption");
      if (statusText) statusText.innerText = "已选中标题 (Caption)";
      if (coordsText) coordsText.innerText = "标题";
      updateSidebarButtonsState();
      return;
    }

    if (!startCell || !endCell) {
      if (statusText) statusText.innerText = "未选中";
      if (coordsText) coordsText.innerText = "-";
      updateSidebarButtonsState();
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      resetSelection();
      if (statusText) statusText.innerText = "未选中";
      if (coordsText) coordsText.innerText = "-";
      updateSidebarButtonsState();
      return;
    }

    const { minR, maxR, minC, maxC } = bounds;
    const selectedMasters = getSelectedMasterCells(bounds);
    selectedMasters.forEach((cell) => {
      if (cell.el) cell.el.classList.add("selected-cell");
    });

    const totalCount = (maxR - minR + 1) * (maxC - minC + 1);
    if (totalCount > 1) {
      // 实时统计区域数值 (求和与均值)
      const nums: number[] = [];
      selectedMasters.forEach((c) => {
        const val = getCellValueAsNumber(c);
        if (c.content && c.content.trim() !== "") nums.push(val);
      });
      if (nums.length > 0) {
        const sum = FormulaAggregates.sum(nums);
        const avg = FormulaAggregates.average(nums);
        const sumFmt = Math.abs(sum - Math.round(sum)) < 1e-4 ? sum : parseFloat(sum.toFixed(2));
        const avgFmt = Math.abs(avg - Math.round(avg)) < 1e-4 ? avg : parseFloat(avg.toFixed(2));
        if (statusText) statusText.innerText = `选中 ${totalCount} 格 · 求和: ${sumFmt} · 均值: ${avgFmt}`;
      } else {
        if (statusText) statusText.innerText = `选中 ${totalCount} 个单元格`;
      }
    } else {
      if (statusText) statusText.innerText = `选中 1 个单元格`;
    }

    if (coordsText) coordsText.innerText = `R${minR + 1}-R${maxR + 1}, C${minC + 1}-C${maxC + 1}`;

    if (showCoordinates) {
      table.querySelectorAll(".at-coord-col").forEach((th, idx) => {
        th.classList.toggle("at-coord-active", idx >= minC && idx <= maxC);
      });
      table.querySelectorAll(".at-coord-row").forEach((th, idx) => {
        th.classList.toggle("at-coord-active", idx >= minR && idx <= maxR);
      });
    }

    const master = getMasterCell(minR, minC);
    if (master) {
      const displayFs = master.style.fs ? master.style.fs : fontSize;
      const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
      if (fsValEl && document.activeElement !== fsValEl) fsValEl.value = String(displayFs);
    }
    updateSidebarButtonsState();
  }

  // 拖拽手柄状态
  let activeColHandle: HTMLElement | null = null;
  let activeColIdx = -1;
  let startDragX = 0;
  let startColWidth = 0;
  let guideLineV: HTMLElement | null = null;

  let activeRowHandle: HTMLElement | null = null;
  let activeRowIdx = -1;
  let startDragY = 0;
  let startRowHeight = 0;
  let guideLineH: HTMLElement | null = null;

  let resizeBubble: HTMLElement | null = null;

  function ensureResizeBubble(): HTMLElement {
    if (!resizeBubble) {
      resizeBubble = document.createElement("div");
      resizeBubble.className = "at-resize-bubble";
      dialogEl.appendChild(resizeBubble);
    }
    return resizeBubble;
  }

  function showResizeBubble(text: string, x: number, y: number) {
    const b = ensureResizeBubble();
    b.textContent = text;
    b.style.left = `${x + 16}px`;
    b.style.top = `${y - 28}px`;
    b.style.display = "block";
  }

  function hideResizeBubble() {
    if (resizeBubble) {
      resizeBubble.style.display = "none";
    }
  }

  function setupResizeHandles(cellData: CellData, td: HTMLTableCellElement, r: number, c: number) {
    // 1. 列宽拖拽手柄
    const colHandle = document.createElement("div");
    colHandle.className = "at-col-resize-handle";
    colHandle.title = "拖拽调整列宽";
    td.appendChild(colHandle);

    colHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      activeColHandle = colHandle;
      activeColIdx = c;
      startDragX = e.clientX;
      startColWidth = td.offsetWidth;
      colHandle.classList.add("active");

      guideLineV = document.createElement("div");
      guideLineV.className = "at-resize-guide-line-v";
      const scrollCont = dialogEl.querySelector("#at-table-scroll-container") as HTMLElement;
      scrollCont.appendChild(guideLineV);
      const rect = scrollCont.getBoundingClientRect();
      guideLineV.style.left = `${e.clientX - rect.left + scrollCont.scrollLeft}px`;

      showResizeBubble(`列宽 ${startColWidth}px · ${Math.round(startColWidth * 0.75)}pt`, e.clientX, e.clientY);

      const onColMouseMove = (me: MouseEvent) => {
        if (!activeColHandle) return;
        const dx = me.clientX - startDragX;
        const newWidth = Math.max(30, startColWidth + dx);
        if (guideLineV) {
          guideLineV.style.left = `${me.clientX - rect.left + scrollCont.scrollLeft}px`;
        }
        showResizeBubble(`列宽 ${Math.round(newWidth)}px · ${Math.round(newWidth * 0.75)}pt`, me.clientX, me.clientY);

        table.style.tableLayout = "fixed";
        table.style.width = "100%";
        const col = table.querySelector(`colgroup > col[data-col="${activeColIdx}"]`) as HTMLElement;
        if (col) col.style.width = `${newWidth}px`;

        table.querySelectorAll(`tbody tr > td[data-col="${activeColIdx}"], tbody tr > th[data-col="${activeColIdx}"]`).forEach((cell) => {
          if ((cell as HTMLTableCellElement).colSpan === 1) {
            (cell as HTMLElement).style.width = `${newWidth}px`;
          }
        });
      };

      const onColMouseUp = (ue: MouseEvent) => {
        if (activeColHandle) {
          const dx = ue.clientX - startDragX;
          const finalWidth = Math.max(30, startColWidth + dx);
          pushHistory();
          colWidths[activeColIdx] = `${finalWidth}px`;
          activeColHandle.classList.remove("active");
          activeColHandle = null;
          renderTable();
        }
        if (guideLineV && guideLineV.parentNode) {
          guideLineV.parentNode.removeChild(guideLineV);
          guideLineV = null;
        }
        hideResizeBubble();
        window.removeEventListener("mousemove", onColMouseMove);
        window.removeEventListener("mouseup", onColMouseUp);
      };

      window.addEventListener("mousemove", onColMouseMove);
      window.addEventListener("mouseup", onColMouseUp);
    });

    // 2. 行高拖拽手柄
    const rowHandle = document.createElement("div");
    rowHandle.className = "at-row-resize-handle";
    rowHandle.title = "拖拽调整行高";
    td.appendChild(rowHandle);

    rowHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      activeRowHandle = rowHandle;
      activeRowIdx = r;
      startDragY = e.clientY;
      startRowHeight = td.offsetHeight;
      rowHandle.classList.add("active");

      guideLineH = document.createElement("div");
      guideLineH.className = "at-resize-guide-line-h";
      const scrollCont = dialogEl.querySelector("#at-table-scroll-container") as HTMLElement;
      scrollCont.appendChild(guideLineH);
      const rect = scrollCont.getBoundingClientRect();
      guideLineH.style.top = `${e.clientY - rect.top + scrollCont.scrollTop}px`;

      showResizeBubble(`行高 ${startRowHeight}px · ${Math.round(startRowHeight * 0.75)}pt`, e.clientX, e.clientY);

      const onRowMouseMove = (me: MouseEvent) => {
        if (!activeRowHandle) return;
        const dy = me.clientY - startDragY;
        const newHeight = Math.max(20, startRowHeight + dy);
        if (guideLineH) {
          guideLineH.style.top = `${me.clientY - rect.top + scrollCont.scrollTop}px`;
        }
        showResizeBubble(`行高 ${Math.round(newHeight)}px · ${Math.round(newHeight * 0.75)}pt`, me.clientX, me.clientY);

        const tr = td.parentElement as HTMLTableRowElement;
        if (tr) {
          tr.style.height = `${newHeight}px`;
          Array.from(tr.children).forEach((cell) => {
            (cell as HTMLElement).style.height = `${newHeight}px`;
            const contentEl = cell.querySelector(".cell-content") as HTMLElement | null;
            if (contentEl) contentEl.style.minHeight = `${Math.max(20, newHeight - paddingWidth * 2)}px`;
          });
        }
      };

      const onRowMouseUp = (ue: MouseEvent) => {
        if (activeRowHandle) {
          const dy = ue.clientY - startDragY;
          const finalHeight = Math.max(20, startRowHeight + dy);
          pushHistory();
          rowHeights[activeRowIdx] = finalHeight;
          activeRowHandle.classList.remove("active");
          activeRowHandle = null;
          renderTable();
        }
        if (guideLineH && guideLineH.parentNode) {
          guideLineH.parentNode.removeChild(guideLineH);
          guideLineH = null;
        }
        hideResizeBubble();
        window.removeEventListener("mousemove", onRowMouseMove);
        window.removeEventListener("mouseup", onRowMouseUp);
      };

      window.addEventListener("mousemove", onRowMouseMove);
      window.addEventListener("mouseup", onRowMouseUp);
    });
  }

  function renderTable() {
    rebuildGridMap();
    tbody.innerHTML = "";
    matrix.forEach((row) => row.forEach((cell) => { cell.el = null; }));
    updateColGroup();

    const hasCustomWidths = colWidths.some(Boolean);
    table.style.tableLayout = hasCustomWidths ? "fixed" : "auto";
    table.style.width = hasCustomWidths ? "100%" : "auto";

    let captionEl = table.querySelector("caption");
    if (tableCaption) {
      if (!captionEl) {
        captionEl = document.createElement("caption");
        table.insertBefore(captionEl, table.firstChild);
      }
      captionEl.innerHTML = sanitizeHtml(tableCaption);
      captionEl.style.fontSize = captionStyle.fontSize + "px";
      captionEl.style.background = captionStyle.background || "";
      captionEl.style.color = captionStyle.color || "";
      captionEl.onmousedown = (e) => {
        e.stopPropagation();
        startCell = null;
        endCell = null;
        selectedCaption = true;
        updateSelectionView();
      };
      captionEl.ondblclick = (e) => {
        e.stopPropagation();
        if (!captionEl) return;
        captionEl.contentEditable = "true";
        captionEl.focus();

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(captionEl);
        selection?.removeAllRanges();
        selection?.addRange(range);

        const finishEdit = () => {
          if (!captionEl) return;
          captionEl.contentEditable = "false";
          const newText = sanitizeHtml(captionEl.innerHTML);
          if (newText !== tableCaption) {
            pushHistory();
            tableCaption = newText || "表格标题";
            renderTable();
          }
        };

        captionEl.onblur = finishEdit;
        captionEl.onkeydown = (ke) => {
          if (ke.key === "Enter" && !ke.shiftKey) {
            ke.preventDefault();
            captionEl.blur();
          } else if (ke.key === "Escape") {
            ke.preventDefault();
            if (captionEl) captionEl.innerHTML = sanitizeHtml(tableCaption);
            captionEl.contentEditable = "false";
          }
        };
      };
    } else if (captionEl) {
      captionEl.remove();
      selectedCaption = false;
    }
    if (showCoordinates) {
      const coordTr = document.createElement("tr");
      const cornerTh = document.createElement("th");
      cornerTh.className = "at-coord-corner";
      cornerTh.innerHTML = "#";
      coordTr.appendChild(cornerTh);

      const maxCols = getMatrixColumnCount();
      const bounds = getSelectionBounds();

      for (let c = 0; c < maxCols; c++) {
        const colTh = document.createElement("th");
        colTh.className = "at-coord-col";
        if (bounds && c >= bounds.minC && c <= bounds.maxC) {
          colTh.classList.add("at-coord-active");
        }
        colTh.textContent = indexToColLetters(c);
        coordTr.appendChild(colTh);
      }
      tbody.appendChild(coordTr);
    }

    for (let r = 0; r < matrix.length; r++) {
      const tr = document.createElement("tr");
      if (rowHeights[r]) {
        tr.style.height = `${rowHeights[r]}px`;
      }
      if (showCoordinates) {
        const rowTh = document.createElement("th");
        rowTh.className = "at-coord-row";
        const bounds = getSelectionBounds();
        if (bounds && r >= bounds.minR && r <= bounds.maxR) {
          rowTh.classList.add("at-coord-active");
        }
        rowTh.textContent = String(r + 1);
        tr.appendChild(rowTh);
      }

      for (let c = 0; c < matrix[r].length; c++) {
        const cellData = matrix[r][c];

        let isCovered = false;
        for (let checkR = 0; checkR <= r && !isCovered; checkR++) {
          for (let checkC = 0; checkC <= c && !isCovered; checkC++) {
            if (checkR === r && checkC === c) continue;
            const potentialMaster = matrix[checkR]?.[checkC];
            if (
              potentialMaster &&
              checkR + potentialMaster.rowSpan > r &&
              checkC + potentialMaster.colSpan > c
            ) {
              isCovered = true;
            }
          }
        }
        if (isCovered) continue;

        const td = document.createElement(r === 0 && (isHeaderFrozen || cellData.style.bg === TABLE_THEMES["business-blue"]?.headerBg) ? "th" : "td");
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        if (cellData.rowSpan > 1) td.rowSpan = cellData.rowSpan;
        if (cellData.colSpan > 1) td.colSpan = cellData.colSpan;

        if (cellData.colSpan === 1 && colWidths[c]) {
          td.style.width = colWidths[c];
        }
        if (cellData.rowSpan === 1 && rowHeights[r]) {
          td.style.height = `${rowHeights[r]}px`;
        }

        if (isHeaderFrozen && r === 0) td.classList.add("at-sticky-th");
        if (isFirstColFrozen && c === 0) td.classList.add("at-sticky-col");

        if (cellData.style.alignH === "align-h-center") td.style.textAlign = "center";
        else if (cellData.style.alignH === "align-h-right") td.style.textAlign = "right";
        else td.style.textAlign = "left";

        if (cellData.style.alignV === "align-v-top") td.style.verticalAlign = "top";
        else if (cellData.style.alignV === "align-v-bottom") td.style.verticalAlign = "bottom";
        else td.style.verticalAlign = "middle";

        const content = document.createElement("div");
        content.className = "cell-content";
        if (cellData.rowSpan === 1 && rowHeights[r]) {
          content.style.minHeight = `${Math.max(20, rowHeights[r] - paddingWidth * 2)}px`;
        }

        // 公式计算求值
        let displayContent = cellData.content || "";
        if (cellData.content && cellData.content.startsWith("=")) {
          const evalRes = evaluateFormula(cellData.content, matrix);
          if (evalRes.error) {
            td.classList.add("at-cell-formula-error");
            td.title = `公式错误: ${evalRes.error}`;
            displayContent = `<span style="color: var(--b3-theme-error);">${evalRes.error}</span>`;
          } else {
            td.classList.remove("at-cell-formula-error");
            td.title = `公式: ${cellData.content} -> ${evalRes.value}`;
            displayContent = String(evalRes.value);
          }
        } else {
          td.classList.remove("at-cell-formula-error");
        }

        content.innerHTML = sanitizeHtml(displayContent) || "&nbsp;";
        td.appendChild(content);

        if (cellData.style.bg) td.style.background = cellData.style.bg;
        if (cellData.style.color) {
          td.style.color = cellData.style.color;
          content.style.color = "inherit";
        }

        const fs = cellData.style.fs || fontSize;
        const lh = cellData.style.lh || lineHeight;
        content.style.fontSize = fs + "px";
        content.style.lineHeight = String(lh);

        cellData.el = td as HTMLTableCellElement;

        // 挂载拖拽调节手柄
        setupResizeHandles(cellData, td as HTMLTableCellElement, r, c);

        td.addEventListener("mousedown", (e) => onCellMouseDown(e, r, c));
        content.addEventListener("dblclick", () => onCellDblClick(td as HTMLTableCellElement, content, r, c));
        content.addEventListener("blur", () => {
          const newContent = sanitizeHtml(content.innerHTML);
          if (newContent !== cellData.content) {
            pushHistory();
            cellData.content = newContent;
            renderTable();
          }
        });

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    updateGlobalStyles();
    updateSelectionView();
  }

  function parseMatrixFromDOMTable(tableEl: HTMLTableElement) {
    const captionEl = tableEl.querySelector("caption");
    tableCaption = captionEl ? sanitizeHtml(captionEl.innerHTML) : "";
    if (captionEl) {
      captionStyle.fontSize = parseCssNumber(captionEl.style.fontSize, 1, 200) || 16;
      captionStyle.background = captionEl.style.backgroundColor || captionEl.style.background || "";
      captionStyle.color = captionEl.style.color || "";
    }

    const rows: HTMLTableRowElement[] = [];
    Array.from(tableEl.children).forEach((child) => {
      if (child.tagName === "TR") {
        rows.push(child as HTMLTableRowElement);
      } else if (["THEAD", "TBODY", "TFOOT"].includes(child.tagName)) {
        rows.push(...Array.from(child.children).filter((r) => r.tagName === "TR") as HTMLTableRowElement[]);
      }
    });

    const mapH: Record<string, CellStyle["alignH"]> = { left: "align-h-left", center: "align-h-center", right: "align-h-right" };
    const mapV: Record<string, CellStyle["alignV"]> = { top: "align-v-top", middle: "align-v-middle", bottom: "align-v-bottom" };

    const nextMatrix: CellData[][] = [];
    const occupied: boolean[][] = [];

    const ensureRow = (r: number) => {
      while (nextMatrix.length <= r) {
        nextMatrix.push([]);
        occupied.push([]);
      }
    };

    const ensureCell = (r: number, c: number) => {
      ensureRow(r);
      while (nextMatrix[r].length <= c) {
        const col = nextMatrix[r].length;
        nextMatrix[r].push(createCell(r, col));
        occupied[r].push(false);
      }
    };

    rows.forEach((tr, r) => {
      ensureRow(r);
      let c = 0;
      const cells = Array.from(tr.children).filter((cell) => cell.tagName === "TD" || cell.tagName === "TH") as HTMLTableCellElement[];

      cells.forEach((cell) => {
        while (occupied[r][c]) c++;

        const rs = positiveSpan(cell.getAttribute("rowspan"));
        const cs = positiveSpan(cell.getAttribute("colspan"));
        const style = cell.style;
        const alignH = (style.textAlign || tableEl.style.textAlign || "left").toLowerCase();
        const alignV = (style.verticalAlign || tableEl.style.verticalAlign || "middle").toLowerCase();
        const cellFs = parseCssNumber(style.fontSize, 1, 200);
        const cellLh = parseCssNumber(style.lineHeight, 0.1, 10);

        for (let i = 0; i < rs; i++) {
          for (let j = 0; j < cs; j++) {
            ensureCell(r + i, c + j);
          }
        }

        nextMatrix[r][c] = createCell(r, c, {
          content: sanitizeHtml(cell.innerHTML),
          rowSpan: rs,
          colSpan: cs,
          style: {
            bg: style.backgroundColor || style.background || "",
            color: style.color || "",
            alignH: mapH[alignH] || "align-h-left",
            alignV: mapV[alignV] || "align-v-middle",
            fs: cellFs !== "" ? cellFs : undefined,
            lh: cellLh !== "" ? cellLh : undefined,
          },
        });

        for (let i = 0; i < rs; i++) {
          for (let j = 0; j < cs; j++) {
            occupied[r + i][c + j] = true;
          }
        }
        c += cs;
      });
    });

    const maxCols = nextMatrix.reduce((max, row) => Math.max(max, row.length), 0);
    for (let r = 0; r < nextMatrix.length; r++) {
      while (nextMatrix[r].length < maxCols) {
        const c = nextMatrix[r].length;
        nextMatrix[r].push(createCell(r, c));
      }
    }

    matrix = nextMatrix;

    const cols = Array.from(tableEl.querySelectorAll("colgroup > col"));
    colWidths = cols.length > 0 ? cols.map((col) => (col as HTMLElement).style.width || "") : [];
    rowHeights = [];
  }

  function onCellMouseDown(e: MouseEvent, r: number, c: number) {
    if (e.button !== 0) return;
    const td = (e.target as HTMLElement).closest("td, th");
    if (td && !td.classList.contains("editing")) {
      e.preventDefault();

      selectedCaption = false;
      const cell = matrix[r]?.[c];
      if (!cell) return;

      // 格式刷激活态处理
      if (formatPainter.active()) {
        pushHistory();
        formatPainter.applyTo(cell);
        renderTable();
        dialogEl.classList.remove("at-cursor-brush");
        formatPainter.clear();
        showToast("已应用格式刷样式");
        return;
      }

      startCell = cell;
      endCell = cell;
      updateSelectionView();

      const onMove = (ev: MouseEvent) => {
        const targetTd = (ev.target as HTMLElement).closest("td, th");
        if (targetTd) {
          const tr = targetTd.getAttribute("data-row") ? parseInt(targetTd.getAttribute("data-row")!, 10) : -1;
          const tc = targetTd.getAttribute("data-col") ? parseInt(targetTd.getAttribute("data-col")!, 10) : -1;
          if (tr >= 0 && tc >= 0 && matrix[tr]?.[tc]) {
            if (endCell !== matrix[tr][tc]) {
              endCell = matrix[tr][tc];
              updateSelectionView();
            }
          }
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
  }

  function onCellDblClick(td: HTMLTableCellElement, content: HTMLDivElement, r: number, c: number) {
    td.classList.add("editing");
    content.contentEditable = "true";
    // 双击编辑时展示公式源码
    if (matrix[r]?.[c]?.content) {
      content.innerHTML = sanitizeHtml(matrix[r][c].content);
    }
    content.focus();

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(content);
    sel?.removeAllRanges();
    sel?.addRange(range);

    const blurHandler = () => {
      td.classList.remove("editing");
      content.contentEditable = "false";
      if (matrix[r]?.[c]) {
        const newContent = sanitizeHtml(content.innerHTML);
        if (newContent !== matrix[r][c].content) {
          pushHistory();
          matrix[r][c].content = newContent;
          renderTable();
        }
      }
      content.removeEventListener("blur", blurHandler);
    };

    content.addEventListener("blur", blurHandler);
  }

  function doMerge() {
    if (selectedCaption) {
      showToast("标题不能合并");
      return;
    }
    const bounds = getSelectionBounds();
    if (!bounds) return;
    if (!canMergeSelection()) {
      showToast("不能部分包含已有合并单元格");
      return;
    }

    pushHistory();
    const { minR, maxR, minC, maxC } = bounds;
    const master = matrix[minR][minC];
    const selectedMasters = getSelectedMasterCells(bounds);

    const txt: string[] = [];
    selectedMasters.forEach((cell) => {
      if (cell.content) txt.push(cell.content);
      if (cell !== master) {
        cell.backup = { content: cell.content, style: { ...cell.style } };
        cell.rowSpan = 1;
        cell.colSpan = 1;
      }
    });

    master.rowSpan = maxR - minR + 1;
    master.colSpan = maxC - minC + 1;
    master.content = txt.join(" ");
    master.style.alignH = "align-h-center";
    master.style.alignV = "align-v-middle";

    renderTable();
    startCell = master;
    endCell = master;
    updateSelectionView();
  }

  function doSplit() {
    if (selectedCaption) {
      showToast("标题不能拆分");
      return;
    }
    if (!startCell) return;
    const master = startCell;
    if (master.rowSpan === 1 && master.colSpan === 1) return;

    pushHistory();
    const baseR = master.r;
    const baseC = master.c;

    for (let r = baseR; r < baseR + master.rowSpan; r++) {
      for (let c = baseC; c < baseC + master.colSpan; c++) {
        const cell = matrix[r]?.[c];
        if (!cell) continue;
        cell.rowSpan = 1;
        cell.colSpan = 1;
        cell.style.alignH = "align-h-left";
        cell.style.alignV = "align-v-middle";
        if (r !== baseR || c !== baseC) {
          if (cell.backup) {
            cell.content = cell.backup.content;
            cell.style = cell.backup.style;
            delete cell.backup;
          } else {
            cell.content = "";
          }
        }
      }
    }

    renderTable();
  }

  function applyStyle(type: keyof CellStyle | "background", val: any) {
    if (selectedCaption) {
      if (type === "background") {
        pushHistory();
        captionStyle.background = val;
        renderTable();
      } else if (type === "color") {
        pushHistory();
        captionStyle.color = val;
        renderTable();
      } else {
        showToast("标题仅支持背景色与文字色");
      }
      return;
    }

    const selectedMasters = getSelectedMasterCells();
    if (selectedMasters.length === 0) return;

    pushHistory();
    selectedMasters.forEach((cell) => {
      if (type === "background") cell.style.bg = val;
      if (type === "color") cell.style.color = val;
      if (type === "alignH") cell.style.alignH = val;
      if (type === "alignV") cell.style.alignV = val;
      if (type === "fs") cell.style.fs = val;
      if (type === "lh") cell.style.lh = val;
    });

    renderTable();
    updateSelectionView();
  }

  function setFontSize(val: number) {
    let newSize = Math.round(val);
    if (isNaN(newSize)) return;
    if (newSize < 8) newSize = 8;
    if (newSize > 120) newSize = 120;

    if (selectedCaption) {
      pushHistory();
      captionStyle.fontSize = newSize;
      renderTable();
      updateSelectionView();
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      showToast("请先选择单元格或点击标题");
      const fsValEl = dialogEl.querySelector("#at-fs-val") as HTMLInputElement | null;
      if (fsValEl) fsValEl.value = String(fontSize);
      return;
    }

    pushHistory();
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      for (let c = bounds.minC; c <= bounds.maxC; c++) {
        const cell = matrix[r][c];
        cell.style.fs = newSize;
      }
    }
    renderTable();
    updateSelectionView();
  }

  function adjustFontSize(delta: number) {
    if (selectedCaption) {
      setFontSize(captionStyle.fontSize + delta);
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) {
      showToast("请先选择单元格或点击标题");
      return;
    }

    const master = getMasterCell(bounds.minR, bounds.minC);
    const currentFs = master?.style.fs ? master.style.fs : fontSize;
    setFontSize(currentFs + delta);
  }

  function setLineHeight(val: number) {
    if (selectedCaption) {
      showToast("行高仅适用于单元格");
      const lhValEl = dialogEl.querySelector("#at-lh-val") as HTMLInputElement | null;
      if (lhValEl) lhValEl.value = String(lineHeight);
      return;
    }

    let newLh = Math.round(val * 10) / 10;
    if (isNaN(newLh)) return;
    if (newLh < 1.0) newLh = 1.0;
    if (newLh > 5.0) newLh = 5.0;

    pushHistory();
    lineHeight = newLh;

    const masters = getSelectedMasterCells();
    if (masters.length > 0) {
      masters.forEach((cell) => { cell.style.lh = lineHeight; });
    }
    renderTable();
    updateSelectionView();
    updateGlobalStyles();
  }

  function adjustLineHeight(delta: number) {
    setLineHeight(lineHeight + delta);
  }

  function setBorderWidth(val: number) {
    let newBw = Math.round(val * 10) / 10;
    if (isNaN(newBw)) return;
    if (newBw < 0) newBw = 0;
    if (newBw > 20) newBw = 20;

    pushHistory();
    borderWidth = newBw;
    updateGlobalStyles();
  }

  function adjustBorderWidth(delta: number) {
    if (delta > 0) {
      if (borderWidth < 0.5) {
        setBorderWidth(0.5);
      } else {
        setBorderWidth(Math.round((borderWidth + 0.5) * 2) / 2);
      }
    } else {
      if (borderWidth <= 0.5 && borderWidth > 0.1) {
        setBorderWidth(0.1);
      } else if (borderWidth <= 0.1) {
        setBorderWidth(0);
      } else {
        setBorderWidth(Math.round((borderWidth - 0.5) * 2) / 2);
      }
    }
  }

  function setPaddingWidth(val: number) {
    let newPad = Math.round(val);
    if (isNaN(newPad)) return;
    if (newPad < 0) newPad = 0;
    if (newPad > 50) newPad = 50;

    pushHistory();
    paddingWidth = newPad;
    updateGlobalStyles();
  }

  function adjustPaddingWidth(delta: number) {
    setPaddingWidth(paddingWidth + delta);
  }

  function resetGlobalParams() {
    pushHistory();
    lineHeight = 1.4;
    borderWidth = 0.1;
    paddingWidth = 4;
    updateGlobalStyles();
    renderTable();
    updateSelectionView();
    showToast("已重置默认行高(1.4)、边框(0.1px)与内边距(4px)");
  }

  function generateCleanHtml(): string {
    const bWidth = borderWidth;
    const pWidth = paddingWidth;
    const fSize = fontSize;
    const lHeight = lineHeight;

    let html = '<div style="text-align: center;">\n';
    html += `<table align="center" style="border-collapse: collapse; margin: 10px auto; border: ${bWidth}px solid #888888; font-size: ${fSize}px; line-height: ${lHeight};">\n`;

    if (tableCaption) {
      const fs = captionStyle.fontSize + "px";
      const bg = captionStyle.background || "";
      const color = captionStyle.color || "";
      const styles: string[] = [];
      if (fs) styles.push(`font-size: ${fs}`);
      if (bg) styles.push(`background-color: ${bg}`);
      if (color) styles.push(`color: ${color}`);
      const styleAttr = styles.length ? ` style="${styles.join("; ")}"` : "";
      html += `<caption${styleAttr}>${sanitizeHtml(tableCaption)}</caption>\n`;
    }

    const colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children.length > 0) {
      html += "<colgroup>\n";
      Array.from(colgroup.querySelectorAll("col")).forEach((col) => {
        const w = (col as HTMLElement).style.width || "auto";
        html += `<col style="width: ${w}">\n`;
      });
      html += "</colgroup>\n";
    }

    for (let r = 0; r < matrix.length; r++) {
      let emptyRow = true;
      for (let c = 0; c < getMatrixColumnCount(); c++) {
        const cell = getMasterCell(r, c);
        if (cell && cell.content.trim() !== "") {
          emptyRow = false;
          break;
        }
      }

      const rowStyle = emptyRow ? ' style="height:1.2em"' : "";
      html += `  <tr${rowStyle}>\n`;

      for (let c = 0; c < matrix[r].length; c++) {
        const cell = matrix[r][c];

        let isCovered = false;
        for (let checkR = 0; checkR <= r && !isCovered; checkR++) {
          for (let checkC = 0; checkC <= c && !isCovered; checkC++) {
            if (checkR === r && checkC === c) continue;
            const potentialMaster = matrix[checkR]?.[checkC];
            if (
              potentialMaster &&
              checkR + potentialMaster.rowSpan > r &&
              checkC + potentialMaster.colSpan > c
            ) {
              isCovered = true;
            }
          }
        }
        if (isCovered) continue;

        const attrs: string[] = [];
        if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
        if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);

        const styles: string[] = [];
        if (cell.style.bg) styles.push(`background-color: ${cell.style.bg}`);
        if (cell.style.color) styles.push(`color: ${cell.style.color}`);
        if (cell.style.fs) styles.push(`font-size: ${cell.style.fs}px`);
        if (cell.style.lh) styles.push(`line-height: ${cell.style.lh}`);

        if (cell.style.alignH === "align-h-center") styles.push("text-align: center");
        else if (cell.style.alignH === "align-h-right") styles.push("text-align: right");
        else styles.push("text-align: left");

        if (cell.style.alignV === "align-v-top") styles.push("vertical-align: top");
        else if (cell.style.alignV === "align-v-bottom") styles.push("vertical-align: bottom");
        else styles.push("vertical-align: middle");

        styles.push(`padding: ${pWidth}px`);
        styles.push(`border: ${bWidth}px solid #888888`);

        if (isHeaderFrozen && r === 0) {
          styles.push("position: sticky", "top: 0", "z-index: 5");
        }
        if (isFirstColFrozen && c === 0) {
          styles.push("position: sticky", "left: 0", "z-index: 3");
        }

        if (cell.colSpan === 1) {
          const col = table.querySelector(`col[data-col="${c}"]`) as HTMLElement;
          if (col && col.style.width) {
            styles.push(`width: ${col.style.width}`);
          }
        }

        attrs.push(`style="${styles.join("; ")}"`);

        let cellContent = cell.content;
        if (cellContent.startsWith("=")) {
          const res = evaluateFormula(cellContent, matrix);
          cellContent = res.error ? res.error : String(res.value);
        }
        cellContent = sanitizeHtml(cellContent);
        if (cellContent.trim() === "") {
          cellContent = "&nbsp;";
        }

        const tag = r === 0 && isHeaderFrozen ? "th" : "td";
        html += `    <${tag} ${attrs.join(" ")}>${cellContent}</${tag}>\n`;
      }

      html += "  </tr>\n";
    }

    html += "</table>\n</div>";
    return html;
  }

  function initColorPicker() {
    const grid = dialogEl.querySelector("#at-colorGrid") as HTMLElement;
    grid.innerHTML = "";
    presetColors.forEach((c) => {
      const div = document.createElement("div");
      div.className = "at-c-swatch";
      div.style.background = c;
      div.onclick = () => {
        applyStyle(colorTarget === "textBackground" ? "color" : colorTarget, c);
        const picker = dialogEl.querySelector("#at-colorPicker") as HTMLElement;
        if (picker) picker.style.display = "none";
      };
      grid.appendChild(div);
    });

    const deselectDiv = document.createElement("div");
    deselectDiv.className = "at-c-swatch-deselect";
    deselectDiv.textContent = "✕ 取消颜色";
    deselectDiv.onclick = () => {
      const selectedMasters = getSelectedMasterCells();
      if (selectedMasters.length > 0) {
        pushHistory();
        if (colorTarget === "color") {
          selectedMasters.forEach((cell) => { cell.style.color = ""; });
        } else if (colorTarget === "textBackground") {
          selectedMasters.forEach((cell) => {
            if (cell.content) cell.content = stripSpanStyle(cell.content, "background-color");
          });
        } else {
          selectedMasters.forEach((cell) => { cell.style.bg = ""; });
        }
        renderTable();
        updateSelectionView();
      }
      const picker = dialogEl.querySelector("#at-colorPicker") as HTMLElement;
      if (picker) picker.style.display = "none";
    };
    grid.appendChild(deselectDiv);
  }

  function rebuildMatrix(operation: string, targetRow: number, targetCol: number) {
    const R = matrix.length;
    if (R === 0) return;
    const C = getMatrixColumnCount();
    const targetCell = matrix[targetRow]?.[targetCol];
    if (!targetCell || C === 0) return;

    pushHistory();

    const startCells: { r: number; c: number; rowSpan: number; colSpan: number; content: string; style: CellStyle }[] = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const cell = matrix[r]?.[c];
        if (cell && getMasterCell(r, c) === cell) {
          startCells.push({
            r,
            c,
            rowSpan: cell.rowSpan || 1,
            colSpan: cell.colSpan || 1,
            content: cell.content || "",
            style: { ...cell.style },
          });
        }
      }
    }

    let newR = R;
    let newC = C;
    const adjusted: typeof startCells = [];
    const rowBoundary = operation === "insertRowBelow" ? targetRow + (targetCell.rowSpan || 1) : targetRow;
    const colBoundary = operation === "insertColRight" ? targetCol + (targetCell.colSpan || 1) : targetCol;

    for (const cell of startCells) {
      let { r, c, rowSpan, colSpan, content, style } = cell;
      let keep = true;

      if (operation === "insertRowAbove" || operation === "insertRowBelow") {
        if (r >= rowBoundary) r += 1;
        else if (r + rowSpan > rowBoundary) rowSpan += 1;
        newR = R + 1;
      } else if (operation === "insertColLeft" || operation === "insertColRight") {
        if (c >= colBoundary) c += 1;
        else if (c + colSpan > colBoundary) colSpan += 1;
        newC = C + 1;
      } else if (operation === "deleteRow") {
        if (cell.r <= targetRow && targetRow < cell.r + cell.rowSpan) {
          if (rowSpan === 1) keep = false;
          else rowSpan -= 1;
        } else if (r > targetRow) r -= 1;
        newR = R - 1;
      } else if (operation === "deleteCol") {
        if (cell.c <= targetCol && targetCol < cell.c + cell.colSpan) {
          if (colSpan === 1) keep = false;
          else colSpan -= 1;
        } else if (c > targetCol) c -= 1;
        newC = C - 1;
      } else if (operation === "moveRowUp") {
        if (r === targetRow) r = targetRow - 1;
        else if (r === targetRow - 1) r = targetRow;
      } else if (operation === "moveRowDown") {
        if (r === targetRow) r = targetRow + 1;
        else if (r === targetRow + 1) r = targetRow;
      } else if (operation === "moveColLeft") {
        if (c === targetCol) c = targetCol - 1;
        else if (c === targetCol - 1) c = targetCol;
      } else if (operation === "moveColRight") {
        if (c === targetCol) c = targetCol + 1;
        else if (c === targetCol + 1) c = targetCol;
      }

      if (keep) {
        adjusted.push({ r, c, rowSpan, colSpan, content, style });
      }
    }

    newR = Math.max(0, newR);
    newC = Math.max(0, newC);

    const newMatrix: CellData[][] = [];
    const occupied: boolean[][] = [];
    for (let r = 0; r < newR; r++) {
      newMatrix[r] = [];
      occupied[r] = [];
      for (let c = 0; c < newC; c++) {
        newMatrix[r][c] = createCell(r, c);
        occupied[r][c] = false;
      }
    }

    for (const cell of adjusted) {
      if (cell.r < 0 || cell.c < 0 || cell.r >= newR || cell.c >= newC) continue;
      cell.rowSpan = Math.min(cell.rowSpan, newR - cell.r);
      cell.colSpan = Math.min(cell.colSpan, newC - cell.c);

      newMatrix[cell.r][cell.c] = createCell(cell.r, cell.c, {
        content: cell.content,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
        style: cell.style,
      });

      for (let i = 0; i < cell.rowSpan; i++) {
        for (let j = 0; j < cell.colSpan; j++) {
          occupied[cell.r + i][cell.c + j] = true;
        }
      }
    }

    let nextSelRow = targetRow;
    let nextSelCol = targetCol;

    if (operation === "insertRowAbove") nextSelRow = targetRow + 1;
    else if (operation === "insertRowBelow") nextSelRow = targetRow;
    else if (operation === "insertColLeft") nextSelCol = targetCol + 1;
    else if (operation === "insertColRight") nextSelCol = targetCol;
    else if (operation === "moveRowUp") nextSelRow = targetRow - 1;
    else if (operation === "moveRowDown") nextSelRow = targetRow + 1;
    else if (operation === "moveColLeft") nextSelCol = targetCol - 1;
    else if (operation === "moveColRight") nextSelCol = targetCol + 1;
    else if (operation === "deleteRow") nextSelRow = Math.min(targetRow, newR - 1);
    else if (operation === "deleteCol") nextSelCol = Math.min(targetCol, newC - 1);

    matrix = newMatrix;
    renderTable();

    nextSelRow = Math.max(0, Math.min(newR - 1, nextSelRow));
    nextSelCol = Math.max(0, Math.min(newC - 1, nextSelCol));

    if (newR > 0 && newC > 0 && matrix[nextSelRow]?.[nextSelCol]) {
      const selMaster = getMasterCell(nextSelRow, nextSelCol) || matrix[nextSelRow][nextSelCol];
      startCell = selMaster;
      endCell = selMaster;
      selectedCaption = false;
    } else {
      resetSelection();
    }
    updateSelectionView();
  }

  function bindEvents() {
    function getTargetRowCol(): { r: number; c: number } {
      if (startCell && isCurrentCell(startCell)) {
        return { r: startCell.r, c: startCell.c };
      }
      return { r: 0, c: 0 };
    }

    dialogEl.querySelector("#at-btn-undo")?.addEventListener("click", undo);
    dialogEl.querySelector("#at-btn-redo")?.addEventListener("click", redo);
    dialogEl.querySelector("#at-btn-select-all")?.addEventListener("click", () => {
      const lastRow = matrix.length - 1;
      const lastCol = getMatrixColumnCount() - 1;
      if (lastRow >= 0 && lastCol >= 0 && matrix[0]?.[0] && matrix[lastRow]?.[lastCol]) {
        selectedCaption = false;
        startCell = matrix[0][0];
        endCell = matrix[lastRow][lastCol];
        updateSelectionView();
        showToast("已全选");
      }
    });

    dialogEl.querySelector("#at-btn-caption")?.addEventListener("click", () => {
      pushHistory();
      if (tableCaption) {
        tableCaption = "";
        selectedCaption = false;
      } else {
        tableCaption = "表格标题";
        selectedCaption = true;
      }
      renderTable();
    });

    // 商务主题切换
    const themeSelect = dialogEl.querySelector("#at-select-theme") as HTMLSelectElement | null;
    themeSelect?.addEventListener("change", () => {
      const selected = themeSelect.value as TableThemeKey | "";
      if (selected && TABLE_THEMES[selected]) {
        pushHistory();
        currentTheme = selected;
        applyTableThemeToMatrix(matrix, selected, true, false);
        renderTable();
        showToast(`已套用主题: ${TABLE_THEMES[selected].label}`);
      }
    });

    // 表格转置
    dialogEl.querySelector("#at-btn-transpose")?.addEventListener("click", () => {
      const res = transposeMatrix(matrix);
      if (res.success && res.matrix) {
        pushHistory();
        matrix = res.matrix;
        resetSelection();
        renderTable();
        showToast("表格已转置 (行列互换)");
      } else {
        showToast(res.error || "转置失败");
      }
    });

    // 均分列宽
    dialogEl.querySelector("#at-btn-distribute-cols")?.addEventListener("click", () => {
      const widths = distributeColWidths(matrix);
      if (widths.length > 0) {
        pushHistory();
        colWidths = [...widths];
        renderTable();
        showToast(`已均分 ${widths.length} 列宽度 (各 ${widths[0]})`);
      }
    });

    // 均分行高
    dialogEl.querySelector("#at-btn-distribute-rows")?.addEventListener("click", () => {
      pushHistory();
      rowHeights = [];
      renderTable();
      showToast("已重置均分行高");
    });

    // 智能填充
    dialogEl.querySelector("#at-btn-smart-fill")?.addEventListener("click", () => {
      const bounds = getSelectionBounds();
      if (!bounds || !startCell) {
        showToast("请先选中有内容的起始单元格及填充目标区域");
        return;
      }
      pushHistory();
      const srcText = startCell.content;
      const { minR, maxR, minC, maxC } = bounds;

      let step = 1;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === startCell.r && c === startCell.c) continue;
          const cell = matrix[r]?.[c];
          if (cell) {
            const dRow = r - startCell.r;
            const dCol = c - startCell.c;
            cell.content = smartFillContent(srcText, dRow, dCol, step++);
          }
        }
      }
      renderTable();
      showToast("智能填充完成");
    });

    // 复制行 / 复制列
    dialogEl.querySelector("#at-btn-dup-row")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      pushHistory();
      matrix = duplicateRowAt(matrix, t.r);
      renderTable();
      showToast("已复制当前行");
    });

    dialogEl.querySelector("#at-btn-dup-col")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      pushHistory();
      matrix = duplicateColAt(matrix, t.c);
      renderTable();
      showToast("已复制当前列");
    });

    // 排序
    dialogEl.querySelector("#at-btn-sort-asc")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      pushHistory();
      matrix = sortMatrixByCol(matrix, t.c, true, true);
      renderTable();
      showToast(`已按第 ${t.c + 1} 列升序排序`);
    });

    dialogEl.querySelector("#at-btn-sort-desc")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      pushHistory();
      matrix = sortMatrixByCol(matrix, t.c, false, true);
      renderTable();
      showToast(`已按第 ${t.c + 1} 列降序排序`);
    });

    // 自适应排版
    function autoFitTable() {
      pushHistory();
      colWidths = [];
      rowHeights = [];
      renderTable();
      showToast("已恢复自适应内容排版");
    }

    dialogEl.querySelector("#at-btn-autofit")?.addEventListener("click", autoFitTable);
    dialogEl.querySelector("#at-btn-side-autofit")?.addEventListener("click", autoFitTable);

    // 格式刷
    dialogEl.querySelector("#at-btn-format-painter")?.addEventListener("click", () => {
      if (!startCell) {
        showToast("请先选择要采样的源单元格");
        return;
      }
      formatPainter.sample(startCell.style);
      dialogEl.classList.add("at-cursor-brush");
      showToast("格式刷已就绪：请点击目标单元格涂抹样式");
    });

    // 表头冻结与首列冻结
    dialogEl.querySelector("#at-btn-freeze-header")?.addEventListener("click", () => {
      pushHistory();
      isHeaderFrozen = !isHeaderFrozen;
      renderTable();
      showToast(isHeaderFrozen ? "已开启表头冻结 (Sticky)" : "已取消表头冻结");
    });

    dialogEl.querySelector("#at-btn-freeze-col")?.addEventListener("click", () => {
      pushHistory();
      isFirstColFrozen = !isFirstColFrozen;
      renderTable();
      showToast(isFirstColFrozen ? "已开启首列冻结 (Sticky)" : "已取消首列冻结");
    });

    // 初始化公式弹窗可拖拽与帮助浮窗
    const formulaModal = dialogEl.querySelector("#at-formulaModal") as HTMLElement;
    const formulaModalBox = dialogEl.querySelector("#at-formula-modal-box") as HTMLElement;
    const formulaModalHeader = dialogEl.querySelector("#at-formula-modal-header") as HTMLElement;
    const formulaInput = dialogEl.querySelector("#at-formula-input") as HTMLInputElement;
    const formulaPreview = dialogEl.querySelector("#at-formula-preview") as HTMLElement;
    const formulaHelpBtn = dialogEl.querySelector("#at-formula-help-btn") as HTMLElement;
    const formulaHelpPopover = dialogEl.querySelector("#at-formula-help-popover") as HTMLElement;

    function initDraggableModal(modalBox: HTMLElement, headerEl: HTMLElement, containerEl: HTMLElement) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      headerEl.addEventListener("mousedown", (e) => {
        if ((e.target as HTMLElement).closest(".at-help-wrapper, button, input")) return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = modalBox.getBoundingClientRect();
        const contRect = containerEl.getBoundingClientRect();

        initialLeft = rect.left - contRect.left;
        initialTop = rect.top - contRect.top;

        modalBox.style.left = `${initialLeft}px`;
        modalBox.style.top = `${initialTop}px`;
        modalBox.style.right = "auto";
        modalBox.style.bottom = "auto";
        modalBox.style.margin = "0";

        const onMouseMove = (ev: MouseEvent) => {
          if (!isDragging) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;

          let newLeft = initialLeft + dx;
          let newTop = initialTop + dy;

          newLeft = Math.max(10, Math.min(newLeft, contRect.width - rect.width - 10));
          newTop = Math.max(10, Math.min(newTop, contRect.height - rect.height - 10));

          modalBox.style.left = `${newLeft}px`;
          modalBox.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }

    if (formulaModalBox && formulaModalHeader) {
      initDraggableModal(formulaModalBox, formulaModalHeader, dialogEl.querySelector(".at-dialog-root") as HTMLElement);
    }

    formulaHelpBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (formulaHelpPopover) {
        formulaHelpPopover.style.display = formulaHelpPopover.style.display === "block" ? "none" : "block";
      }
    });

    function updateFormulaPreview() {
      const expr = formulaInput.value.trim();
      if (!expr) {
        formulaPreview.textContent = "-";
        return;
      }
      const res = evaluateFormula(expr, matrix);
      formulaPreview.textContent = res.error ? `错误: ${res.error}` : String(res.value);
    }

    formulaInput?.addEventListener("input", updateFormulaPreview);

    dialogEl.querySelectorAll("#at-formula-chips .at-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const fn = (chip as HTMLElement).dataset.fn;
        const bounds = getSelectionBounds();
        let defaultRange = "A1:A5";
        if (bounds) {
          const c1 = indexToColLetters(bounds.minC);
          const c2 = indexToColLetters(bounds.maxC);
          defaultRange = `${c1}${bounds.minR + 1}:${c2}${bounds.maxR + 1}`;
        }
        formulaInput.value = `=${fn}(${defaultRange})`;
        updateFormulaPreview();
      });
    });

    const openFormulaModal = () => {
      if (!startCell) {
        showToast("请先选择目标单元格");
        return;
      }
      showCoordinates = true;
      renderTable();

      if (formulaModalBox) {
        formulaModalBox.style.top = "60px";
        formulaModalBox.style.right = "40px";
        formulaModalBox.style.left = "auto";
        formulaModalBox.style.bottom = "auto";
      }

      formulaInput.value = startCell.content.startsWith("=") ? startCell.content : "=SUM(A1:A5)";
      formulaModal.style.display = "block";
      updateFormulaPreview();
      formulaInput.focus();
    };

    const closeFormulaModal = () => {
      formulaModal.style.display = "none";
      if (formulaHelpPopover) formulaHelpPopover.style.display = "";
      showCoordinates = false;
      renderTable();
    };

    dialogEl.querySelector("#at-btn-formula-quick")?.addEventListener("click", openFormulaModal);
    dialogEl.querySelector("#at-btn-cancel-formula")?.addEventListener("click", closeFormulaModal);
    dialogEl.querySelector("#at-btn-confirm-formula")?.addEventListener("click", () => {
      const expr = formulaInput.value.trim();
      if (!expr || !startCell) return;
      pushHistory();
      startCell.content = expr;
      closeFormulaModal();
      showToast("公式已插入并实时计算");
    });

    dialogEl.querySelector("#at-btn-insert-col-left")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertColLeft", t.r, t.c);
      showToast("已在左侧插入列");
    });
    dialogEl.querySelector("#at-btn-insert-col-right")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertColRight", t.r, t.c);
      showToast("已在右侧插入列");
    });
    dialogEl.querySelector("#at-btn-insert-row-above")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertRowAbove", t.r, t.c);
      showToast("已在上方插入行");
    });
    dialogEl.querySelector("#at-btn-insert-row-below")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      rebuildMatrix("insertRowBelow", t.r, t.c);
      showToast("已在下方插入行");
    });

    dialogEl.querySelector("#at-btn-delete-row")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (matrix.length <= 1) {
        showToast("无法删除最后一行");
        return;
      }
      rebuildMatrix("deleteRow", t.r, t.c);
      showToast("已删除当前行");
    });
    dialogEl.querySelector("#at-btn-delete-col")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (getMatrixColumnCount() <= 1) {
        showToast("无法删除最后一列");
        return;
      }
      rebuildMatrix("deleteCol", t.r, t.c);
      showToast("已删除当前列");
    });

    dialogEl.querySelector("#at-btn-move-row-up")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveRowUp(t.r)) {
        showToast("无法向上移动该行");
        return;
      }
      rebuildMatrix("moveRowUp", t.r, t.c);
      showToast("行已上移");
    });
    dialogEl.querySelector("#at-btn-move-row-down")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveRowDown(t.r)) {
        showToast("无法向下移动该行");
        return;
      }
      rebuildMatrix("moveRowDown", t.r, t.c);
      showToast("行已下移");
    });
    dialogEl.querySelector("#at-btn-move-col-left")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveColLeft(t.c)) {
        showToast("无法向左移动该列");
        return;
      }
      rebuildMatrix("moveColLeft", t.r, t.c);
      showToast("列已左移");
    });
    dialogEl.querySelector("#at-btn-move-col-right")?.addEventListener("click", () => {
      const t = getTargetRowCol();
      if (!canMoveColRight(t.c)) {
        showToast("无法向右移动该列");
        return;
      }
      rebuildMatrix("moveColRight", t.r, t.c);
      showToast("列已右移");
    });

    dialogEl.querySelector("#at-btn-merge")?.addEventListener("click", doMerge);
    dialogEl.querySelector("#at-btn-split")?.addEventListener("click", doSplit);

    dialogEl.querySelector("#at-btn-h-left")?.addEventListener("click", () => applyStyle("alignH", "align-h-left"));
    dialogEl.querySelector("#at-btn-h-center")?.addEventListener("click", () => applyStyle("alignH", "align-h-center"));
    dialogEl.querySelector("#at-btn-h-right")?.addEventListener("click", () => applyStyle("alignH", "align-h-right"));

    dialogEl.querySelector("#at-btn-v-top")?.addEventListener("click", () => applyStyle("alignV", "align-v-top"));
    dialogEl.querySelector("#at-btn-v-middle")?.addEventListener("click", () => applyStyle("alignV", "align-v-middle"));
    dialogEl.querySelector("#at-btn-v-bottom")?.addEventListener("click", () => applyStyle("alignV", "align-v-bottom"));

    const pickerEl = dialogEl.querySelector("#at-colorPicker") as HTMLElement;

    let activeColorBtn: HTMLElement | null = null;
    function positionColorPicker(btn: HTMLElement) {
      if (pickerEl.style.display === "block" && activeColorBtn === btn) {
        pickerEl.style.display = "none";
        activeColorBtn = null;
        return;
      }
      activeColorBtn = btn;

      const rect = btn.getBoundingClientRect();
      const rootEl = dialogEl.querySelector(".at-dialog-root") as HTMLElement;
      const rootRect = rootEl.getBoundingClientRect();

      let left = rect.left - rootRect.left;
      if (left + 160 > rootRect.width) {
        left = rootRect.width - 160;
      }

      let top = rect.bottom - rootRect.top + 4;
      if (top + 150 > rootRect.height) {
        top = rect.top - rootRect.top - 150 - 4;
      }

      pickerEl.style.left = left + "px";
      pickerEl.style.top = top + "px";
      pickerEl.style.display = "block";
    }

    dialogEl.querySelector("#at-btn-bg-color")?.addEventListener("click", (e) => {
      colorTarget = "background";
      positionColorPicker(e.currentTarget as HTMLElement);
    });

    dialogEl.querySelector("#at-btn-text-color")?.addEventListener("click", (e) => {
      colorTarget = "color";
      positionColorPicker(e.currentTarget as HTMLElement);
    });

    dialogEl.querySelector("#at-btn-clear")?.addEventListener("click", () => {
      const selectedMasters = getSelectedMasterCells();
      if (selectedMasters.length > 0) {
        pushHistory();
        selectedMasters.forEach((cell) => {
          cell.style = {
            bg: "",
            color: "",
            alignH: "align-h-left",
            alignV: "align-v-middle",
            fs: undefined,
            lh: undefined,
          };
          cell.content = sanitizeHtml(cell.content.replace(/<[^>]+>/g, ""));
        });
        renderTable();
        showToast("已清除所选单元格格式");
      }
    });

    dialogEl.querySelector("#at-fs-minus")?.addEventListener("click", () => adjustFontSize(-1));
    dialogEl.querySelector("#at-fs-plus")?.addEventListener("click", () => adjustFontSize(1));
    dialogEl.querySelector("#at-lh-minus")?.addEventListener("click", () => adjustLineHeight(-0.1));
    dialogEl.querySelector("#at-lh-plus")?.addEventListener("click", () => adjustLineHeight(0.1));
    dialogEl.querySelector("#at-bw-minus")?.addEventListener("click", () => adjustBorderWidth(-0.1));
    dialogEl.querySelector("#at-bw-plus")?.addEventListener("click", () => adjustBorderWidth(0.1));
    dialogEl.querySelector("#at-pad-minus")?.addEventListener("click", () => adjustPaddingWidth(-1));
    dialogEl.querySelector("#at-pad-plus")?.addEventListener("click", () => adjustPaddingWidth(1));

    dialogEl.querySelector("#at-btn-reset-globals")?.addEventListener("click", resetGlobalParams);

    const setupNumericInput = (id: string, getValue: () => number, setValue: (v: number) => void) => {
      const inputEl = dialogEl.querySelector(id) as HTMLInputElement | null;
      if (!inputEl) return;
      const commit = () => {
        const parsed = parseFloat(inputEl.value);
        if (isNaN(parsed)) {
          inputEl.value = String(getValue());
        } else {
          setValue(parsed);
        }
      };
      inputEl.addEventListener("change", commit);
      inputEl.addEventListener("blur", commit);
      inputEl.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          inputEl.blur();
        }
      });
      inputEl.addEventListener("keyup", (e) => e.stopPropagation());
    };

    setupNumericInput("#at-lh-val", () => lineHeight, setLineHeight);
    setupNumericInput("#at-bw-val", () => borderWidth, setBorderWidth);
    setupNumericInput("#at-pad-val", () => paddingWidth, setPaddingWidth);
    setupNumericInput("#at-fs-val", () => selectedCaption ? captionStyle.fontSize : (getMasterCell(getSelectionBounds()?.minR ?? 0, getSelectionBounds()?.minC ?? 0)?.style.fs || fontSize), setFontSize);

    dialogEl.querySelector("#at-btn-copy")?.addEventListener("click", () => {
      const code = generateCleanHtml();
      navigator.clipboard.writeText(code).then(() => {
        showToast("HTML 代码已复制到剪贴板");
      });
    });

    const importModal = dialogEl.querySelector("#at-importModal") as HTMLElement;
    dialogEl.querySelector("#at-btn-import")?.addEventListener("click", () => {
      importModal.style.display = "flex";
    });
    dialogEl.querySelector("#at-btn-cancel-import")?.addEventListener("click", () => {
      importModal.style.display = "none";
    });
    dialogEl.querySelector("#at-btn-confirm-import")?.addEventListener("click", () => {
      const textarea = dialogEl.querySelector("#at-importCode") as HTMLTextAreaElement;
      let code = textarea.value.trim();
      if (!code) return;

      if (!/<table[\s>]/i.test(code)) {
        const mdHtml = markdownToHtmlTable(code);
        if (mdHtml) code = mdHtml;
      }

      try {
        const normalized = normalizeHtmlTable(code);
        const doc = new DOMParser().parseFromString(normalized, "text/html");
        const tableEl = doc.querySelector("table");
        if (!tableEl) {
          alert("未检测到有效的 <table> 标签或 Markdown 表格");
          return;
        }

        pushHistory();
        parseMatrixFromDOMTable(tableEl);
        resetSelection();
        renderTable();
        importModal.style.display = "none";
        showToast("代码导入成功");
      } catch (err: any) {
        alert("导入失败: " + err.message);
      }
    });

    const contextMenu = dialogEl.querySelector("#at-contextMenu") as HTMLElement;
    let contextTarget: { r: number; c: number } | null = null;

    table.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const td = (e.target as HTMLElement).closest("td, th");
      if (!td) return;

      const r = td.getAttribute("data-row") ? parseInt(td.getAttribute("data-row")!, 10) : -1;
      const c = td.getAttribute("data-col") ? parseInt(td.getAttribute("data-col")!, 10) : -1;
      if (r < 0 || c < 0) return;

      contextTarget = { r, c };

      const bounds = getSelectionBounds();
      const cell = matrix[r]?.[c];
      if (cell) {
        if (!bounds || r < bounds.minR || r > bounds.maxR || c < bounds.minC || c > bounds.maxC) {
          startCell = cell;
          endCell = cell;
          selectedCaption = false;
          updateSelectionView();
        }
      }

      const itemMerge = contextMenu.querySelector('[data-action="merge"]');
      const itemSplit = contextMenu.querySelector('[data-action="split"]');
      const itemMoveUp = contextMenu.querySelector('[data-action="moveRowUp"]');
      const itemMoveDown = contextMenu.querySelector('[data-action="moveRowDown"]');
      const itemMoveLeft = contextMenu.querySelector('[data-action="moveColLeft"]');
      const itemMoveRight = contextMenu.querySelector('[data-action="moveColRight"]');

      if (itemMerge) itemMerge.classList.toggle("disabled", !canMergeSelection());
      if (itemSplit) itemSplit.classList.toggle("disabled", !(startCell && (startCell.rowSpan > 1 || startCell.colSpan > 1)));
      if (itemMoveUp) itemMoveUp.classList.toggle("disabled", !canMoveRowUp(r));
      if (itemMoveDown) itemMoveDown.classList.toggle("disabled", !canMoveRowDown(r));
      if (itemMoveLeft) itemMoveLeft.classList.toggle("disabled", !canMoveColLeft(c));
      if (itemMoveRight) itemMoveRight.classList.toggle("disabled", !canMoveColRight(c));

      const menuWidth = 170;
      const menuHeight = 440;
      let left = e.clientX;
      let top = e.clientY;
      if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
      if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8;

      contextMenu.style.display = "block";
      contextMenu.style.left = left + "px";
      contextMenu.style.top = top + "px";
    });

    contextMenu.querySelectorAll(".at-menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        if ((item as HTMLElement).classList.contains("disabled")) return;
        const action = (item as HTMLElement).dataset.action;
        if (!action) return;

        if (action === "merge") {
          doMerge();
        } else if (action === "split") {
          doSplit();
        } else if (action === "alignCenter") {
          applyStyle("alignH", "align-h-center");
          applyStyle("alignV", "align-v-middle");
        } else if (action === "autofit") {
          autoFitTable();
        } else if (action === "formatPainter") {
          if (startCell) {
            formatPainter.sample(startCell.style);
            dialogEl.classList.add("at-cursor-brush");
            showToast("格式刷已就绪：请点击目标单元格");
          }
        } else if (action === "formula") {
          openFormulaModal();
        } else if (action === "smartFill") {
          dialogEl.querySelector("#at-btn-smart-fill")?.dispatchEvent(new MouseEvent("click"));
        } else if (action === "dupRow" && contextTarget) {
          pushHistory();
          matrix = duplicateRowAt(matrix, contextTarget.r);
          renderTable();
          showToast("已复制该行");
        } else if (action === "dupCol" && contextTarget) {
          pushHistory();
          matrix = duplicateColAt(matrix, contextTarget.c);
          renderTable();
          showToast("已复制该列");
        } else if (action === "sortAsc" && contextTarget) {
          pushHistory();
          matrix = sortMatrixByCol(matrix, contextTarget.c, true, true);
          renderTable();
          showToast("已升序排列");
        } else if (action === "sortDesc" && contextTarget) {
          pushHistory();
          matrix = sortMatrixByCol(matrix, contextTarget.c, false, true);
          renderTable();
          showToast("已降序排列");
        } else if (action === "clearStyle") {
          const selectedMasters = getSelectedMasterCells();
          if (selectedMasters.length > 0) {
            pushHistory();
            selectedMasters.forEach((c) => {
              c.style = {
                bg: "",
                color: "",
                alignH: "align-h-left",
                alignV: "align-v-middle",
                fs: undefined,
                lh: undefined,
              };
              c.content = sanitizeHtml(c.content.replace(/<[^>]+>/g, ""));
            });
            renderTable();
            showToast("已清除样式");
          }
        } else if (action === "copyCellContent") {
          const selectedMasters = getSelectedMasterCells();
          const txt = selectedMasters.map((c) => c.content.replace(/<[^>]+>/g, "").trim()).join("\t");
          navigator.clipboard.writeText(txt).then(() => showToast("已复制文本"));
        } else if (contextTarget) {
          rebuildMatrix(action, contextTarget.r, contextTarget.c);
        }
        contextMenu.style.display = "none";
      });
    });

    document.addEventListener("click", (e) => {
      const target = e.target as Node;
      if (contextMenu && !contextMenu.contains(target)) {
        contextMenu.style.display = "none";
      }
      if (pickerEl && pickerEl.style.display === "block") {
        const btnBg = dialogEl.querySelector("#at-btn-bg-color");
        const btnText = dialogEl.querySelector("#at-btn-text-color");
        if (!pickerEl.contains(target) && !btnBg?.contains(target) && !btnText?.contains(target)) {
          pickerEl.style.display = "none";
        }
      }
    });

    dialogEl.querySelector("#at-btn-dialog-cancel")?.addEventListener("click", () => {
      dialog.destroy();
    });

    dialogEl.querySelector("#at-btn-dialog-save")?.addEventListener("click", async () => {
      const cleanHtml = generateCleanHtml();
      try {
        await te.saveHtmlTable(cleanHtml);
        showMessage("HTML 表格保存更新成功！");
        dialog.destroy();
      } catch (err) {
        logger.error("Save HTML Table failed:", err);
        showMessage("保存更新失败，请重试");
      }
    });
  }

  parseMatrixFromDOMTable(tableClone);
  initColorPicker();
  renderTable();
  bindEvents();
  updateHistoryButtons();
}
