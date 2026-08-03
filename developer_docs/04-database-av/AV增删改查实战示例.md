# AV 增删改查实战示例

- 适用版本：SiYuan `v3.7.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.7.3`（2026-07-21）
- 最后核对：2026-08-02
- 稳定性：mixed（示例已逐项标注 stable/internal）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>

## 1. 统一请求封装

```ts
import { fetchSyncPost, showMessage } from "siyuan";

export async function requestApi<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetchSyncPost(url, data);
  if (response.code !== 0) {
    showMessage(response.msg || url, 5000, "error");
    throw new Error(response.msg || url);
  }
  return response.data as T;
}
```

## 2. 新增绑定块（stable）

```ts
await requestApi("/api/av/addAttributeViewBlocks", {
  avID: "20241017094451-2urncs9",
  srcs: [{ id: "20240107212802-727hsjv", isDetached: false }],
});
```

随后使用公开的单项写值接口：

```ts
await requestApi("/api/av/setAttributeViewBlockAttr", {
  avID: "20241017094451-2urncs9",
  keyID: "20241017094451-jwfegvp",
  itemID: "20240107212802-727hsjv",
  value: { text: { content: "Bound Title" } },
});
```

## 3. 非绑定块一次写值（internal）

以下接口未进入官方 API 文档，只适合有明确版本门槛和降级逻辑的插件：

```ts
await requestApi("/api/av/appendAttributeViewDetachedBlocksWithValues", {
  avID: "20241017094451-2urncs9",
  blocksValues: [
    [
      { keyID: "20241017094451-jwfegvp", block: { content: "Title" } },
      { keyID: "20241017095436-2wlgb7o", number: { content: 123 } },
      { keyID: "20241017094451-fu1pv7s", mSelect: [{ content: "Fiction" }] },
    ],
  ],
});
```

## 4. 批量写值（internal）

```ts
await requestApi("/api/av/batchSetAttributeViewBlockAttrs", {
  avID: "20241017094451-2urncs9",
  values: [
    {
      keyID: "20241017094451-jwfegvp",
      itemID: "20240107212802-727hsjv",
      value: { text: { content: "Bound Title" } },
    },
  ],
});
```

如果该接口不可用，应回退到逐项调用 `/api/av/setAttributeViewBlockAttr`，并限制并发数。

## 5. 查询与结果归一化（stable）

```ts
const data = await requestApi<any>("/api/av/renderAttributeView", {
  id: "20241017094451-2urncs9",
  query: "",
  pageSize: 50,
});

const viewType = data.viewType;
const rowField = viewType === "gallery" ? "cards" : "rows";
const colField = viewType === "gallery" ? "fields" : "columns";
const rows = data.view?.group
  ? data.view.groups.flatMap((group: any) => group.rows ?? group.cards ?? [])
  : data.view?.[rowField] ?? [];
const columns = data.view?.[colField] ?? [];
```

真实结构会随表格、看板、画廊和分组状态变化，生产代码应定义明确类型并对缺失字段降级。

## 6. 删除行（stable）

```ts
await requestApi("/api/av/removeAttributeViewBlocks", {
  avID: "20241017094451-2urncs9",
  srcIDs: ["20240107212802-727hsjv"],
});
```

删除前应确认条目是否绑定实际块，并向用户说明是否会影响块本身。

## 7. 使用原则

- stable 与 internal 接口不要混在同一个无标识封装里。
- 优先公开 API；批量 internal 接口只作为性能优化路径。
- 所有写操作记录失败项，避免整批盲目重试。
- 在最低支持版本和最新正式版分别验证返回结构。
