# 项目结构

> 生成日期：2026-06-20（重构后刷新）

## 源码 `src/`

| 文件 | 职责 | 行数（约） | 依赖 |
| --- | --- | --- | --- |
| `index.ts` | 插件入口：生命周期、设置面板、子模块初始化 | ~270 | settings, commands, dock, floating-toolbar, smart-paste, quick-calc, drag-reorder, keybind |
| `commands.ts` | 命令注册表：20+ 命令声明 + `registerCommands` / `executeCommand` | ~150 | table-editor, text-to-table, siyuan-text-editor |
| `text-to-table.ts` | 文本转表格 UI 交互：`executeTextToTable` / `showTextToTableDialog`（依赖 siyuan 运行时） | ~200 | text-to-table-utils, siyuan |
| `text-to-table-utils.ts` | 文本转表格纯函数：`parseLines`, `isBoxDrawingTable`, `gridToMarkdown`（可独立单元测试） | ~70 | dom-utils（escapeHtml 再导出） |
| `table-editor.ts` | 核心库封装：TableEditor 类，转发操作 + 复制粘贴/求和 | ~340 | @tgrosinger/md-advanced-tables, confirm-dialog |
| `siyuan-text-editor.ts` | **核心适配器**：ITextEditor 实现 + 内存行模型 + 公共扩展 API | ~430 | table-model, dom-utils, siyuan |
| `table-model.ts` | 表格行模型纯函数：kramdown 解析/序列化、CJK 宽度计算 | ~320 | 无外部依赖 |
| `dom-utils.ts` | DOM 工具：查找表格块、选区→坐标映射、高亮、`escapeHtml`、`getCellCoordFromTable` | ~310 | 无外部依赖 |
| `settings.ts` | 配置类型 + 加载/保存 | ~60 | @tgrosinger/md-advanced-tables |
| `keybind.ts` | Tab/Enter 键盘拦截 | ~110 | siyuan-text-editor, table-editor |
| `dock.ts` | 侧栏工具箱：UI 渲染 + 状态检测 + 按钮绑定 | ~330 | commands, siyuan-text-editor, dom-utils |
| `floating-toolbar.ts` | 浮动工具栏：跟随光标、重定位、按钮渲染 | ~310 | commands, dom-utils, table-editor |
| `smart-paste.ts` | 智能粘贴：HTML/TSV 解析、表格填充 | ~280 | siyuan-text-editor, table-model |
| `quick-calc.ts` | 即时计算：Alt+拖拽选区求和/平均值 | ~280 | dom-utils |
| `drag-reorder.ts` | 拖拽重排：行列拖动 + 指示线 + 光标推演 | ~480 | siyuan-text-editor, table-model, dom-utils |
| `confirm-dialog.ts` | 粘贴覆盖确认 Dialog | ~70 | siyuan, dom-utils |
| `utils/index.ts` | 共享工具再导出（`escapeHtml`, `getCellCoordFromTable`, `parseLines`, `gridToMarkdown`） | ~10 | dom-utils, text-to-table-utils |

## 测试 `__tests__/`

| 文件 | 测试数 | 覆盖模块 |
| --- | --- | --- |
| `table-model.test.ts` | 29 | table-model 纯函数 |
| `core-library.test.ts` | 21 | 核心库集成（InMemoryTextEditor） |
| `kramdown-roundtrip.test.ts` | 24 | kramdown 往返转换 |
| `text-to-table.test.ts` | 20 | text-to-table-utils 纯函数（parseLines, isBoxDrawingTable, escapeHtml, gridToMarkdown） |
| `dom-utils.test.ts` | 5 | dom-utils 纯函数（escapeHtml, getCellCoordFromTable） |
| **合计** | **103** | |

## 数据流

```
Command/Key → commands.ts → SiyuanTextEditor → TableEditor → @tgrosinger/md-advanced-tables
                                 (reload)         (flush)
                        GET /api/block/getBlockKramdown    POST /api/block/updateBlock
```

## 模块依赖层级

```
@tgrosinger/md-advanced-tables  (外部核心库)
        ↑
  table-model.ts          ← 纯函数，零依赖
  dom-utils.ts            ← 纯 DOM 工具
  text-to-table-utils.ts  ← 纯函数
        ↑
  siyuan-text-editor.ts   ← 核心适配器（依赖 table-model, dom-utils）
  table-editor.ts         ← 核心库封装
        ↑
  commands.ts, keybind.ts, smart-paste.ts, drag-reorder.ts, dock.ts, floating-toolbar.ts, quick-calc.ts
        ↑
  index.ts                ← 插件入口，组合所有模块
```
