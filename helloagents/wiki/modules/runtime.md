# runtime 模块

本模块描述“浏览器运行时”的组成：页面、样式、交互与离线能力。

---

## 1) 文件与职责

- `*.html`
  - 多页入口（静态外壳），通过 `data-page` 标识页面类型
  - 动态页约定：`game.html?id=...` / `guide-detail.html?id=...` / `forum-topic.html?id=...`
  - 文档入口：`docs.html`（站内交互式渲染 `docs/*.md`）

- `boot.js`
  - 在页面最早期执行：恢复主题、高对比度、No-JS 标记
  - 目标：减少“闪白/闪主题”的视觉抖动

- `styles.css`
  - Aurora/Glass/Bento 视觉系统
  - 对 `prefers-reduced-motion` 提供降级规则

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
    - 长列表虚拟化：当列表规模巨大时自动启用虚拟列表（只渲染可视区），避免一次性创建海量 DOM
    - 工程自诊断：提供 `GKB.health()` 与 `GKB.runtime.health.start()` 采样输出（FPS/LongTask/CLS/LCP/内存等）
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

---

## 3) 离线与缓存策略

- HTML：网络优先，但短窗口等待网络，超时回退缓存并后台刷新（高延迟下避免白屏）
- 静态资源：SWR（命中缓存立即返回，后台刷新保持更新）
- 预缓存：核心入口页 + 关键资源（带版本）+ 订阅/搜索描述文件 + `docs/*.md`
