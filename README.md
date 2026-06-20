# 高级表格 (Advanced Tables)

思源笔记表格增强插件，基于 [@tgrosinger/md-advanced-tables](https://github.com/tgrosinger/md-advanced-tables) 核心库，为思源原生 NodeTable 块提供增强编辑能力。

## 功能

### 单元格导航
| 快捷键 | 操作 |
|--------|------|
| `Tab` | 下一单元格（可开关） |
| `Shift+Tab` | 上一单元格 |
| `Enter` | 下一行（可开关） |

### 表格编辑
- **格式化** — 统一列宽、对齐管道符
- **行列操作** — 插入/删除行列、左右移动列、上下移动行
- **对齐** — 列左对齐、居中对齐、右对齐
- **排序** — 按当前列升序/降序排序
- **转置** — 行列互换
- **公式** — 支持 SUM、AVERAGE、COUNT、MAX、MIN 等电子表格公式
- **跳出表格** — 快速退出表格到下方编辑
- **复制粘贴** — 行列级复制/粘贴（带覆盖确认）
- **求和** — 行求和 / 列求和
- **文本转表格** — 将逗号/Tab/终端制图表转换为 Markdown 表格
- **智能粘贴** — 自动识别 Excel/网页粘贴的表格数据
- **即时计算** — Alt+拖拽框选，实时求和/平均值/计数
- **拖拽重排** — 拖拽手柄行列排序
- **浮动工具栏** — 光标附近悬浮快速操作
- **粘性表头** — 长表格滚动表头固定

## 安装

### 从集市安装（上架后）
在思源笔记「设置 → 集市 → 插件」中搜索 **Advanced Tables** 即可安装。

### 手动安装
1. 从 [Releases](https://github.com/siyuan-note/siyuan-advanced-tables/releases) 下载最新 `package.zip`
2. 解压到 `{工作空间}/data/plugins/siyuan-advanced-tables/`
3. 在「设置 → 插件」中启用

## 使用方式

将光标置于表格内，通过以下任一方式操作：

- **快捷键** — `Tab` / `Shift+Tab` / `Enter`
- **命令面板** — `Ctrl+P` 搜索相关命令
- **侧栏工具箱** — 右侧 Dock 面板集中操作
- **浮动工具栏** — 光标附近悬浮按钮
- **右键菜单** — 支持「文本转表格」

## 设置

| 选项 | 默认 | 说明 |
|------|------|------|
| 浮动工具栏 | 开启 | 光标在表格内时显示浮动操作栏 |
| 粘性表头 | 开启 | 滚动时表头固定 |
| 智能粘贴 | 开启 | 自动识别 Excel/网页表格数据 |
| 即时计算 | 开启 | Alt+拖拽选区实时统计 |
| 拖拽重排 | 开启 | 鼠标拖拽调整行列顺序 |
| Tab 键导航 | 开启 | Tab 切换单元格 |
| Enter 键导航 | 开启 | Enter 进入下一行 |
| CJK 宽度校正 | 开启 | 中文字符宽度修正 |

## 开发

```bash
pnpm install            # 安装依赖
npm run dev             # 开发模式（需配置 .env 中的 VITE_SIYUAN_WORKSPACE_PATH）
npm run build           # 生产构建 → ./dist/ + ./package.zip
npm test                # 运行测试（vitest，103 个测试）
npm run test:watch      # 测试监视模式
npx eslint src/         # 代码检查
```

## 架构

```
Command/Key → commands.ts → SiyuanTextEditor → TableEditor → md-advanced-tables 核心库
                                 (reload)         (flush)
                        GET /api/block/getBlockKramdown    POST /api/block/updateBlock
```

- `siyuan-text-editor.ts` — 核心适配器，实现 ITextEditor 接口
- `table-editor.ts` — 表格编辑器封装
- `table-model.ts` — kramdown ↔ 行数组纯函数
- `text-to-table-utils.ts` — 文本转表格纯函数
- 详情见 `docs/project-structure.md`

## 致谢

- [@tgrosinger/md-advanced-tables](https://github.com/tgrosinger/md-advanced-tables) — 核心表格操作库，MIT 许可
- [advanced-tables-obsidian](https://github.com/tgrosinger/advanced-tables-obsidian) — 参考实现
- [plugin-sample-vite-vue](https://github.com/siyuan-note/plugin-sample-vite-vue) — 思源插件开发模板

## 许可证

MIT
