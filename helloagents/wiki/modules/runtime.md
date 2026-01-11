# runtime 模块

本模块描述“浏览器运行时”的组成：页面、样式、交互与离线能力。

---

## 1) 文件与职责

- `*.html`
  - 多页入口（静态外壳），通过 `data-page` 标识页面类型
  - 动态页约定：`game.html?id=...` / `guide-detail.html?id=...` / `forum-topic.html?id=...`
  - 文档入口：`docs.html`（站内交互式渲染 `docs/*.md`，含贡献指南/数据模型/部署说明）

- `boot.js`
  - 在页面最早期执行：恢复主题、高对比度、No-JS 标记
  - 目标：减少“闪白/闪主题”的视觉抖动
  - 约定：当用户未显式设置时，可跟随系统 `prefers-contrast: more` / `forced-colors: active`

- `styles.css`
  - Aurora/Glass/Bento 视觉系统
  - EVO-VIS v2：黄金比例排版/间距 tokens（`--phi/--text-*/--space-*`）+ 12 级阴影阶梯（`--elev-1..12`）
  - UI Evolution v3：收敛 Aurora Glass SSOT（`--grad-* / --border-grad`），并将 Banner 升级为主题自适配玻璃面板；高对比度模式关闭 hover 边框流动
  - 通用栅格：12 列 grid helper（`.grid-12` / `.span-*` / `*-span-*`）为页面布局提供统一语义
  - 统一容器质感：主要卡片/面板采用毛玻璃（`backdrop-filter`）+ 内高光 + 动态渐变边框（mask ring；尊重 `prefers-reduced-motion`）
  - 加载态能力：Skeleton（`.skeleton*` / `.is-skeleton-card`）与 SVG Path Loader（`.ink-loader`）
  - 对 `prefers-reduced-motion` 提供降级规则
  - Motion tokens：统一关键交互的时长与 Bezier（按钮/弹窗/滚动 reveal）
  - 超长文本体验：标题提供截断 + 渐变遮罩（mask 支持时更细腻）

- `data.js`
  - 注入 `window.GKB.data`（站点数据 + version）

- `scripts.js`
  - 全站交互集中入口（无框架）
  - 关键策略：
    - 断链兜底：缺失 id 也能渲染“建设中”
    - Local-first：收藏/筛选/进度/笔记/回复等持久化到 `localStorage`
    - 按 `data-page` 精确调度页面级 init，减少无效调用
    - 网络状态闭环：`netStore` 统一维护 online/connection/inflight/error，减少散落监听
    - 高延迟优化：内部链接 hover/focus 预取（prefetch），让跨页更“跟手”
    - 意图预取：在筛选/搜索等明确意图场景预取 Top-N 详情页（弱网/省流/离线自动降级）
    - 长列表虚拟化：当列表规模巨大时自动启用虚拟列表（只渲染可视区），避免一次性创建海量 DOM
    - 本地埋点：`telemetry` 仅记录本地事件（默认启用可关闭），用于定位交互与性能优化机会；调试句柄暴露在 `GKB.runtime.telemetry`
    - 工程自诊断：提供 `GKB.health()` 与 `GKB.runtime.health.start()` 采样输出（FPS/LongTask/CLS/LCP/内存等）
    - 错误边界与诊断面板：捕获 `error/unhandledrejection/securitypolicyviolation` 并写入 `gkb-diagnostics-errors`；可在指挥舱/Command Palette 打开诊断面板并导出诊断包（调试句柄：`GKB.runtime.diagnostics`）
    - 本地日志：统一 `logger`（ring buffer），默认持久化 `info/warn/error` 写入 `gkb-diagnostics-logs`；可在诊断面板查看/清空（调试句柄：`GKB.runtime.logger`）
    - 行为画像引擎：基于收藏/进度/路线等本地信号生成 DNA、动量、冲刺、热度与影响力指标，驱动指挥舱/探索/路线/社区/更新中心
  - 动效：
    - 内建 `MotionLite`（WAAPI 轻量层：`animate/stagger`）
    - 统一走 `motionAnimate` 并尊重 `prefers-reduced-motion`

- `sw.js`
  - 离线缓存与预缓存策略
  - 版本机制：从 `sw.js?v=...` 读取 VERSION，CacheName 绑定版本，避免缓存幽灵

- `manifest.webmanifest`
  - PWA 元信息与快捷入口（Shortcuts）

---

## 2) 运行时状态（localStorage）

所有 key 使用 `gkb-` 前缀，避免与其他站点冲突；导出/导入用于本地备份迁移。      

补充：诊断相关 key（仅本地存储，不外发）

- `gkb-diagnostics-errors`：运行时错误边界记录（ring buffer）
- `gkb-diagnostics-logs`：运行时本地日志（ring buffer；默认仅持久化 `info/warn/error`）
- `gkb-telemetry-enabled` / `gkb-telemetry-events`：本地埋点开关与事件列表

---

## 3) 离线与缓存策略

- HTML：网络优先，但短窗口等待网络，超时回退缓存并后台刷新（高延迟下避免白屏）  
- 静态资源：SWR（命中缓存立即返回，后台刷新保持更新）
- 预缓存：核心入口页 + 关键资源（带版本）+ 订阅/搜索描述文件 + `docs/*.md`      

---

## 4) 行为画像与智能节奏

- **DNA 画像:** 汇总标签权重，形成偏好雷达与推荐基线
- **动量节奏:** 结合收藏/进度/路线完成度生成节奏标签
- **冲刺规划:** 根据专注时长切分路线并生成可复制的计划摘要
- **热度雷达:** 综合参与度与更新频率，输出社区热度排序
- **影响力评分:** 对更新条目进行影响力打分与等级标记

---

## 5) 变更历史

- [202601120253_local-logging-and-runtime-checks](../../history/2026-01/202601120253_local-logging-and-runtime-checks/) - 本地日志监控 + 运行时质量门禁（诊断面板扩展 / CI 门禁）
- [202601120222_observability-runtime-diagnostics](../../history/2026-01/202601120222_observability-runtime-diagnostics/) - 运行时可观测性与诊断闭环（错误边界/诊断面板/指标增强）
- [202601112050_quantum-runtime-expansion](../../history/2026-01/202601112050_quantum-runtime-expansion/) - 量子运行时扩展与体验重构
