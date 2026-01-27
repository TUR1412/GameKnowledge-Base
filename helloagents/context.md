# 项目上下文（GameKnowledge-Base）

## 1) 项目定位

GameKnowledge-Base（GKB）是一个**数据驱动的纯静态多页站点**：

- **无后端、无框架**：HTML/CSS/JS 直接运行
- **本地优先**：收藏/进度/笔记/计划/回复等状态落地 `localStorage`
- **PWA 离线**：`sw.js` + Cache Storage + `manifest.webmanifest`
- **跨页体验**：Soft Navigation + View Transitions（可用则启用，自动降级）
- **质量门禁**：`npm run check:all` + `node --test`（含覆盖率阈值）+ 多项静态校验脚本

## 2) 关键资产（运行时 SSOT）

- `data.js`：唯一数据源（`window.GKB.data`），包含 `games/guides/topics + version`
- `scripts.js`：无框架运行时交互（IIFE，按 `data-page` 精确初始化）
- `styles.css`：视觉系统与动效（EVO-VIS / Pixel UI）
- `boot.js`：首帧注入与偏好对齐（避免闪烁/错过 VT 映射）
- `sw.js` / `offline.html`：离线与缓存策略

## 3) 发布与缓存穿透（稳定交付契约）

- 版本号 SSOT：`content/meta.json` 的 `version`（存在时）；否则退回 `data.js` 的 `version: "YYYYMMDD-N"`
- 运行时数据仍以 `data.js` 为准（浏览器加载 `data.js`；当存在 `content/` 时由 `build-data` 生成）
- 核心资源以 `?v=` 统一穿透缓存（避免 SW/浏览器残留旧资源）
- 推荐一键 bump：`node tools/bump-version.mjs`

## 4) 当前工作焦点

- 升级路线：`helloagents/plan/202601272249_gkb_2026_full_upgrade/`
  - 目标：从“强交互静态站”进化为“可持续扩张的内容引擎 + 本地优先体验平台”
  - 原则：不引入后端、不引入运行时第三方依赖、保持严格 CSP，升级以工程化与可扩展性为核心
