# 公开 API 导航

- 适用版本：SiYuan `v3.7.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.7.3`（2026-07-21）
- 最后核对：2026-08-02
- 稳定性：stable
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - 本地快照：`official/API_zh_CN.md`

## 1. 调用规范

- 默认地址：`http://127.0.0.1:6806`
- 公开接口以 `POST /api/*` 为主，个别系统接口同时支持 GET。
- 请求体使用 JSON，标头为 `Content-Type: application/json`。
- 需要 API Token 时使用 `Authorization: Token xxx`。
- 统一返回结构：

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

`code != 0` 代表失败，必须处理 `msg`；`data` 可能是对象、数组或 `null`。

## 2. 公开 API 模块总览

当前官方文档共 67 个唯一端点：

| 模块 | 数量 | 典型用途 |
|---|---:|---|
| notebook | 8 | 笔记本生命周期和配置 |
| filetree | 11 | 文档创建、移动、路径查询 |
| asset | 1 | 资源上传 |
| block | 11 | 块插入、更新、移动、删除和读取 |
| attr | 2 | 块属性读写 |
| av | 16 | 属性视图渲染、条目、字段、过滤、排序 |
| query/sqlite | 3 | SQL 查询和事务刷新 |
| template | 2 | 模板与 Sprig 渲染 |
| file | 5 | 工作空间文件读写 |
| export | 2 | Markdown 与资源导出 |
| convert | 1 | Pandoc 转换 |
| notification | 2 | 普通/错误消息 |
| network | 1 | 正向代理 |
| system | 3 | 启动进度、版本、当前时间 |

完整索引见：[官方 API 全量索引](../07-official-index/官方API全量索引-按模块.md)。完整参数见：[官方 API 快照](official/API_zh_CN.md)。

## 3. AV（数据库）公开能力

v3.7.3 已将以下 16 个 AV 端点写入官方公开文档：

- `renderAttributeView`、`getAttributeView`、`getAttributeViewPrimaryKeyValues`
- `searchAttributeView`、`setAttributeViewBlockAttr`
- `addAttributeViewBlocks`、`removeAttributeViewBlocks`
- `changeAttrViewLayout`、`setAttrViewGroup`
- `getAttributeViewFilterSort`、`setAttrViewFilters`、`setAttrViewSorts`
- `addAttributeViewKey`、`removeAttributeViewKey`
- `sortAttributeViewKey`、`sortAttributeViewViewKey`

这些端点可以作为稳定 API 使用，但参数模型仍需严格以官方文档和 AV 专题文档为准。

## 4. 插件开发常用分类

- 笔记本：`/api/notebook/*`
- 文档树：`/api/filetree/*`
- 块操作：`/api/block/*`
- 块属性：`/api/attr/*`
- SQL：`/api/query/sql`
- 文件：`/api/file/*`
- 数据库/属性视图：`/api/av/*`
- 通知：`/api/notification/*`
- 系统：`/api/system/version`、`/api/system/currentTime`

## 5. 常用组合

### 插入并标记块

1. `/api/block/insertBlock`
2. `/api/attr/setBlockAttrs`

### 按关键词找块

1. `/api/query/sql`
2. 根据查询结果调用 `/api/block/getBlockKramdown`

### 更新数据库条目

1. `/api/av/searchAttributeView`
2. 根据结果调用 `/api/av/setAttributeViewBlockAttr`
3. 需要刷新视图时调用 `/api/av/renderAttributeView`

## 6. 响应处理建议

- 统一封装 `fetchSyncPost`，处理 `code/msg`、超时和可重试错误。
- 日志只记录端点、耗时和脱敏后的参数；不要记录密钥和完整用户内容。
- 删除、批量移动、写文件等操作先确认并保留可恢复路径。
- 公开 API 也可能在只读模式、锁屏或权限不足时失败，错误提示应能解释原因。

## 7. 相关文档

- [非公开 API 与风险说明](非公开API与风险说明.md)
- [AV 增删改查与参数模型](../04-database-av/AV增删改查与参数模型.md)
- [官方 API 全量索引](../07-official-index/官方API全量索引-按模块.md)
- [v3.7.3 开发进展与 API 迁移指南](../00-version/SiYuan-v3.7.3开发进展与API迁移指南.md)
