# 样式与交互规范（快速约定）

这是一份“能长期维护”的最小规范，目标是：**不引框架也能稳定扩展**，并避免常见的静态站点坑。

---

## 1) 缓存穿透（必须）

所有页面必须使用带版本号的静态资源引用：

```html
<link rel="stylesheet" href="styles.css?v=20251222-1">
<link rel="manifest" href="manifest.webmanifest?v=20251222-1">
<script src="boot.js?v=20251222-1"></script>
<script src="data.js?v=20251222-1" defer></script>
<script src="scripts.js?v=20251222-1" defer></script>
```

当你修改以下任意文件时，请同步更新所有 HTML 页里的 `?v=`：

- `styles.css`
- `boot.js`
- `scripts.js`
- `data.js`
- `manifest.webmanifest`
- `sw.js`（离线缓存版本依赖 `?v=`）

CI 会强制检查（见 `tools/check-links.mjs`）。

### 一键更新版本号（推荐）

为了避免手工逐页替换导致漏改，本仓库提供了版本号自动升级脚本（会同时更新 `data.js` 与所有根目录 HTML 的资源引用版本号）：

```bash
node tools/bump-version.mjs
```

你也可以先预览（不写入）：

```bash
node tools/bump-version.mjs --dry-run
```

---

## 2) JS 失效也要可见（必须）

禁止把核心内容默认设为不可见等待 JS “救场”。

目前约定：

- `.animate-on-scroll` 在 `.no-js` 或 `prefers-reduced-motion` 下必须直接可见
- 动效只作为“锦上添花”，不能作为“基本可用性”的前置条件

---

## 3) 交互与状态（推荐）

- 主题：`localStorage["gkb-theme"]`
- 搜索：Command Palette（`Ctrl + K` / `/`）
- 筛选/收藏/话题回复：全部落地到 `localStorage`，刷新不丢（含 `gkb-saved-games` / `gkb-saved-guides` / `gkb-saved-topics`）
- 游戏/攻略笔记：`gkb-game-notes:*` / `gkb-guide-notes:*`
- 攻略进度清单：`gkb-guide-checklist:*`
- 攻略阅读设置：`gkb-guide-font-size` / `gkb-guide-line-height` / `gkb-guide-reading-mode` / `gkb-guide-last-section:*`
- 话题排序偏好：`gkb-forum-sort:*`
- 话题库筛选：`gkb-community-topics-state`

---

## 4) 不要引入外链资源（推荐）

为了离线可用与稳定交付，尽量使用本地资源：

- 图标：`images/icons/*`
- 占位图：`images/placeholders/*`

---

## 5) 换行与编码

已提供：

- `.editorconfig`
- `.gitattributes`

确保在 Windows / macOS / Linux 上显示一致，避免 CRLF/LF 混乱导致的 diff 噪音。
