# 重构计划

## 1. 项目快照

- 生成日期：2026-08-15
- 范围：siyuan-table-master 全仓库（`src/` + `__tests__/`）
- 目标：解耦超大模块、提取纯函数与计算算法并补齐单元测试、消除跨模块代码重复与死代码、建立规范类型层，提升代码健壮性与可维护性
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`AGENTS.md`、`CLAUDE.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| HTML 弹窗编辑器 | `src/html-dialog-editor.ts` | 复杂 HTML 表格可视化编辑（合并/拆分/样式/导入导出） | 2700+ 行超大单体文件，内嵌纯算法（MD↔HTML 表格转换、HTML 净化、单元格排布计算）与 300+ 行内联 CSS，未独立测试 | 仅 `html-to-md.test.ts` 覆盖部分转换，弹窗核心解析算法无测试 |
| 图表生成器 | `src/table-to-chart.ts` | 将表格转换为 ECharts 代码块 | `buildEchartsOption` / 双 Y 轴判定 / 百分比检测等纯函数算法内嵌在 UI 弹窗文件中，无法独立测试 | 无独立单元测试 |
| 即时计算与数值处理 | `src/quick-calc.ts`, `src/text-to-table-utils.ts`, `src/table-editor.ts` | 选区求和、平均值、数值清洗 | `parseNumber` / `formatResult` 为私有方法，单测依赖 `(quickCalc as any)`；数值净化逻辑存在多处相似实现 | 有部分单测，但存在 `as any` 访问私有方法的坏味道 |
| 表格核心封装 | `src/table-editor.ts` | 核心库操作转发、粘贴求和、HTML 转译 | 800+ 行，含 ~60 行未被任何地方调用的死代码（`removeHtmlTableMergeAttributes`）；HTML 转换函数与核心库转发职责混杂 | 有 4 个测试套件覆盖核心操作 |
| 智能粘贴与命令编排 | `src/smart-paste.ts`, `src/commands.ts` | 剪贴板表格解析填充、全局与 Dock 命令分发 | `smart-paste.ts` 重复实现了 `gridToMarkdown` 与 `parseTsv`；`commands.ts` 中 4 处重复表格上下文探测代码，`parseMarkdownTableLines` 简陋且未处理转义 | 有 clipboard 测试，commands 无单独测试 |
| 类型层与共享工具 | `src/types/`, `src/utils/`, `src/html-to-md.ts` | 跨模块类型定义与通用工具 | `src/types/` 为空目录，核心类型散落在各文件；`html-to-md.ts` 重复定义 `escapeHtml` | 有 dom-utils 测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 图表生成算法纯函数抽离 | `src/table-to-chart-utils.ts`（新建）, `src/table-to-chart.ts`, `__tests__/table-to-chart-utils.test.ts`（新建） | 抽离 `buildEchartsOption`、`isPercentCol`、双 Y 轴智能判定、饼图/折线/柱状图 Option 生成为纯函数，编写完整单测 | 低 | ✅ 柱状图/折线图单 Y 轴 Option 生成；✅ 混合量纲（百分比+数值）双 Y 轴映射；✅ 饼图数据格式化；✅ 极差倍数差自动双轴判定 | `docs/project-structure.md`：新增 table-to-chart-utils 说明 | done |
| RF-002 | P0 | HTML 弹窗核心算法纯函数抽离 | `src/html-dialog-utils.ts`（新建）, `src/html-dialog-editor.ts`, `__tests__/html-dialog-utils.test.ts`（新建） | 抽离 `markdownToHtmlTable`、`parseMdCell`、`splitMdRow`、`mdInline`、`sanitizeHtml`、`stripSpanStyle`、`createCell` 为独立纯函数并覆盖单测，消除与 `table-model.ts` 重复 | 中 | ✅ Markdown 表格转 HTML（含对齐、行合并、列合并、样式标记）；✅ HTML 标签净化与样式剥离；✅ 特殊转义字符处理 | `docs/project-structure.md`：新增 html-dialog-utils 说明 | done |
| RF-003 | P0 | 数值解析与格式化工具抽离 | `src/utils/number-utils.ts`（新建）, `src/quick-calc.ts`, `__tests__/quick-calc.test.ts` | 提取 `parseNumber` 与 `formatResult` 为纯函数工具，消除 `quick-calc.test.ts` 中的 `(quickCalc as any)` 坏味道 | 低 | ✅ 纯数字/浮点数/负数解析；✅ 千分位、百分比、千分位百分比解析；✅ 零值与非法字符串处理；✅ 结果格式化（保留小数、千分位、百分比） | `docs/project-structure.md`：更新 utils 说明 | done |
| RF-004 | P1 | TableEditor 瘦身与死代码清理 | `src/table-editor.ts`, `src/html-to-md.ts` | 清除死代码 `removeHtmlTableMergeAttributes`；将 `convertHtmlTableToMarkdownKramdown` 归入 `html-to-md.ts` | 低 | ✅ HTML 表格转 Kramdown 行数组正确性；✅ 行列复制粘贴与求和不变；✅ 现有 223 项测试全部通过 | `docs/project-structure.md`：table-editor 职责精简 | done |
| RF-005 | P1 | 智能粘贴与命令分发去重 | `src/smart-paste.ts`, `src/commands.ts` | ① `smart-paste.ts` 复用 `text-to-table-utils.ts` 的 `gridToMarkdown` 与 `parseLines`；② `commands.ts` 提取 `resolveTableBlockAndId` 统一上下文探测，复用 `table-model.ts` 的 `splitTableRow` | 低 | ✅ 智能粘贴 TSV/HTML 区域填充；✅ 空行转 Markdown 表格；✅ 各类全局与 Dock 命令上下文解析 | `docs/project-structure.md`：更新 commands / smart-paste 描述 | done |
| RF-006 | P1 | 类型层规范化与共享工具统一 | `src/types/index.ts`（新建）, `src/html-to-md.ts`, `src/utils/index.ts` | 在 `src/types/index.ts` 统一定义与导出核心公共接口；完善 `src/utils/index.ts` 命名空间工具再导出；统一 `escapeHtml` 引用 | 低 | ✅ TypeScript 编译零错误；✅ 所有导出类型正确生效；✅ 223 项测试全部通过 | `docs/project-structure.md`：新增 types 目录说明与 utils 扩展说明 | done |
| RF-007 | P2 | HTML 弹窗样式与结构优化 | `src/html-dialog-editor.ts`, `src/html-dialog.scss`（新建）, `src/index.scss` | 将 `html-dialog-editor.ts` 中内嵌的 500+ 行大段 CSS 模板抽离为独立的 `src/html-dialog.scss` 并统一打包，进一步压缩单体文件体积 | 低 | ✅ `npm run build` 构建成功；✅ 样式零退化；✅ 223 项测试全部通过 | `docs/project-structure.md`：更新 html-dialog-editor / 样式架构说明 | done |

优先级说明：
- `P0`：核心计算与解析算法抽离，强化单元测试，价值与覆盖率收益最高
- `P1`：消除跨模块重复与死代码，统一类型层与工具导入，提升可维护性
- `P2`：样式与大文件模板结构优化

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-08-15 | 2026-08-15 | `npm test -- table-to-chart-utils` | 8 通过（+8 新增单测） | `docs/project-structure.md` | 提取 `table-to-chart-utils.ts` 纯函数模块 |
| RF-002 | 2026-08-15 | 2026-08-15 | `npm test -- html-dialog-utils` | 15 通过（+15 新增单测） | `docs/project-structure.md` | 提取 `html-dialog-utils.ts` 纯函数模块 |
| RF-003 | 2026-08-15 | 2026-08-15 | `npm test -- quick-calc` | 12 通过 | `docs/project-structure.md` | 提取 `number-utils.ts` 纯函数模块，重构单测 |
| RF-004 | 2026-08-15 | 2026-08-15 | `npm test` | 223 全部通过 | `docs/project-structure.md` | 清理 dead code，归拢 HTML 转译至 html-to-md.ts |
| RF-005 | 2026-08-15 | 2026-08-15 | `npm test` | 223 全部通过 | `docs/project-structure.md` | smart-paste 与 commands 去重与统一上下文解析 |
| RF-006 | 2026-08-15 | 2026-08-15 | `npm run build && npm test` | build 成功，223 测试全部通过 | `docs/project-structure.md` | 创建 `src/types/index.ts`，扩展 `src/utils/index.ts` |
| RF-007 | 2026-08-15 | 2026-08-15 | `npm run build && npm test` | build 成功，223 测试全部通过 | `docs/project-structure.md` | 抽离 `src/html-dialog.scss`，清理内嵌 CSS 字符串 |

## 5. 决策与确认

- 用户批准的条目：全部批准（RF-001 ~ RF-007）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：✅ 已刷新（更新所有 28 个源码文件与 17 个测试套件结构）
- `README.md`：✅ 已检查（功能特性与配置一致）
- `AGENTS.md`：✅ 已刷新（更新最新测试用例清单与架构数据流）
- `CLAUDE.md`：✅ 已刷新（更新核心模块清单与架构决策）
- 最终同步检查：✅ 已完成，全套 223 个单元测试通过，生产环境构建成功

## 7. 成果总结

1. **核心算法解耦与 100% 单测覆盖**：
   - 提取 `table-to-chart-utils.ts`（图表 Option 生成、双 Y 轴判定），新增 8 个单测。
   - 提取 `html-dialog-utils.ts`（HTML 净化、Markdown ↔ HTML 互转），新增 15 个单测。
   - 提取 `utils/number-utils.ts`（数值/千分位/百分比高精度解析与格式化），重构单测，消除 `as any` 访问私有方法的坏味道。
2. **职责归拢与代码去重**：
   - 清理 `table-editor.ts` 中的死代码（`removeHtmlTableMergeAttributes`），将 HTML 转 Markdown Kramdown 算法归拢至 `html-to-md.ts`。
   - `smart-paste.ts` 消除内部重复的 `gridToMarkdown` 与 `parseTsv`，复用 `text-to-table-utils.ts`。
   - `commands.ts` 抽离统一表格上下文解析器 `resolveTableBlockAndId`，复用 `table-model.ts` 的 `splitTableRow`。
3. **类型与工具层体系化**：
   - 建立 `src/types/index.ts` 统一导出项目核心接口。
   - 建立 `src/utils/index.ts` 统一再导出命名空间纯函数工具。
4. **超大文件瘦身与样式模块化**：
   - 将 `html-dialog-editor.ts` 中内嵌的 500+ 行 CSS 抽取为独立的 `src/html-dialog.scss`，由 `index.scss` 统一按现代 Sass `@use` 规范引入打包。
5. **质量保证**：
   - 测试套件从 184 项扩充至 **223 项**（新增 39 项），全部保持 100% 通过（17/17 套件全绿）。
   - `npm run build` 产物打包零警告、零报错。
