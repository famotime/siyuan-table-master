# 🔍 Table Master (表哥) 插件 UX 优化与国际化改造方案

本方案旨在全面落实 UX 审计报告中的优化建议，并根据您的 comments 实施细化设计。改造涵盖工程规范、设计 Token 化、交互体验、国际化四个核心维度，从而将插件的整体使用质感提升至应用级水平。

## User Review Required

> [!IMPORTANT]
> **设计细节与用户采用项说明**
> - **浮动工具栏采用项**：按照您的反馈，**拒绝方案 A**（固定核心按钮），**采纳方案 B**（光标在表头/非表头切换时的微渐变动画）与**采纳方案 C**（增加小型上下文标签，显示“表头”/“行M列N”）。
> - **品牌名称统一**：统一将插件的中文品牌名设定为 **“表哥”**，英文/正式名称为 **“Table Master”**。这会涉及 `plugin.json` 中的 `displayName`，以及 `index.ts`、`dock.ts` 中的文案调整。

---

## Open Questions

> [!NOTE]
> 暂无阻塞性悬疑问题。我们将全面按照已批准的 UX 报告及以下细化方案执行。

---

## Proposed Changes

### 1. 样式与 Token 集中化 (`src/index.scss`)

我们将在 `src/index.scss` 的顶部定义统一的排版、间距、圆角、层叠与动画 Token：

```scss
// ── 设计系统 Token ──

// 1. Z-Index 层叠 Token
$z-table-sticky: 2;        // 表格内部 cell/sticky
$z-floating-toolbar: 20;   // 浮动工具栏 (控制在 2-100 内以避免遮挡宿主应用弹窗)
$z-drag-handle: 25;        // 拖拽手柄
$z-drag-indicator: 30;     // 拖拽指示线
$z-quick-calc: 35;         // 即时计算条
$z-overlay: 100;           // 弹窗遮罩层

// 2. 圆角 Token (统一为三级)
$radius-sm: 4px;    // 按钮、小输入框
$radius-md: 8px;    // 卡片、工具栏容器、对话框
$radius-pill: 20px; // 胶囊型即时计算条

// 3. 间距 Token (基于 4px 基准网格)
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 12px;
$spacing-lg: 16px;
$spacing-xl: 24px;

// 4. 排版 Token
$text-xs: 10px;     // 辅助/指示文字 (如浮动工具栏 context)
$text-sm: 12px;     // 次级文字、计算条
$text-base: 13px;   // 主体文字、表单标签
$text-lg: 14px;     // 组标题

$leading-tight: 1.4;
$leading-normal: 1.5;
$leading-relaxed: 1.6;

// 5. 动画 Token
$duration-fast: 0.12s;    // 悬停反馈、微小过渡
$duration-normal: 0.22s;  // 状态切换、工具栏显隐
$duration-slow: 0.3s;     // 出入场大动画
$easing-default: cubic-bezier(0.25, 0.8, 0.25, 1);
```

#### [MODIFY] [index.scss](file:///d:/MyCodingProjects/siyuan-table-master/src/index.scss)
- 引入上述 Token。
- 替换所有硬编码的 `z-index` (226, 314, 322, 332, 348, 388, 430) 为对应的 Token 变量。
- 将 `.at-drag-handle` 默认 `opacity: 0.3` 提高到 `opacity: 0.5`，hover 为 `opacity: 1.0`。
- 将内联在 HTML 中的 Dialog 样式（confirm-dialog, text-to-table, table-to-chart）和 Dock 样式抽离为 CSS classes。

---

### 2. 浮动工具栏动效与上下文标签 (`src/floating-toolbar.ts`)

#### [MODIFY] [floating-toolbar.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/floating-toolbar.ts)
- **重构 DOM 结构**：在 container 下面生成 `this.contextTag` 和 `this.buttonsWrapper`。
- **引入切换动效**：保存 `lastRowIdx`。当 `row !== lastRowIdx` 且工具栏本就可见时，执行渐隐 -> 更新数据/reposition -> 渐显的 120ms 微过渡动效，使按钮变化不再突兀。
- **上下文标签**：读取当前行 `rowIdx`：
  - 如果为 0，展示“表头” (i18n.toolbarHeader)；
  - 如果为非 0，展示“第 N 行” (i18n.toolbarRow)。
- **国际化适配**：按钮提示及粘性表头操作等文案迁移到 `plugin.i18n`。
- **ARIA 无障碍**：添加 `role="toolbar"` 和 `aria-label` 属性。

---

### 3. 即时计算退场动画与样式提取 (`src/quick-calc.ts`)

#### [MODIFY] [quick-calc.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/quick-calc.ts)
- **退场动画**：在 `hideCalcBar()` 中，不直接 remove，而是先把 opacity 设为 "0"，transform 设为 "translateX(-50%) translateY(8px)"，在 200ms 的 `setTimeout` 动画结束后再执行真实的 DOM `remove()`。
- **Dock 同步卡片**：去除 HTML 拼装中的大量内联样式，改用 `.at-dock-calc-*` 的 CSS 类控制。
- **国际化适配**：将“已选中多单元格”、“选区范围”、“数值个数”、“求和”等文案移入 i18n 系统。

---

### 4. 其它 Dialog 与 Dock 内联样式提取及国际化

#### [MODIFY] [confirm-dialog.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/confirm-dialog.ts)
- 提取并接收 `i18n` 参数。
- 移除所有内联 style，全量改用 SCSS classes。
- 转换所有硬编码中文到 `i18n` (如 "确认覆盖", "取消")。

#### [MODIFY] [text-to-table.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/text-to-table.ts)
- 移除 HTML 模版字符串和预览 table 里的所有 inline styles，移至 SCSS。
- 提取所有硬编码中文提示和标签。

#### [MODIFY] [table-to-chart.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/table-to-chart.ts)
- 移除配置面板内的大量内联样式，移至 SCSS。
- 提取多达十几处硬编码中文（“柱状图”、“折线图”、“饼图模式只支持单选”、“图表标题”等）到国际化语言文件。

#### [MODIFY] [dock.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/dock.ts)
- 品牌统一：使用 `Table Master` / `表哥`。
- 移除“文本转表格”按钮和状态面板内的 inline styles，改用 SCSS 统一控制。
- 优化 SVG path 的 `style="fill:none!important"` 冗余定义，提取到 SCSS 级覆盖。
- 引导优化：将默认状态提示修改为支持快捷键引导的 i18n 文字，如 `"提示：将光标移动至表格中开始编辑。按住 Alt + 鼠标拖选可多选计算。"`。

#### [MODIFY] [drag-reorder.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/drag-reorder.ts)
- 加上 `ariaLabel` 并配置 `aria-label` 指向 i18n，使用户 hover 拖拽手柄时能出现原生 Tooltip 提示，显著提高该功能的可发现性。

#### [MODIFY] [index.ts](file:///d:/MyCodingProjects/siyuan-table-master/src/index.ts)
- 右键上下文菜单文案 `"将文本转换为表格"` 支持 i18n 替换。
- 统一 `settingsTitle` 拼写为 `"Table Master Settings"`。

---

### 5. 语言包注入与脚手架清理

#### [MODIFY] [src/i18n/zh_CN.json](file:///d:/MyCodingProjects/siyuan-table-master/src/i18n/zh_CN.json) & [src/i18n/en_US.json](file:///d:/MyCodingProjects/siyuan-table-master/src/i18n/en_US.json)
- 在原有的 JSON 文件中，集中扩充以上提到的约 30+ 处新抽离的国际化键值对（中/英双语）。

#### [DELETE] [App.vue](file:///d:/MyCodingProjects/siyuan-table-master/src/App.vue)
- 彻底移除此脚手架残留的 Vue 文件。

#### [DELETE] [components](file:///d:/MyCodingProjects/siyuan-table-master/src/components)
- 彻底移除 `src/components/SiyuanTheme/` 目录下的 Vue 组件。

---


## Verification Plan

### Automated Tests
- 在每次重构主要步骤后运行：`npm test`
- 确保测试套件 (包含 103 个测试) 处于全通状态，逻辑没有任何退化。

### Manual Verification
- 执行 `npm run build`，确保 Vite 编译无错。
- 在思源开发环境下，检查浮动工具栏切换时的微渐隐动效，确保 context label 正确显示“表头” / “第 N 行”。
- 检查框选计算条的渐隐退场动画。
- 鼠标悬浮拖拽重排手柄，查看是否有思源原生的 Tooltip 悬停提示。
- 临时切换思源系统语言至“English”，验证所有弹窗、工具栏、提示区域的国际化译文显示正确。
