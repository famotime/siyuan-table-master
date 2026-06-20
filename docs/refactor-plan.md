# 重构计划

## 1. 项目快照

- 生成日期：2026-06-20
- 范围：siyuan-advanced-tables 全仓库（`src/` + `__tests__/`）
- 目标：消除重复代码、拆分过大模块、提取共享工具函数、清理模板残留文件，在不改变行为的前提下提升可维护性和可测试性
- 文档刷新目标：`docs/project-structure.md`、`README.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口 | `src/index.ts` | 插件生命周期、设置面板 UI | 设置面板 150+ 行重复 DOM 操作模式（8 个 checkbox 完全同构） | 无（依赖 siyuan 运行时） |
| 命令注册 | `src/commands.ts` | 20+ 命令注册/执行 + 文本转表格对话框 | `executeTextToTable` + `showTextToTableDialog` 约 260 行，含对话框 DOM、预览生成、HTML 转义等，应独立成模块 | 无 |
| 适配器 | `src/siyuan-text-editor.ts` | ITextEditor 实现，内存行模型 | kramdown 提取逻辑与 `commands.ts` 重复；smart-paste.ts / drag-reorder.ts 通过 `(ctx as any)._lines` 破坏封装 | 有（roundtrip 测试覆盖） |
| 表格编辑器 | `src/table-editor.ts` | 核心库转发 + 复制粘贴/求和 | `pasteRow` / `pasteColumn` 约 90 行高度对称；`rowSum` / `columnSum` 也有相似模式 | 有（core-library 测试） |
| 行模型 | `src/table-model.ts` | kramdown ↔ 行数组纯函数 | `escapeHtml` 在 `commands.ts` 和 `confirm-dialog.ts` 中重复实现 | 有（29 个单元测试） |
| DOM 工具 | `src/dom-utils.ts` | 表格定位、光标映射、高亮 | `getCellCoord` 在 `quick-calc.ts` 和 `drag-reorder.ts` 中重复实现 | 无 |
| 浮动工具栏 | `src/floating-toolbar.ts` | 跟随光标的工具栏 | 稳定，无需重构 | 无 |
| Dock 面板 | `src/dock.ts` | 侧栏工具箱 | `registerDock` 函数 440+ 行，`init` 内含大量闭包状态和 DOM 操作 | 无 |
| 智能粘贴 | `src/smart-paste.ts` | 剪贴板智能解析/填充 | 访问 `(ctx as any)._lines` 破坏封装；`gridToMarkdown` 与 `commands.ts` 中逻辑重复 | 无 |
| 拖拽重排 | `src/drag-reorder.ts` | 行列拖拽重排 | 访问 `(editorCtx as any)._lines` 和 `(editorCtx as any)._dirty` 破坏封装；`getCellCoord` 重复 | 无 |
| 模板残留 | `src/api.ts`, `src/main.ts`, `src/utils/index.ts` | 模板项目的思源 API 封装和 Vue 初始化 | 完全未被本项目引用，属于死代码 | 无 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 文本转表格独立模块 | `src/text-to-table.ts`（新建）, `src/text-to-table-utils.ts`（新建）, `src/commands.ts` | 将 `executeTextToTable` / `showTextToTableDialog` / `isBoxDrawingTable` / `escapeHtml` / `parseLines` / `gridToMarkdown` 提取到独立模块；纯函数与 siyuan 运行时代码分离 | 中 | ✅ `parseLines` 6 种分隔符测试；✅ `isBoxDrawingTable` 边界测试；✅ `escapeHtml` 转义测试；✅ `gridToMarkdown` GFM 生成测试 | `docs/project-structure.md`：新增 text-to-table 模块说明 | done |
| RF-002 | P0 | 共享工具函数提取 | `src/dom-utils.ts`, `src/quick-calc.ts`, `src/drag-reorder.ts`, `src/confirm-dialog.ts`, `src/text-to-table-utils.ts` | ① `escapeHtml` 统一到 `dom-utils.ts`（消除 confirm-dialog / text-to-table 重复）；② `getCellCoordFromTable` 提取到 `dom-utils.ts`（消除 quick-calc / drag-reorder 重复实现）；③ `gridToMarkdown` 已由 RF-001 提取 | 低 | ✅ `escapeHtml` 正确（&<">）；✅ `getCellCoordFromTable` 兜底逻辑；✅ `gridToMarkdown` 已由 RF-001 覆盖 | `docs/project-structure.md`：更新 utils 职责描述 | done |
| RF-003 | P0 | 适配器封装接口暴露 | `src/siyuan-text-editor.ts`, `src/smart-paste.ts`, `src/drag-reorder.ts` | 为 `SiyuanTextEditor` 新增 `getLineCount()` / `getLineAt()` / `setLineAt()` / `insertLineAt()` / `removeLine()` / `markDirty()` 公共方法，消除所有 `(ctx as any)._lines` / `._dirty` | 中 | ✅ SmartPaste 粘贴填充行数正确；✅ DragReorder 行列重排数据正确；✅ 103 测试全部通过 | `docs/project-structure.md`：更新适配器接口说明 | done |
| RF-004 | P1 | TableEditor 粘贴逻辑去重 | `src/table-editor.ts` | ① 提取 `pasteWithConfirm` 通用方法；② 提取 `sumCells` 通用函数 | 低 | ✅ 粘贴行覆盖确认正常；✅ 粘贴列覆盖确认正常；✅ 行/列求和正确 | `docs/project-structure.md`：table-editor 从 440 行缩减到 ~340 行 | done |
| RF-005 | P1 | 设置面板提取 | `src/index.ts` | 将 `openSetting` 中 150+ 行重复 checkbox 创建模式提取为 `createToggleSetting` + `TOGGLES` 数据声明，`openSetting` 从 ~140 行精简到 ~45 行 | 低 | ✅ build 成功；✅ 103 测试通过 | `docs/project-structure.md`：index.ts 从 ~347 行缩减到 ~270 行 | done |
| RF-006 | P1 | 模板残留文件清理 | `src/api.ts`†, `src/main.ts`†, `src/types/api.d.ts`†, `src/types/index.d.ts`†, `src/utils/index.ts` | 删除 4 个模板残留文件；`utils/index.ts` 重写为共享工具再导出模块 | 低 | ✅ `npm run build` 构建成功；✅ `pnpm test` 103 通过；✅ `npx eslint src/` 无报错 | `docs/project-structure.md`：移除模板文件，更新 utils 说明 | done |
| RF-007 | P2 | Dock 面板模块拆分 | `src/dock.ts` | 提取 `updateDockStatus` / `setDockUIState` / `getTableSize` / `DockUIElements` 为模块级函数，`init()` 闭包不再包含大段状态检测和 UI 控制逻辑 | 中 | ✅ build 成功；✅ 103 测试通过 | `docs/project-structure.md`：dock.ts 结构从单体闭包变为函数组合 | done |

优先级说明：
- `P0`：消除重复 + 暴露封装问题，价值和风险都最高，优先执行
- `P1`：改善可维护性、清理残留，中等价值和低风险
- `P2`：模块拆分，最后执行

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-06-20 | 2026-06-20 | `pnpm test` | 98 通过（+20 新增 text-to-table 测试） | `docs/project-structure.md`、`README.md` | 纯函数在 `text-to-table-utils.ts`，UI 在 `text-to-table.ts` |
| RF-002 | 2026-06-20 | 2026-06-20 | `pnpm test` | 103 通过（+5 新增 dom-utils 测试） | `docs/project-structure.md`、`README.md` | `getCellCoordFromTable` 统一到 dom-utils |
| RF-003 | 2026-06-20 | 2026-06-20 | `pnpm test` | 103 通过 | `docs/project-structure.md`、`README.md` | 消除所有 `(ctx as any)` 坏味道 |
| RF-004 | 2026-06-20 | 2026-06-20 | `pnpm test` | 103 通过 | `docs/project-structure.md`、`README.md` | table-editor.ts 从 440 行缩减到 ~340 行 |
| RF-005 | 2026-06-20 | 2026-06-20 | `pnpm test` + `npm run build` | 103 通过，build 成功 | `docs/project-structure.md`、`README.md` | openSetting 从 ~140 行缩减到 ~45 行 |
| RF-006 | 2026-06-20 | 2026-06-20 | `pnpm test` + `npm run build` | 103 通过，build 成功 | `docs/project-structure.md`、`README.md` | 删除 api.ts, main.ts, types/api.d.ts, types/index.d.ts |
| RF-007 | 2026-06-20 | 2026-06-20 | `pnpm test` + `npm run build` | 103 通过，build 成功 | `docs/project-structure.md`、`README.md` | 提取 updateDockStatus / setDockUIState 为模块函数 |

## 5. 决策与确认

- 用户批准的条目：RF-001～RF-007 全部
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：✅ 已创建
- `README.md`：✅ 已创建
- 最终同步检查：✅ 所有 7 个条目 done，103 测试通过，build 成功

## 7. 下一步

- 重构完成
