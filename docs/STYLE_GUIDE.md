# 样式与交互规范（快速约定）

这是一份“能长期维护”的最小规范，目标是：**不引框架也能稳定扩展**，并避免常见的静态站点坑。

---

## 1) 缓存穿透（必须）

所有页面必须使用带版本号的静态资源引用：

```html
<link rel="stylesheet" href="styles.css?v=20260113-17">
<link rel="manifest" href="manifest.webmanifest?v=20260113-17">
<script src="boot.js?v=20260113-17"></script>
<script src="data.js?v=20260113-17" defer></script>
<script src="scripts.js?v=20260113-17" defer></script>
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
- Spring Panel In：弹层/面板入场可使用预计算 spring keyframes，并通过 `options.additive: false` 避免与基础 transform 叠加（保证手感一致）
- 常用微交互：`motionPulse` / `motionSpark` / `motionFlash`
- Micro-interactions（EVO-VIS v4）：`initMicroInteractions` 写入 `--fx-x/--fx-y`（Spotlight）与 `--fx-tx/--fx-ty`（Magnetic），并注入 `.fx-ripple` 与 `.is-pressed`；默认覆盖 `.btn/.btn-small/.icon-button/.chip/.tag/.toast/.small-game-card/.guide-article/.topic/.game-card.is-link-card/.social-icon` 以及 `.save-pill/.filter-chip/.view-btn/.cmdk-item/.search-btn/.filter-option/.toggle-pill/.checklist-item`（禁用控件自动跳过反馈）；CSS 负责渲染与降级（保持 UI/逻辑分离）
- Linkified Cards：`initSmallGameCardLinks` 会将 Card 统一为 `role="link" + tabindex="0"`，并优先触发内部 `<a>` 的 click 来复用 SoftNavigation / ViewTransition（避免“整卡可点击”绕过跨页转场）
- Range UI（Planner）：仅在 `#planner-focus-range` 写入 `--range-pct` 用于轨道填充表现；数值逻辑仍以 input.value 为准（保持 UI/逻辑分离）

约定：新增动效时 **优先复用上述 helper**，避免散落的 magic number 导致“风格漂移”。

### 6.2 Reduced Motion（必须可降级）

- JS：所有 Motion 动效都必须走 `motionAnimate`（内部会检测 `prefers-reduced-motion`）
- CSS：对粒子/大幅动画使用 `@media (prefers-reduced-motion: reduce)` 直接关掉或压缩到极短

用户选择减少动态效果时，站点应保持 **信息层级与可用性不变**。

### 6.3 性能红线（动效也要性能）

- **优先动画 transform/opacity/filter**（GPU 友好），避免频繁 layout 抖动
- 如必须动画布局（例如列表删除的 collapse），只允许在“单个元素”上短时执行，并确保可以降级
- 事件绑定优先事件委托（避免“每次 render 绑 N 个 listener”）

---

## 7) 视觉系统（Design Tokens / Aurora Glass）

为了避免“补丁越打越散”，本项目约定 **视觉系统以 `styles.css` 的 token 为 SSOT**：

- 渐变边框 / 光晕：`--grad-a/b/c`、`--border-grad`、`--glow-*`
- 毛玻璃：`--glass-*`（高对比度与 Reduced Motion 会降级）
- 层级阴影：`--elev-1..12` / `--card-shadow*`
- 关键按钮手感：`--btn-shadow*`（按钮/图标按钮统一消费）

建议实践：

- 需要“换风格/换品牌色”时，**优先改 token**，而不是到处改组件的 `rgba(...)`。
- 高对比度模式（`data-contrast="high"`）以可读性优先：关闭动态边框流动与强烈玻璃效果。

### 6.4 View Transition（跨页/同页）

- 同页重排：用 `withViewTransition(fn)` 包裹关键 DOM 更新（可用则启用，不可用自动降级）
- 跨页形变：通过 `view-transition-name` + `@view-transition { navigation: auto; }` 实现共享元素映射
  - 新页面必须在首帧前打标（`boot.js` 负责注入 `html[data-vt-kind]`）
  - 支持 VT 时不要 `preventDefault` 拦截导航，否则浏览器无法捕获快照
  - 当前已支持的 `data-vt-kind`：`game` / `guide` / `topic`
  - 映射策略：源页写入 `vt-card/vt-media/vt-title`，目标页用 `html[data-vt-kind]` 选择器把 Banner/标题映射到同名 `view-transition-name`
- Root 级过渡：使用 `::view-transition-old(root)` / `::view-transition-new(root)` 做轻量“导演剪辑”淡入淡出（避免抢镜）
  - 必须在 `prefers-reduced-motion: reduce` 下关闭或极大缩短

---

## 8) 原子设计（Atomic Design）

目标：在不引入框架的前提下，让 UI 具备“可组合、可扩展、可回归”的结构化演进能力。

### 8.1 原子（Atoms）

Atoms 是最小可复用的 UI 单元，应尽量无业务语义、可跨页面复用：

- 按钮：`.btn` / `.btn-secondary` / `.btn-small`
- 图标按钮：`.icon-button` / `.icon-button-text`
- 标记与标签：`.badge` / `.chip` / `.tag`
- 文本与排版：token（`--text-*` / `--space-*` / `--elev-*`）+ 标题/段落基础样式

约定：新增视觉风格或“手感”调整时，优先改 token（SSOT），再由 Atoms 自动继承。

### 8.2 分子（Molecules）

Molecules 是由多个 Atoms 组合的“可重复 UI 片段”，例如：

- 卡片：`.bento-card` / `.mini-card` / `.stat-card`
- 信息列表：`.meta-list`
- Toast / Dialog 的头部与操作区（统一按钮规格、间距与层级）

约定：页面内出现 2 次以上的相同组合，优先沉淀为 Molecule（避免每页都写一套“私有 CSS”）。

### 8.3 组织（Organisms）

Organisms 是更大粒度的页面结构/模块组合：

- Header / Nav（主导航 + 操作区）
- Hero / Banner（主视觉与关键 CTA）
- 指挥舱 / Planner / Discover 等页面级信息架构
- 系统面板：Command Palette / Diagnostics / Compare（统一交互壳）

约定：Organisms 的职责是“布局与信息架构”，不要把细节样式硬编码在 Organisms 内。

### 8.4 图片性能（Lighthouse / CLS）

为了降低 CLS 与首屏竞争，本项目约定对静态 HTML 中的图片显式声明加载策略：

```html
<!-- 默认：延迟加载 + 异步解码 -->
<img loading="lazy" decoding="async" src="images/..." alt="...">

<!-- 首屏关键图：显式 eager + 提高优先级（可选） -->
<img loading="eager" fetchpriority="high" decoding="async" src="images/..." alt="...">
```

门禁：`tools/check-html.mjs` 会要求每个 `<img>` 都包含 `loading` 与 `decoding`，避免“无意识”回退到默认策略。
