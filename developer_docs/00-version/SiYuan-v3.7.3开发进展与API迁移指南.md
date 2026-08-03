# SiYuan v3.7.3 开发进展与 API 迁移指南

- 适用版本：SiYuan `v3.7.3` / npm `siyuan@1.2.3`
- 最后核对：2026-08-02
- 稳定性：版本迁移基线
- 本地源码：`D:\MyCodingProjects\siyuan-master`
- 上游基线：Release `v3.7.3`（2026-07-21），`master` 提交 `eef10568384e2e7cf547adb029ae46a72e43c287`
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/releases/tag/v3.7.3>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - <https://github.com/siyuan-note/petal>

## 1. 基线结论

本地源码中的应用和内核版本均为 `3.7.3`，npm 最新正式插件类型包为 `siyuan@1.2.3`。虽然 `petal` 主分支已经进入后续版本开发，本模板只使用正式发布类型，避免将未发布签名带入生产插件。

当前官方公开内核 API 文档包含 67 个唯一端点；当前 `kernel/api/router.go` 包含 540 个唯一 `/api/*` 路由。两者的差值表示“实现存在但未被公开文档承诺”的内部接口，不能仅因能调用就当作稳定 API。

## 2. v3.7.0～v3.7.3 的主要开发变化

### 2.1 v3.7.0：扩展运行时能力

- 新增内核插件系统和命令行接口。
- 新增密钥、变量配置和模板解析能力。
- AI 智能体、嵌入向量搜索进入公开测试阶段。
- 数据库（AV）筛选器组合、布局和字段操作能力显著扩展。
- 插件可保存导出文件；`/api/query/sql` 增加只读模式。
- 新增 `/api/lute/md2html`、`/api/history/createDocHistory`。
- `updateTransaction` 被弃用，应迁移到 `updateTransactionElement`。
- `lang` 改用 RFC 5646 标签（如 `zh-CN`、`en-US`），这是配置层的破坏性变化。
- LocalStorage 相关接口得到完善。

### 2.2 v3.7.1～v3.7.2：界面与编辑器 API

- 新增 `/api/setting/setTheme`、`/api/ui/reloadTheme`、`/api/setting/setIcon`。
- `getAllTabs` 增加可选 `type` 参数。
- 新增 `/api/file/workspaceCopyFiles`。
- 新增 `/api/block/updateTaskListItemMarker` 和 `/api/block/batchUpdateTaskListItemMarker`。
- `Protyle` 增加 `switchMode`。
- 修复移动端 `updateProtyleToolbar` 不可用的问题。
- 调用已弃用 API 时会输出警告日志，旧插件应主动清理警告。

### 2.3 v3.7.3：加载时序和内核插件稳定性

前端插件加载顺序已明确为：

```text
await plugin.onload()
    ↓
await plugin.kernel.init()
    ↓
afterLoadPlugin(plugin)
    ↓
plugin.onLayoutReady()
```

因此：

- `onload()` 可以返回 Promise，异步初始化完成前不会进入 `onLayoutReady()`。
- 若声明了内核插件，`onLayoutReady()` 调用前会先完成内核插件初始化流程。
- 不要在模块顶层或构造阶段假定内核 RPC 已可用；应检查状态并处理启动期间的失败。
- v3.7.3 还修复了移动端未加载内核插件、启动阶段过早 RPC 调用失败等问题，并改进了 WebSocket 客户端和代理网络控制。

## 3. npm `siyuan` 1.1.0 → 1.2.3

`Plugin` 的正式类型新增或完善了以下能力：

- `kernel: IKernelPlugin`
- `onDataChanged()`
- `getSecret(name)`
- `getVariable(name)`
- `addAgentAction(options)` 与 `agentActions`
- `saveExportFile`
- `getAllTabs(type?)`
- `getActiveEditor`、`getActiveTab`
- `openEmoji`、`expandDocTree`、`saveLayout`
- `globalCommand`、`openAttributePanel`、`hideMessage`
- `Protyle.switchMode`
- 内核插件类型入口：`siyuan/kernel`

`saveData`、`removeData`、`addDock` 等签名的返回值和回调作用域也更准确。项目应直接依赖 `siyuan@1.2.3`，不要通过 `declare module "siyuan"` 重复补齐这些已正式发布的方法，否则可能削弱官方类型或在后续升级时产生声明冲突。

## 4. 内核插件系统

### 4.1 前端插件与内核插件的职责

- 前端插件：操作界面、菜单、Protyle、事件总线和用户交互。
- 内核插件：运行于内核侧，适合后台服务、RPC、MCP、持久任务、网络客户端和需要跨前端生命周期的逻辑。
- 只有实际构建并随包提供 `kernel.js` 时，才应在 `plugin.json` 中声明 `kernels`。纯前端模板不要空声明该字段。

前端通过 `this.kernel` 使用内核插件：

```ts
this.eventBus.on("kernel-plugin-state-change", (event) => {
  console.log("kernel state", event.detail);
});

const state = this.kernel.state;
const result = await this.kernel.rpc.call.example({ id: "..." });
```

状态码（`this.kernel.state.code`）：

| 值 | 状态 |
|---:|---|
| `-1` | inactive |
| `0` | ready |
| `1` | loading |
| `2` | running |
| `3` | stopping |
| `4` | stopped |
| `5` | error |

RPC 在 `running` 前可能返回 `-32002`。调用方应等待 `kernel-plugin-state-change`，或采用有上限的退避重试并给出可理解的错误提示。

## 5. 密钥、变量与 AI 智能体动作

### 5.1 `getSecret` / `getVariable`

```ts
const token = this.getSecret("SERVICE_TOKEN");
const endpoint = this.getVariable("SERVICE_ENDPOINT");

if (!token) {
  throw new Error("未配置 SERVICE_TOKEN");
}
```

- 名称不存在时返回空字符串，必须显式判空。
- 密钥在磁盘侧加密保存，但插件运行时读取到的是明文。
- 不要将密钥写入日志、DOM、通知、遥测、异常信息或智能体返回值。
- 所有已启用前端插件都应视为同一信任边界内的代码；不要安装或启用不可信插件来处理敏感密钥。
- 写入密钥/变量的内核路由受鉴权、管理员角色和只读模式限制；前端读取方法本身从已加载配置中取值。
- 内核插件使用 `siyuan.secrets.resolve("{{secrets.NAME}}")` 和 `siyuan.vars.resolve("{{vars.NAME}}")` 解析模板，不暴露完整清单。

### 5.2 `addAgentAction`

```ts
this.addAgentAction({
  name: "lookup_document",
  description: "按块 ID 读取文档摘要；参数：id（字符串）",
  handler: async (args) => {
    if (typeof args.id !== "string" || !args.id) {
      return { error: "参数 id 必须是非空字符串" };
    }
    return { result: `待查询：${args.id}` };
  },
});
```

注册后的完整动作名为 `plugin__<pluginName>__<actionName>`。建议：

- `name` 使用稳定的小写标识符，不要随显示文案变化。
- `description` 明确用途、参数和副作用。
- handler 自行校验全部参数，只返回 `{ result }` 或 `{ error }`。
- 写文件、删除数据、发送网络请求等高风险动作必须二次确认。
- 不要把密钥、隐私内容或内部堆栈放入结果和错误信息。
- 插件卸载时动作会自动注销，无需重复维护全局注册表。

## 6. 内核 HTTP API 变化

### 6.1 官方公开 API

官方文档现有 67 个唯一端点，按模块统计：

| 模块 | 数量 |
|---|---:|
| notebook | 8 |
| filetree | 11 |
| asset | 1 |
| block | 11 |
| attr | 2 |
| av | 16 |
| query | 1 |
| sqlite | 1 |
| template | 2 |
| file | 5 |
| export | 2 |
| convert | 1 |
| notification | 2 |
| network | 1 |
| system | 3 |

数据库（AV）新增 16 个正式公开端点，覆盖渲染、查询、字段、条目、布局、分组、过滤和排序。完整列表见 [`../07-official-index/官方API全量索引-按模块.md`](../07-official-index/官方API全量索引-按模块.md)。

### 6.2 全量路由与内部能力

相较本项目旧快照的 460 个唯一路由，v3.7.3 `router.go` 增加 80 个，未删除旧路由。增量集中在：

- AI Agent、模型测试、嵌入索引和 MCP OAuth。
- 内核插件加载、列表和 RPC。
- 密钥、变量与 LocalStorage。
- 加密笔记本、导入迁移、事务撤销/重做。
- AV、文档历史、Markdown 转 HTML、网络代理等。

这些路由如果未出现在 `docs/API.zh-CN.md`，应视为 `internal`。尤其是 `/api/ai/*`、`/api/plugin/*`、加密笔记本、迁移和内部事务接口，必须做版本探测、异常降级和数据备份。

## 7. 迁移检查清单

- [ ] 将运行时基线更新到 SiYuan `3.7.3`，类型依赖更新到 `siyuan@1.2.3`。
- [ ] 删除对已正式发布 API 的本地 `declare module "siyuan"` 补丁。
- [ ] 将 `plugin.json` 的语言键迁移到 RFC 5646（`zh-CN`、`en-US`）。
- [ ] 对异步 `onload()` 使用 `async`/Promise，并把依赖布局的逻辑放在 `onLayoutReady()`。
- [ ] 使用 `updateTransactionElement` 替代 `updateTransaction`。
- [ ] 需要 SQL 只读保护时启用 `/api/query/sql` 的 readonly 语义。
- [ ] 使用 `getAllTabs(type?)` 时为旧版本提供无参数降级。
- [ ] 使用 `Protyle.switchMode`、移动端工具栏或内核 RPC 时检查版本和运行状态。
- [ ] 仅将 `docs/API.zh-CN.md` 中的端点当作正式公开内核 API。
- [ ] 对 AI、插件 RPC、加密笔记本、迁移等内部接口提供显式失败路径。

## 8. 本地权威快照

- [`../03-kernel-api/official/API_zh_CN.md`](../03-kernel-api/official/API_zh_CN.md)：来自 `docs/API.zh-CN.md`，用于公开 API 参数核对。
- [`../03-kernel-api/official/router.go`](../03-kernel-api/official/router.go)：来自 `kernel/api/router.go`，用于全量路由与中间件审计。
