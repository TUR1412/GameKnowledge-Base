# Changelog

本文件记录由 HelloAGENTS 驱动的结构化变更历史（知识库 SSOT），用于与代码事实对齐。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
版本号遵循项目自身的发布版本（`data.js` 的 `version: "YYYYMMDD-N"`）。

## [Unreleased]

## [20251224-1] - 2025-12-24

### 新增
- OpenSearch：新增 `opensearch.xml`，并在全站页面 head 注入 `<link rel="search" ...>`
- Atom 更新订阅：新增 `tools/generate-feed.mjs` 生成 `feed.xml`，并在 CI 中执行 `--check`
- 离线增强：`sw.js` 预缓存新增 `feed.xml` 与 `opensearch.xml`

### 变更
- 动效层内建：将 Motion WAAPI 轻量实现内联到 `scripts.js`（MotionLite），移除额外脚本请求
- 启动调度优化：`scripts.js` 按 `data-page` 精确执行页面级 init，减少无意义初始化调用
- 工具链对齐：`tools/check-links.mjs` / `tools/check-sw.mjs` / 单测适配动效脚本移除

### 移除
- `vendor/motion.js` 以及所有引用（HTML / SW / 工具链 / 单测）
