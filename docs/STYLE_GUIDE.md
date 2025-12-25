# 样式与交互规范（快速约定）

这是一份“能长期维护”的最小规范，目标是：**不引框架也能稳定扩展**，并避免常见的静态站点坑。

---

## 1) 缓存穿透（必须）

所有页面必须使用带版本号的静态资源引用：

```html
<link rel="stylesheet" href="styles.css?v=20251225-2">
<link rel="manifest" href="manifest.webmanifest?v=20251225-2">
<script src="boot.js?v=20251225-2"></script>
<script src="data.js?v=20251225-2" defer></script>
<script src="scripts.js?v=20251225-2" defer></script>
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
- 对比度：`localStorage["gkb-contrast"]`（`high` / `normal`）
  - 约定：当用户未显式设置时，站点可跟随系统 `prefers-contrast: more` / `forced-colors: active`（由 `boot.js` 首帧注入，`scripts.js` 负责二次对齐与持久化）
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

---

## 6) 动效规范（Motion / View Transition）

目标：**动效可复用、可回归、可降级**——不追求“到处都在动”，而追求“该动的地方动得更对”。

### 6.1 Motion 统一参数（强烈推荐）

`scripts.js` 里提供了全站统一的动效参数与封装：

- `MotionLite（内建）`：`scripts.js` 内置 **WAAPI 轻量动效层**（提供 `animate/stagger`，无额外依赖）
- `MOTION.easeOut`：默认出场/弹性（例如 Toast / 弹窗开合）
- `MOTION.durFast / durBase / durSlow`：统一时长档位
- `motionAnimate(el, keyframes, options)`：统一入口（自动处理 `prefers-reduced-motion` + try/catch）
- 常用微交互：`motionPulse` / `motionSpark` / `motionFlash`

约定：新增动效时 **优先复用上述 helper**，避免散落的 magic number 导致“风格漂移”。

### 6.2 Reduced Motion（必须可降级）

- JS：所有 Motion 动效都必须走 `motionAnimate`（内部会检测 `prefers-reduced-motion`）
- CSS：对粒子/大幅动画使用 `@media (prefers-reduced-motion: reduce)` 直接关掉或压缩到极短

用户选择减少动态效果时，站点应保持 **信息层级与可用性不变**。

### 6.3 性能红线（动效也要性能）

- **优先动画 transform/opacity/filter**（GPU 友好），避免频繁 layout 抖动
- 如必须动画布局（例如列表删除的 collapse），只允许在“单个元素”上短时执行，并确保可以降级
- 事件绑定优先事件委托（避免“每次 render 绑 N 个 listener”）

### 6.4 View Transition（跨页/同页）

- 同页重排：用 `withViewTransition(fn)` 包裹关键 DOM 更新（可用则启用，不可用自动降级）
- 跨页形变：通过 `view-transition-name` + `@view-transition { navigation: auto; }` 实现共享元素映射
  - 新页面必须在首帧前打标（`boot.js` 负责注入 `html[data-vt-kind]`）
  - 支持 VT 时不要 `preventDefault` 拦截导航，否则浏览器无法捕获快照
  - 当前已支持的 `data-vt-kind`：`game` / `guide` / `topic`
  - 映射策略：源页写入 `vt-card/vt-media/vt-title`，目标页用 `html[data-vt-kind]` 选择器把 Banner/标题映射到同名 `view-transition-name`
- Root 级过渡：使用 `::view-transition-old(root)` / `::view-transition-new(root)` 做轻量“导演剪辑”淡入淡出（避免抢镜）
  - 必须在 `prefers-reduced-motion: reduce` 下关闭或极大缩短
