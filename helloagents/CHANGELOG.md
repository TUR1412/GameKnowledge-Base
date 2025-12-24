# Changelog

本文件记录由 HelloAGENTS 驱动的结构化变更历史（知识库 SSOT），用于与代码事实对齐。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
版本号遵循项目自身的发布版本（`data.js` 的 `version: "YYYYMMDD-N"`）。

## [Unreleased]

## [20251224-5] - 2025-12-24

### 新增
- 视觉一致性增强：为标题补齐“截断 + 渐变遮罩”能力（mask 支持时更细腻），并在关键列表卡片中补齐 `title` 悬浮提示

### 变更
- UI 对齐修复：Header 水平对齐统一交由 `.container` 控制（移除重复 padding 叠加）
- 横幅纹理层零依赖化：移除缺失的 `bg-pattern.svg` 引用，改为纯 CSS pattern（避免构建期 unresolved）
- 动效手感收敛：引入 Motion tokens（时长 + Bezier）并复用到按钮/弹窗/卡片等关键交互
- 版本号：bump 至 `20251224-5`（同步更新全站 `?v=` 与 `data.js.version`）

## [20251224-4] - 2025-12-24

### 新增
- 长列表虚拟化：为攻略库与话题库接入 `createVirtualList`（可扩展到 10w 条数据量，仅渲染可视区）
- 工程自诊断：新增 `GKB.health()` 与 `GKB.runtime.health`（FPS / LongTask / CLS / LCP / 内存等采样）
- 视觉组件：新增虚拟列表行样式（`vlist-row*`），为超大列表提供稳定可读布局

### 变更
- 网络交互收敛：`netClient` 默认只允许同源 URL（降低被滥用为“任意外链请求器”的风险），并偏向使用 `force-cache`
- 文档渲染更稳健：`docs.html` 的 Markdown link sanitization 进一步收紧（阻止 `data:` / `file:` 等协议）
- 版本号：bump 至 `20251224-4`（同步更新全站 `?v=` 与 `data.js.version`）

## [20251224-3] - 2025-12-24

### 新增
- 交互式文档入口：新增 `docs.html`（同源加载并渲染 `docs/*.md`），并纳入 SW 预缓存
- 运行时网络状态闭环：新增 `netStore` / `netClient`（timeout/retry、memory cache、inflight 计数）
- 预取加速：链接 hover/focus 预取内部 `.html`，提高高延迟网络下跨页体感

### 变更
- Service Worker：导航请求支持“短窗口等待网络，否则回退缓存并后台刷新”；资源请求改为 SWR（缓存优先 + 后台更新）
- Connectivity Toast：由 `netStore` 订阅驱动，减少重复监听并统一状态来源
- 版本号：bump 至 `20251224-3`（同步更新全站 `?v=` 与 `data.js.version`）

## [20251224-2] - 2025-12-24

### 新增
- 极限压缩构建：新增 `vite.config.mjs` + `src/bundle.mjs`，并补齐 `npm run build:vite` 与 CI 构建步骤
- 工具链共享库：新增 `tools/lib/site.mjs`，统一复用 base/url/xml/data 加载逻辑

### 变更
- 工具脚本去重：`tools/generate-sitemap.mjs` / `tools/check-sitemap.mjs` / `tools/generate-feed.mjs` 复用共享库
- URL 参数解析去重：`scripts.js` 抽象 `readSearch*` helper，多个页面共享同一套解析逻辑

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
