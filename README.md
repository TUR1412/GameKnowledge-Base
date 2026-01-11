<p align="center">
  <img src="images/icons/favicon.svg" width="72" height="72" alt="GameKnowledge-Base">
</p>

<h1 align="center">GameKnowledge-Base</h1>
<p align="center"><strong>游戏攻略网 · Data-driven Game Knowledge Base</strong></p>
<p align="center">纯静态 · 无框架 · Local-first · PWA 离线 · Quantum Glass</p>
<p align="center">
  <a href="#概览--overview">概览</a> · <a href="#体验亮点--highlights">亮点</a> · <a href="#快速开始--quick-start">快速开始</a> · <a href="#结构--structure">结构</a> · <a href="#design-language--design-language">设计语言</a> · <a href="#contributing--贡献">贡献</a>
</p>

<p align="center">
  <img src="images/demos/demo-view-transition.svg" width="880" alt="Quantum Preview">
</p>

<p align="center">
  <img src="images/demos/demo-command-palette.svg" width="280" alt="Command Palette">
  <img src="images/demos/demo-planner.svg" width="280" alt="Planner">
  <img src="images/demos/demo-updates.svg" width="280" alt="Updates">
</p>

---

## 概览 / Overview

游戏攻略网是一个“数据驱动的纯静态多页站点”，以 `data.js` 作为唯一数据源，融合 PWA 与本地状态，提供可离线、可收藏、可追踪进度的游戏知识库体验。

GameKnowledge-Base is a data-driven static multi-page site powered by `data.js` as the single source of truth. It blends PWA offline support with local-first state to deliver a fast, trackable, and privacy-respecting knowledge experience.

---

## 体验亮点 / Highlights

| 模块 | 说明（中文） | Description (EN) |
| --- | --- | --- |
| 指挥舱 DNA | 收藏/进度/路线生成画像与动量节奏 | Behavior DNA + momentum from local signals |
| 探索引擎 | 意图标签加权推荐与一键生成路线 | Intent-weighted discovery & plan builder |
| 路线冲刺 | 智能拆分节奏并可复制冲刺计划 | Smart sprint pacing with copyable schedule |
| 社区热度 | 热度雷达 + 话题画像标签 | Trend radar with topic profiling |
| 更新影响力 | NEW/UPDATED + 影响力评分 | Update radar with impact scoring |
| 系统诊断 | 错误边界 + 本地埋点 + 健康快照（可导出诊断包） | Error boundary + local telemetry + health snapshot (exportable bundle) |

---

## 快速开始 / Quick Start

1. 克隆仓库 / Clone the repo
2. 直接打开 `index.html` 体验站点 / Open `index.html` for local preview
3. 如需校验或构建：

```bash
npm ci
npm run check:all
npm run build:vite
```

---

## 结构 / Structure

```text
├─ *.html                 # 静态入口页
├─ data.js                # 唯一数据源（window.GKB.data）
├─ scripts.js             # 前端交互（无框架）
├─ styles.css             # 视觉系统（Quantum Glass + Bento）
├─ sw.js                  # Service Worker（离线缓存）
├─ manifest.webmanifest   # PWA 配置
├─ docs/                  # 文档中心（docs.html 动态加载）
└─ tools/                 # 校验 / 生成脚本
```

---

## 数据模型 / Data Model

- `window.GKB.data.version`: `YYYYMMDD-N`（缓存穿透 SSOT）
- `games / guides / topics`: 以 id 为 key 的字典结构

```js
window.GKB.data = {
  version: "YYYYMMDD-N",
  games: { /* ... */ },
  guides: { /* ... */ },
  topics: { /* ... */ }
};
```

---

## Design Language / 设计语言

- **Quantum Glass**：多层玻璃质感 + 渐变光晕背景
- **Bento Grid**：可组合的卡片化布局
- **DNA / Sprint / Heat**：将行为数据转译为可行动的信息层

---

## Local-first / 本地优先

所有交互数据仅存储在浏览器 `localStorage`：收藏、进度、路线、笔记、社区回复均不会上传服务器。

All interaction data stays in the browser via `localStorage`—no server, no tracking, no external APIs.

---

## 系统诊断 / Diagnostics

入口 / Entry:

- 指挥舱：`dashboard.html` → “系统诊断”卡片
- Command Palette：`Ctrl + K` → “打开系统诊断面板”

能力 / What you get:

- **错误边界**：自动捕获运行时异常 / Promise 未处理拒绝 / CSP 违规，并记录到本地
- **本地埋点**：只在本地保存（默认启用，可随时关闭）
- **健康快照**：FPS / LongTask / CLS / LCP / FCP / INP 等指标摘要
- **一键导出**：下载 `gkb-diagnostics-<version>-<date>.json` 诊断包，便于提 Issue/PR（不外发）

---

## Contributing / 贡献

请查看 `docs/CONTRIBUTING.md` 与 `docs/STYLE_GUIDE.md`，确保版本号与缓存穿透一致。

See `docs/CONTRIBUTING.md` and `docs/STYLE_GUIDE.md` for workflow, style, and versioning rules.
