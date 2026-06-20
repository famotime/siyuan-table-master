# 高级表格 (Advanced Tables)

思源笔记表格增强插件，提供自动格式化、单元格导航、行列操作、排序对齐、公式求值等高级编辑能力。

> 基于 [@tgrosinger/md-advanced-tables](https://github.com/tgrosinger/md-advanced-tables) 核心库（MIT），为思源原生 NodeTable 块提供类电子表格的编辑体验。

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

> 当前为 M1 里程碑（MVP），功能已完整实现。后续规划见[设计文档](docs/01-设计方案.md)。

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
- **命令面板** — `Ctrl+P` 搜索「高级表格」相关命令
- **工具栏** — 点击顶栏表格图标（需在设置中开启）

## 设置

| 选项 | 默认 | 说明 |
|------|------|------|
| 格式化风格 | 弱格式(WEAK) | WEAK 无额外填充（推荐 CJK 场景），NORMAL 标准填充对齐 |
| Tab 键导航 | 开启 | Tab 切换单元格 |
| Enter 键导航 | 开启 | Enter 进入下一行 |
| CJK 宽度校正 | 开启 | NORMAL 格式下中文宽度修正 |
| 顶栏图标 | 开启 | 在顶栏显示表格图标入口 |

## 致谢

- [@tgrosinger/md-advanced-tables](https://github.com/tgrosinger/md-advanced-tables) — 核心表格操作库，MIT 许可
- [advanced-tables-obsidian](https://github.com/tgrosinger/advanced-tables-obsidian) — 参考实现
- [plugin-sample-vite-vue](https://github.com/siyuan-note/plugin-sample-vite-vue) — 思源插件开发模板

## 许可证

MIT
