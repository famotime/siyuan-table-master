# 官方 API 全量索引（按模块）

- 适用版本：SiYuan `v3.7.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.7.3`（2026-07-21）
- 最后核对：2026-08-02
- 稳定性：stable（仅列入官方 `docs/API.zh-CN.md` 的端点）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - 本地快照：`../03-kernel-api/official/API_zh_CN.md`

## 使用说明

本索引由官方 API 文档逐项核对生成，共 **67 个唯一公开端点**。请求规范、参数和返回值以官方快照为准；`router.go` 中没有出现在该快照的路由一律按 internal 处理。

## 模块统计

| 模块 | 端点数 |
|---|---:|
| 笔记本 | 8 |
| 导出 | 2 |
| 块 | 11 |
| 模板 | 2 |
| 属性 | 2 |
| 数据库 | 16 |
| 通知 | 2 |
| 网络 | 1 |
| 文档 | 11 |
| 文件 | 5 |
| 系统 | 3 |
| 转换 | 1 |
| 资源文件 | 1 |
| SQL | 2 |

## 笔记本

| 能力 | 端点 |
|---|---|
| 列出笔记本 | `/api/notebook/lsNotebooks` |
| 打开笔记本 | `/api/notebook/openNotebook` |
| 关闭笔记本 | `/api/notebook/closeNotebook` |
| 重命名笔记本 | `/api/notebook/renameNotebook` |
| 创建笔记本 | `/api/notebook/createNotebook` |
| 删除笔记本 | `/api/notebook/removeNotebook` |
| 获取笔记本配置 | `/api/notebook/getNotebookConf` |
| 保存笔记本配置 | `/api/notebook/setNotebookConf` |

## 导出

| 能力 | 端点 |
|---|---|
| 导出 Markdown 文本 | `/api/export/exportMdContent` |
| 导出文件与目录 | `/api/export/exportResources` |

## 块

| 能力 | 端点 |
|---|---|
| 插入块 | `/api/block/insertBlock` |
| 插入前置子块 | `/api/block/prependBlock` |
| 插入后置子块 | `/api/block/appendBlock` |
| 更新块 | `/api/block/updateBlock` |
| 删除块 | `/api/block/deleteBlock` |
| 移动块 | `/api/block/moveBlock` |
| 折叠块 | `/api/block/foldBlock` |
| 展开块 | `/api/block/unfoldBlock` |
| 获取块 kramdown 源码 | `/api/block/getBlockKramdown` |
| 获取子块 | `/api/block/getChildBlocks` |
| 转移块引用 | `/api/block/transferBlockRef` |

## 模板

| 能力 | 端点 |
|---|---|
| 渲染模板 | `/api/template/render` |
| 渲染 Sprig | `/api/template/renderSprig` |

## 属性

| 能力 | 端点 |
|---|---|
| 设置块属性 | `/api/attr/setBlockAttrs` |
| 获取块属性 | `/api/attr/getBlockAttrs` |

## 数据库

| 能力 | 端点 |
|---|---|
| 渲染 | `/api/av/renderAttributeView` |
| 获取 | `/api/av/getAttributeView` |
| 获取主键值 | `/api/av/getAttributeViewPrimaryKeyValues` |
| 搜索 | `/api/av/searchAttributeView` |
| 设置单元格值 | `/api/av/setAttributeViewBlockAttr` |
| 添加条目 | `/api/av/addAttributeViewBlocks` |
| 移除条目 | `/api/av/removeAttributeViewBlocks` |
| 切换布局 | `/api/av/changeAttrViewLayout` |
| 设置分组 | `/api/av/setAttrViewGroup` |
| 获取过滤与排序 | `/api/av/getAttributeViewFilterSort` |
| 设置过滤 | `/api/av/setAttrViewFilters` |
| 设置排序 | `/api/av/setAttrViewSorts` |
| 添加字段 | `/api/av/addAttributeViewKey` |
| 移除字段 | `/api/av/removeAttributeViewKey` |
| 设置全局字段排序 | `/api/av/sortAttributeViewKey` |
| 设置视图内字段排序 | `/api/av/sortAttributeViewViewKey` |

## 通知

| 能力 | 端点 |
|---|---|
| 推送消息 | `/api/notification/pushMsg` |
| 推送报错消息 | `/api/notification/pushErrMsg` |

## 网络

| 能力 | 端点 |
|---|---|
| 正向代理 | `/api/network/forwardProxy` |

## 文档

| 能力 | 端点 |
|---|---|
| 通过 Markdown 创建文档 | `/api/filetree/createDocWithMd` |
| 重命名文档 | `/api/filetree/renameDoc` |
| 重命名文档 | `/api/filetree/renameDocByID` |
| 删除文档 | `/api/filetree/removeDoc` |
| 删除文档 | `/api/filetree/removeDocByID` |
| 移动文档 | `/api/filetree/moveDocs` |
| 移动文档 | `/api/filetree/moveDocsByID` |
| 根据路径获取人类可读路径 | `/api/filetree/getHPathByPath` |
| 根据 ID 获取人类可读路径 | `/api/filetree/getHPathByID` |
| 根据 ID 获取存储路径 | `/api/filetree/getPathByID` |
| 根据人类可读路径获取 IDs | `/api/filetree/getIDsByHPath` |

## 文件

| 能力 | 端点 |
|---|---|
| 获取文件 | `/api/file/getFile` |
| 写入文件 | `/api/file/putFile` |
| 删除文件 | `/api/file/removeFile` |
| 重命名文件 | `/api/file/renameFile` |
| 列出文件 | `/api/file/readDir` |

## 系统

| 能力 | 端点 |
|---|---|
| 获取启动进度 | `/api/system/bootProgress` |
| 获取系统版本 | `/api/system/version` |
| 获取系统当前时间 | `/api/system/currentTime` |

## 转换

| 能力 | 端点 |
|---|---|
| Pandoc | `/api/convert/pandoc` |

## 资源文件

| 能力 | 端点 |
|---|---|
| 上传资源文件 | `/api/asset/upload` |

## SQL

| 能力 | 端点 |
|---|---|
| 执行 SQL 查询 | `/api/query/sql` |
| 提交事务 | `/api/sqlite/flushTransaction` |

## 重点变化

v3.7.3 的公开文档将数据库（AV）能力正式列为 16 个端点，覆盖渲染、查询、条目、字段、布局、分组、过滤和排序。旧版索引将 AV 视为未公开能力的说法已失效。

相关文档：

- [公开 API 导航](../03-kernel-api/公开API导航.md)
- [AV 参数模型](../04-database-av/AV增删改查与参数模型.md)
- [router 路由变更与风险索引](router路由变更与风险索引.md)
