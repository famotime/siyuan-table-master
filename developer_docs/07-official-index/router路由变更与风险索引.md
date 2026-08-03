# router 路由变更与风险索引

- 适用版本：SiYuan `v3.7.3`
- 对比基线：旧快照 460 个唯一路由 → 当前快照 540 个唯一路由
- 差异：新增 80，删除 0
- 最后核对：2026-08-02
- 稳定性：internal index
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>
  - [本地 router 快照](../03-kernel-api/official/router.go)
  - [官方公开 API 快照](../03-kernel-api/official/API_zh_CN.md)

## 1. 结论

`router.go` 是运行时路由事实来源，但不是稳定性承诺。当前 540 个唯一路由中，只有官方 `docs/API.zh-CN.md` 列出的 67 个端点属于公开 API。其余端点必须按 internal 管理。

本轮新增 80 个路由中，仅 `/api/av/setAttrViewFilters` 和 `/api/av/setAttrViewSorts` 同时进入当前公开 API 文档；其他新增路由仍是内部能力。

## 2. 增量模块统计

| 模块 | 新增数 | 风险提示 |
|---|---:|---|
| `ai` | 25 | 高：公开测试/模型与会话结构可能变化 |
| `notebook` | 12 | 高：加密、密钥与恢复 |
| `import` | 8 | 高：长任务和数据迁移 |
| `plugin` | 5 | 高：内核插件协议与状态 |
| `storage` | 4 | 中：前端存储实现细节 |
| `transactions` | 4 | 高：影响撤销/重做一致性 |
| `av` | 4 | 中：其中部分已公开，逐项核对 |
| `system` | 3 | 中：启动和引导流程 |
| `network` | 2 | 中高：代理和任意路径 |
| `repo` | 2 | 中高：仓库文件内部能力 |
| `search` | 2 | 中：索引/语义搜索实验能力 |
| `setting` | 2 | 高：密钥和变量写入 |
| `filetree` | 1 | 中：内部路径能力 |
| `history` | 1 | 中：文档历史 |
| `cloud` | 1 | 中高：云端提醒 |
| `block` | 1 | 中：块存在性探测 |
| `asset` | 1 | 中：资源写入 |
| `export` | 1 | 中：导出文件复制 |
| `lute` | 1 | 中：Markdown 转换 |

## 3. 新增路由明细

### `/api/ai`（25）

| 路由 | 当前公开状态 |
|---|---|
| `/api/ai/agent/chat` | internal：仅 router 可见 |
| `/api/ai/agent/confirm` | internal：仅 router 可见 |
| `/api/ai/agent/frontendToolResult` | internal：仅 router 可见 |
| `/api/ai/agent/getSession` | internal：仅 router 可见 |
| `/api/ai/agent/getSkill` | internal：仅 router 可见 |
| `/api/ai/agent/lsSessions` | internal：仅 router 可见 |
| `/api/ai/agent/lsSkills` | internal：仅 router 可见 |
| `/api/ai/agent/question` | internal：仅 router 可见 |
| `/api/ai/agent/removeSession` | internal：仅 router 可见 |
| `/api/ai/agent/removeSkill` | internal：仅 router 可见 |
| `/api/ai/agent/renameSkill` | internal：仅 router 可见 |
| `/api/ai/agent/saveSession` | internal：仅 router 可见 |
| `/api/ai/agent/saveSkill` | internal：仅 router 可见 |
| `/api/ai/agent/title` | internal：仅 router 可见 |
| `/api/ai/embeddingStat` | internal：仅 router 可见 |
| `/api/ai/listModels` | internal：仅 router 可见 |
| `/api/ai/mcp/oauth/callback/:flowID` | internal：仅 router 可见 |
| `/api/ai/mcpOAuthAuthorize` | internal：仅 router 可见 |
| `/api/ai/mcpOAuthDisconnect` | internal：仅 router 可见 |
| `/api/ai/mcpStatus` | internal：仅 router 可见 |
| `/api/ai/reindexEmbedding` | internal：仅 router 可见 |
| `/api/ai/retryFailedEmbedding` | internal：仅 router 可见 |
| `/api/ai/testEmbeddingModel` | internal：仅 router 可见 |
| `/api/ai/testModel` | internal：仅 router 可见 |
| `/api/ai/testRerankModel` | internal：仅 router 可见 |

### `/api/asset`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/asset/insertCover` | internal：仅 router 可见 |

### `/api/av`（4）

| 路由 | 当前公开状态 |
|---|---|
| `/api/av/createAttributeViewItem` | internal：仅 router 可见 |
| `/api/av/getAttributeViewBacklinks` | internal：仅 router 可见 |
| `/api/av/setAttrViewFilters` | stable：已进入官方 API 文档 |
| `/api/av/setAttrViewSorts` | stable：已进入官方 API 文档 |

### `/api/block`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/block/checkBlocksExist` | internal：仅 router 可见 |

### `/api/cloud`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/cloud/setCloudReminder` | internal：仅 router 可见 |

### `/api/export`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/export/copyExportFile` | internal：仅 router 可见 |

### `/api/filetree`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/filetree/getShorthandSavePath` | internal：仅 router 可见 |

### `/api/history`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/history/createDocHistory` | internal：仅 router 可见 |

### `/api/import`（8）

| 路由 | 当前公开状态 |
|---|---|
| `/api/import/cancelImportSY` | internal：仅 router 可见 |
| `/api/import/cancelObsidianVaultTask` | internal：仅 router 可见 |
| `/api/import/continueImportSY` | internal：仅 router 可见 |
| `/api/import/getObsidianVaultTask` | internal：仅 router 可见 |
| `/api/import/importSYAuto` | internal：仅 router 可见 |
| `/api/import/importSYNotebook` | internal：仅 router 可见 |
| `/api/import/startObsidianVaultAnalysis` | internal：仅 router 可见 |
| `/api/import/startObsidianVaultImport` | internal：仅 router 可见 |

### `/api/lute`（1）

| 路由 | 当前公开状态 |
|---|---|
| `/api/lute/md2html` | internal：仅 router 可见 |

### `/api/network`（2）

| 路由 | 当前公开状态 |
|---|---|
| `/api/network/echo/*path` | internal：仅 router 可见 |
| `/api/network/proxy` | internal：仅 router 可见 |

### `/api/notebook`（12）

| 路由 | 当前公开状态 |
|---|---|
| `/api/notebook/changeMasterPassword` | internal：仅 router 可见 |
| `/api/notebook/createEncryptedNotebook` | internal：仅 router 可见 |
| `/api/notebook/disableEncryptedNotebooks` | internal：仅 router 可见 |
| `/api/notebook/enableEncryptedNotebooks` | internal：仅 router 可见 |
| `/api/notebook/exportNotebookCryptoBackup` | internal：仅 router 可见 |
| `/api/notebook/getEncryptedNotebookStatus` | internal：仅 router 可见 |
| `/api/notebook/importNotebookCryptoBackup` | internal：仅 router 可见 |
| `/api/notebook/lockNotebook` | internal：仅 router 可见 |
| `/api/notebook/setNotebookCryptoAutoLock` | internal：仅 router 可见 |
| `/api/notebook/touchEncryptedNotebooks` | internal：仅 router 可见 |
| `/api/notebook/unlockAndOpenNotebook` | internal：仅 router 可见 |
| `/api/notebook/unlockNotebook` | internal：仅 router 可见 |

### `/api/plugin`（5）

| 路由 | 当前公开状态 |
|---|---|
| `/api/plugin` | internal：仅 router 可见 |
| `/api/plugin/getLoadedPlugin` | internal：仅 router 可见 |
| `/api/plugin/listLoadedPlugins` | internal：仅 router 可见 |
| `/api/plugin/rpc` | internal：仅 router 可见 |
| `/api/plugin/rpc/:name` | internal：仅 router 可见 |

### `/api/repo`（2）

| 路由 | 当前公开状态 |
|---|---|
| `/api/repo/exportRepoFile` | internal：仅 router 可见 |
| `/api/repo/searchRepoFile` | internal：仅 router 可见 |

### `/api/search`（2）

| 路由 | 当前公开状态 |
|---|---|
| `/api/search/getAssetContentByPath` | internal：仅 router 可见 |
| `/api/search/semanticSearchBlock` | internal：仅 router 可见 |

### `/api/setting`（2）

| 路由 | 当前公开状态 |
|---|---|
| `/api/setting/setSecrets` | internal：仅 router 可见 |
| `/api/setting/setVariables` | internal：仅 router 可见 |

### `/api/storage`（4）

| 路由 | 当前公开状态 |
|---|---|
| `/api/storage/getLocalStorageVal` | internal：仅 router 可见 |
| `/api/storage/getLocalStorageVals` | internal：仅 router 可见 |
| `/api/storage/removeLocalStorageVal` | internal：仅 router 可见 |
| `/api/storage/setLocalStorageVals` | internal：仅 router 可见 |

### `/api/system`（3）

| 路由 | 当前公开状态 |
|---|---|
| `/api/system/bootProgressSSE` | internal：仅 router 可见 |
| `/api/system/dismissOnboarding` | internal：仅 router 可见 |
| `/api/system/ensureOnboarding` | internal：仅 router 可见 |

### `/api/transactions`（4）

| 路由 | 当前公开状态 |
|---|---|
| `/api/transactions/clearHistory` | internal：仅 router 可见 |
| `/api/transactions/redo` | internal：仅 router 可见 |
| `/api/transactions/undo` | internal：仅 router 可见 |
| `/api/transactions/undoState` | internal：仅 router 可见 |

## 4. v3.7.x 已存在的其他较新路由

下列路由不属于上述 80 个差异（它们已经存在于旧快照），但也是 v3.7.x 插件常用能力，迁移时应核对：

- `/api/setting/setTheme`、`/api/setting/setIcon`、`/api/ui/reloadTheme`
- `/api/file/workspaceCopyFiles`
- `/api/block/updateTaskListItemMarker`、`/api/block/batchUpdateTaskListItemMarker`

这些路由若未进入官方 API 文档，仍应视为 internal。

## 5. 风险处置清单

- AI、MCP、语义搜索：检查模型配置、索引状态、超时和取消。
- 内核插件 RPC：等待 `kernel-plugin-state-change` 到 `running`，处理 `-32002`。
- 加密笔记本：任何写操作前验证备份、锁状态和恢复路径。
- 导入与事务：避免重复提交，支持任务取消和失败恢复。
- 密钥与变量：不记录明文，只在必要范围内读取或写入。
- 每次提高 `minAppVersion` 或发布插件前，重新比较正式版 `router.go` 和 `docs/API.zh-CN.md`。
