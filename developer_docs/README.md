# 思源插件开发文档

本目录是面向思源笔记插件开发的本地参考文档，覆盖前端插件 API、内核 HTTP API、属性视图（AV）、块模型与发布流程。

## 版本基线

- 适用版本：SiYuan `v3.7.3`（最后核对：2026-08-02）
- 前端插件类型包：npm `siyuan@1.2.3`
- 上游发布：Release `v3.7.3`（2026-07-21）
- 上游 `master` 基线：`eef10568384e2e7cf547adb029ae46a72e43c287`
- 本地分析源码：`D:\MyCodingProjects\siyuan-master`

> `siyuan-note/petal` 的 `main` 分支可能包含尚未发布的类型变更。本项目以 npm 最新正式版 `siyuan@1.2.3` 为插件类型基线，以 SiYuan `v3.7.3` 发布源码为运行时基线。

## 本轮同步重点

- v3.7.0 引入内核插件、命令行、密钥与变量、AI 智能体和嵌入向量能力。
- v3.7.1～v3.7.2 增加主题/图标重载、工作空间文件复制、任务列表标记批量更新、`Protyle.switchMode` 等能力。
- v3.7.3 明确异步加载顺序：等待前端插件 `onload()` 和内核插件初始化完成后，再调用 `onLayoutReady()`。
- 官方公开内核 API 共 67 个端点，其中数据库（AV）16 个端点已进入正式公开文档。
- `router.go` 当前包含 540 个唯一 `/api/*` 路由；未进入官方 API 文档的路由仍按内部接口管理。

详细迁移说明见 [`00-version/SiYuan-v3.7.3开发进展与API迁移指南.md`](00-version/SiYuan-v3.7.3开发进展与API迁移指南.md)。

## 同步策略

- 主文档层（`01`～`06`）：面向插件开发实战，保持精炼。
- 附录索引层（`07`）：面向官方公开 API 和全量路由风险追踪。
- 官方快照层（`03-kernel-api/official`）：原样保存当前源码中的 `docs/API.zh-CN.md` 与 `kernel/api/router.go`，便于审计和差异比较。

## 推荐阅读路径

1. [v3.7.3 开发进展与 API 迁移指南](00-version/SiYuan-v3.7.3开发进展与API迁移指南.md)
2. [插件开发入门与工程实践](01-start/插件开发入门与工程实践.md)
3. [关键概念与数据架构速览](01-start/关键概念与数据架构速览.md)
4. [插件类与生命周期](02-plugin-api/插件类与生命周期.md)
5. [常用方法速览](02-plugin-api/常用方法速览.md)
6. [公开内核 API 导航](03-kernel-api/公开API导航.md)
7. [数据库与 AV](04-database-av/AV增删改查与参数模型.md)
8. [块模型与属性规范](05-block-model/块模型与属性规范.md)
9. [调试与发布流程](06-guides/调试与发布流程.md)
10. [官方 API 全量索引](07-official-index/官方API全量索引-按模块.md)
11. [router 路由变更与风险索引](07-official-index/router路由变更与风险索引.md)

## 目录

- `00-version/`：版本基线、开发进展与迁移指南
- `01-start/`：环境、模板、最小插件骨架、关键概念与数据架构
- `02-plugin-api/`：Plugin 生命周期、方法、事件总线、类型索引
- `03-kernel-api/`：公开 API 导航、非公开 API 风险、调用示例和官方快照
- `04-database-av/`：属性视图（数据库）增删改查、实战示例、SQL 结构详解
- `05-block-model/`：块类型、块属性、映射详表与实践限制
- `06-guides/`：SDK 边界、调试、发布、版本策略
- `07-official-index/`：官方公开 API 全量索引与路由风险索引

## 文档使用约定

每篇核心文档应标注：

- 适用版本
- 最后核对日期
- 稳定性（`stable` / `internal` / `deprecated`）
- 权威来源

判断 API 稳定性时遵循以下优先级：

1. `docs/API.zh-CN.md`：官方公开内核 API。
2. npm `siyuan` 类型声明：正式发布的前端插件 API。
3. `kernel/api/router.go` 与应用源码：用于发现内部能力和核对实现，不代表兼容性承诺。
