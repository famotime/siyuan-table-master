# 非公开 API 与风险说明

- 适用版本：SiYuan `v3.7.3`
- 最后核对：2026-08-02
- 稳定性：internal
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - 本地快照：`official/router.go`

## 1. 公开与非公开的边界

- **公开 API**：出现在官方 `docs/API.zh-CN.md`，当前为 67 个端点；通常有更好的兼容性预期。
- **内部 API**：只在 `kernel/api/router.go` 或应用源码中可见，当前路由快照有 540 个唯一路由；不代表官方稳定承诺。
- 路由能被当前版本调用，不等于插件可以长期依赖。权限、参数、返回结构和中间件都可能变化。

## 2. 当前高风险内部能力

| 能力 | 典型路由 | 风险 |
|---|---|---|
| AI Agent、模型和嵌入 | `/api/ai/*` | 测试中能力多，模型配置和返回结构可能变化 |
| 内核插件 RPC | `/api/plugin/*` | 依赖内核插件状态和 bundle 协议 |
| 加密笔记本 | `/api/notebook/*` 中的加密相关接口 | 涉及密钥、锁定、备份和数据恢复 |
| 导入迁移 | `/api/import/*` | 长任务、取消、状态结构可能变化 |
| 事务历史 | `/api/transactions/*` | 影响撤销/重做和用户数据一致性 |
| 密钥、变量与存储 | `/api/setting/setSecrets`、`/api/setting/setVariables`、`/api/storage/*` | 权限、敏感数据和生命周期风险 |
| 内部搜索/仓库 | `/api/search/semanticSearchBlock`、`/api/repo/*` | 公开文档未承诺，依赖索引或仓库状态 |

## 3. 差异统计

与本项目旧版 460 个唯一路由快照相比，v3.7.3 的 `router.go` 有 540 个唯一路由，新增 80 个、删除 0 个。新增集中在 AI、内核插件、加密笔记本、导入迁移、事务、存储、AV 和网络代理等模块。

具体模块差异与审计入口见：[router 路由变更与风险索引](../07-official-index/router路由变更与风险索引.md)。

## 4. 使用策略

1. 优先寻找公开 API；不要为了少写代码而直接调用内部路由。
2. 使用内部 API 前先做版本探测、权限探测和参数能力探测。
3. 为每个内部调用提供失败回退、用户可理解的错误和数据备份。
4. 不要把内部路由写成“官方稳定 API”或直接复制到公共 SDK。
5. 发布前用当前正式版 SiYuan 重新验证，不能只验证开发分支。

```ts
async function callWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn("primary API unavailable, using fallback", error);
    return await fallback();
  }
}
```

## 5. 特别注意

- `/api/ai/*`、`/api/plugin/*`、加密笔记本、导入迁移和事务接口不应在没有版本门槛的情况下调用。
- 只读模式、锁屏、权限和启动阶段会使内部调用失败；失败不一定意味着端点不存在。
- API Token、密钥、变量和用户数据不得写入日志、错误上报或 AI 结果。
- 发现 `router.go` 中有 `deprecated` 或迁移注释时，应优先搜索公开替代 API。
