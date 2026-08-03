# AV 增删改查与参数模型

- 适用版本：SiYuan `v3.7.3`
- 最后核对：2026-08-02
- 稳定性：mixed（16 个公开端点 + 若干 internal 批量接口）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>

## 1. v3.7.3 的公开 API 边界

以下 16 个 AV 路由已进入官方 `docs/API.zh-CN.md`，可按 stable 使用：

| 分类 | 端点 |
|---|---|
| 渲染/查询 | `renderAttributeView`、`getAttributeView`、`getAttributeViewPrimaryKeyValues`、`searchAttributeView` |
| 单元格 | `setAttributeViewBlockAttr` |
| 条目 | `addAttributeViewBlocks`、`removeAttributeViewBlocks` |
| 布局/分组 | `changeAttrViewLayout`、`setAttrViewGroup` |
| 过滤/排序 | `getAttributeViewFilterSort`、`setAttrViewFilters`、`setAttrViewSorts` |
| 字段 | `addAttributeViewKey`、`removeAttributeViewKey`、`sortAttributeViewKey`、`sortAttributeViewViewKey` |

完整参数见：[官方 API 快照](../03-kernel-api/official/API_zh_CN.md)。

## 2. 常用 internal 接口

下列能力仍只在 `router.go` 中可见，不属于公开承诺：

- `/api/av/appendAttributeViewDetachedBlocksWithValues`
- `/api/av/batchSetAttributeViewBlockAttrs`
- `/api/av/getAttributeViewKeysByAvID`
- `/api/av/createAttributeViewItem`
- `/api/av/getAttributeViewBacklinks`

使用这些接口必须提高 `minAppVersion`、做能力探测和失败降级，不要在文档或 SDK 中标为 stable。

## 3. 新增行的两种路径

### A. 绑定块（优先公开 API）

1. 使用 `/api/av/addAttributeViewBlocks` 绑定块。
2. 使用 `/api/av/setAttributeViewBlockAttr` 逐项写值。

这条路径全部使用公开 API，兼容性最好。大量单元格写入时需要控制并发并处理部分失败。

### B. 非绑定块或批量写入（internal）

`appendAttributeViewDetachedBlocksWithValues` 和 `batchSetAttributeViewBlockAttrs` 可以减少请求次数，但仍属于 internal。适合受控环境，不适合无版本门槛的通用插件。

## 4. 查询模型

`renderAttributeView` 的返回结构会随视图类型（表格、看板、画廊）和分组状态变化：

- 优先识别 `viewType`。
- 兼容 `rows`、`cards` 和分组结构。
- 列信息可能位于 `columns` 或 `fields`。
- 不要把某个版本的内部返回对象原样持久化。

| 视图类型 | 常见行字段 | 常见列字段 | 分组字段 |
|---|---|---|---|
| `table` | `rows` | `columns` | `groups` |
| `gallery` | `cards` | `fields` | `groups` |
| `kanban` | 按分组/卡片解析 | `fields` | `groups` |

## 5. 单项写值示例（公开 API）

```ts
await requestApi("/api/av/setAttributeViewBlockAttr", {
  avID: "20250716235026-51p7441",
  keyID: "20250716235026-njmx362",
  itemID: "20250716235124-6qqlnpw",
  value: { block: { content: "Test" } },
});
```

具体值结构随字段类型变化，必须使用官方文档中的参数模型，不要把文本字段结构套用于日期、数字、多选或资源字段。

## 6. 实践建议

- 先确定“绑定块/非绑定块”模式，再设计数据模型。
- 通用插件优先使用 16 个公开端点；internal 接口封装在单独适配层。
- 批量写入要记录成功项与失败项，避免全量重试造成重复数据。
- 数据库视图切换、分组和过滤会改变返回形态，统一走归一化解析层。
- 发布前在目标最低版本和最新正式版各验证一次。
