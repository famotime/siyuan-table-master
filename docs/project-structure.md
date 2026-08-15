# 项目结构与架构索引

> 生成日期：2026-08-15（代码重构与架构优化后全面刷新）

## 1. 源码架构 `src/`

### 1.1 核心层与 Markdown 表格引擎
| 文件 | 职责说明 | 依赖 |
| --- | --- | --- |
| `index.ts` | 插件主入口：生命周期（加载/卸载）、设置面板初始化、全局事件与命令注册 | settings, commands, dock, floating-toolbar, smart-paste, quick-calc, drag-reorder, html-floating-toolbar |
| `siyuan-text-editor.ts` | **核心适配器**：实现 `ITextEditor` 接口，维护内存行模型与块 IAL 绑定，提供行增删改查与游标推演 | table-model, dom-utils, siyuan, logger |
| `table-editor.ts` | 核心库 Facade：封装 `@tgrosinger/md-advanced-tables` 表格操作（格式化、导航、对齐、排序、求和、转置、行列剪切粘贴） | @tgrosinger/md-advanced-tables, siyuan-text-editor, html-to-md, confirm-dialog |
| `table-model.ts` | **表格数据纯函数**：Kramdown 与二维矩阵转换、对齐标志解析、分隔行判定、行列批量删除算法 | 无外部依赖 |
| `commands.ts` | 20+ 基础与扩展表格命令注册表与集中分发调度器（含统一上下文提取 `resolveTableBlockAndId`） | table-editor, siyuan-text-editor, table-model, table-export, text-to-table, table-to-chart, table-to-db-dialog |

### 1.2 HTML 复杂表格引擎
| 文件 | 职责说明 | 依赖 |
| --- | --- | --- |
| `html-dialog-editor.ts` | HTML 复杂表格可视化弹窗编辑器（撤销重做、单元格合并/拆分、边框/内边距/字体/对齐/样式面板） | html-dialog-utils, html-table-editor, html-to-md, dom-utils, logger |
| `html-dialog-utils.ts` | **HTML 弹窗纯函数**：Markdown ↔ HTML 互转、HTML 净化、单元格样式剥离与正跨度解析 | 无外部依赖 |
| `html-floating-toolbar.ts` | HTML 块悬浮激活工具栏：检测鼠标悬浮 HTML 块并展示“进入复杂表格编辑器”入口 | dom-utils, html-dialog-editor, html-table-editor |
| `html-table-editor.ts` | HTML 表格块读取与异步写入器（`getBlockKramdown` / `updateBlock`） | siyuan, logger |
| `html-to-md.ts` | **HTML 转原生表格算法**：复杂 HTML 表格（含跨行跨列合并）向思源原生 Kramdown 表格转换 | dom-utils, logger |
| `html-commands.ts` | HTML 复杂表格快捷命令定义与执行 | html-dialog-editor, html-table-editor, html-to-md |

### 1.3 交互与用户体验层
| 文件 | 职责说明 | 依赖 |
| --- | --- | --- |
| `dock.ts` | 侧栏高级表格工具箱：操作按钮、对齐工具、快捷公式、统计图表、数据库转换与示例模板面板 | commands, siyuan-text-editor, dom-utils, settings |
| `floating-toolbar.ts` | Markdown 原生表格光标跟随浮动工具栏 | commands, dom-utils, table-editor |
| `drag-reorder.ts` | 现代化行列拖拽重排手柄与视觉指示线（含视口越界阻尼与多列拖动推演） | siyuan-text-editor, table-model, dom-utils |
| `quick-calc.ts` | Alt+拖拽多单元格即时统计条（计数、数值求和、平均值计算） | utils/number-utils, dom-utils, dock |
| `smart-paste.ts` | 剪贴板 HTML/TSV 智能解析与区域粘贴覆盖 / 空行表格导入 | text-to-table-utils, siyuan-text-editor, dom-utils |
| `dom-utils.ts` | DOM 操作工具：表格块查找、选区 ↔ 单元格坐标映射、十字高亮、HTML 转义 | 无外部依赖 |

### 1.4 格式转换与数据衍生
| 文件 | 职责说明 | 依赖 |
| --- | --- | --- |
| `table-to-chart.ts` | 表格转 ECharts 图表 UI 交互弹窗与代码块生成 | table-to-chart-utils, siyuan |
| `table-to-chart-utils.ts` | **图表生成纯函数**：柱状图/折线图/面积图/饼图 Option 生成、双 Y 轴智能量纲识别 | 无外部依赖 |
| `table-to-db-dialog.ts` | 表格转思源数据库 (Attribute View) 可视化配置弹窗 | table-to-db-utils, siyuan |
| `table-to-db-utils.ts` | **数据库转换纯函数**：字段类型推断（文本/数值/日期/单选/多选/复选框/URL）与 Payload 构造 | 无外部依赖 |
| `table-export.ts` | 表格导出为 CSV / XLSX 格式 | xlsx, dom-utils |
| `text-to-table.ts` | 纯文本转表格交互弹窗与分词插入 | text-to-table-utils, siyuan |
| `text-to-table-utils.ts` | **文本转表格纯函数**：分隔符识别、Box-Drawing 字符过滤、Markdown 网格序列化 | dom-utils |
| `sample-tables.ts` | 示例 Markdown / HTML 复杂表格数据源生成器 | dom-utils, siyuan |

### 1.5 类型、工具与样式体系
| 文件 | 职责说明 |
| --- | --- |
| `types/index.ts` | 统一导出核心接口与类型（`CellCoord`, `TableCommand`, `Snapshot`, `CellStyle`, `EchartsOptionConfig`, `ParsedNumber` 等） |
| `utils/index.ts` | 统一再导出各领域的无副作用纯函数工具，提供清晰的命名空间访问 |
| `utils/number-utils.ts` | **数值处理纯函数**：千分位、百分比、负数与浮点数解析（`parseNumber`）与高精度格式化（`formatResult`） |
| `utils/icons.ts` | 统一 SVG 图标定义（Lucide & Tabler 矢量图标库） |
| `settings.ts` | 插件配置项（`PluginSettings`）定义与持久化辅助 |
| `logger.ts` | 统一分级控制台日志打印器 |
| `confirm-dialog.ts` | 危险操作/覆盖粘贴确认模态框 |
| `index.scss` | 插件主样式：设计 Token、Dock 侧栏、浮动工具栏、拖拽指示线、即时计算条 |
| `html-dialog.scss` | HTML 复杂表格可视化弹窗编辑器独立样式模块（通过 `@use` 引入打包） |

---

## 2. 单元测试 `__tests__/`

全套 17 个测试套件，共 223 个测试用例，覆盖所有纯函数算法与核心组件：

| 测试套件 | 测试数 | 覆盖核心模块 |
| --- | --- | --- |
| `table-model.test.ts` | 33 | Kramdown 表格解析、序列化、行拆分、对齐判定 |
| `kramdown-roundtrip.test.ts` | 32 | Kramdown 往返转换与格式保真度 |
| `text-to-table.test.ts` | 25 | 文本转表格（TSV/CSV/空格/Box-Drawing）纯函数 |
| `core-library.test.ts` | 21 | 核心库适配集成（`InMemoryTextEditor` 驱动） |
| `delete-multiple.test.ts` | 16 | 批量删除选中行/列纯函数算法 |
| `html-dialog-utils.test.ts` | 15 | HTML 净化、样式剥离、Markdown ↔ HTML 互转 |
| `html-to-md.test.ts` | 13 | HTML 复杂跨行跨列表格转原生 Markdown 表格 |
| `quick-calc.test.ts` | 12 | 数值解析（`number-utils`：千分位/百分比/浮点数）与格式化 |
| `sum-cells.test.ts` | 10 | 单元格求和纯函数（混合量纲与千分位处理） |
| `table-to-db-utils.test.ts` | 9 | 数据库字段类型智能推断与 API 数据构造 |
| `table-to-chart-utils.test.ts` | 8 | ECharts 图表 Option 生成与单/双 Y 轴智能判定 |
| `table-export.test.ts` | 7 | CSV / XLSX 导出文本过滤与提取 |
| `clipboard-operations.test.ts` | 7 | 行列复制、剪切、粘贴纯数据操作 |
| `split-all-cells.test.ts` | 6 | 合并单元格一键拆分还原 |
| `dom-utils.test.ts` | 5 | 单元格坐标与 HTML 转义纯函数 |
| `settings.test.ts` | 2 | 默认配置完整性与校验 |
| `resize-table.test.ts` | 2 | 表格宽高自适应逻辑 |
| **合计** | **223** | **全线通过 (100%)** |

---

## 3. 数据流与分层架构

```
[Markdown 原生表格链路]
用户触发 / 快捷键 / UI
  ↓
commands.ts (resolveTableBlockAndId)
  ↓
SiyuanTextEditor (ITextEditor 内存行模型) ↔ table-model.ts (纯函数解析/序列化)
  ↓                                              ↑ (reload: GET /api/block/getBlockKramdown)
TableEditor (Facade)                             ↓ (flush: POST /api/block/updateBlock)
  ↓
@tgrosinger/md-advanced-tables (核心计算引擎)

[HTML 复杂表格链路]
HtmlFloatingToolbar / Dock
  ↓
HtmlDialogEditor (可视化弹窗) ↔ html-dialog-utils.ts (纯函数 HTML ↔ MD 互转/净化)
  ↓
HtmlTableEditor ↔ html-to-md.ts (复杂表格转原生表格)
  ↓ (POST /api/block/updateBlock)
思源块存储
```

---

## 4. 依赖层级图

```
@tgrosinger/md-advanced-tables (外部核心库)
       ↑
 [纯函数工具层 - 零副作用、100%单测覆盖]
  ├─ table-model.ts
  ├─ html-dialog-utils.ts
  ├─ table-to-chart-utils.ts
  ├─ table-to-db-utils.ts
  ├─ text-to-table-utils.ts
  ├─ utils/number-utils.ts
  └─ dom-utils.ts
       ↑
 [领域模型与适配层]
  ├─ types/index.ts
  ├─ siyuan-text-editor.ts
  ├─ html-to-md.ts
  ├─ table-editor.ts
  └─ html-table-editor.ts
       ↑
 [交互与组件层]
  ├─ commands.ts & html-commands.ts
  ├─ dock.ts & floating-toolbar.ts & html-floating-toolbar.ts
  ├─ drag-reorder.ts & quick-calc.ts & smart-paste.ts
  ├─ html-dialog-editor.ts & table-to-db-dialog.ts & text-to-table.ts
  └─ table-to-chart.ts & table-export.ts & sample-tables.ts
       ↑
 [插件入口与样式层]
  ├─ index.ts
  └─ index.scss (@use html-dialog.scss)
```
