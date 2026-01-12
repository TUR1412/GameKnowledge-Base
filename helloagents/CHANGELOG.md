# Changelog

本文件记录由 HelloAGENTS 驱动的结构化变更历史（知识库 SSOT），用于与代码事实对齐。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
版本号遵循项目自身的发布版本（`data.js` 的 `version: "YYYYMMDD-N"`）。

## [Unreleased]

### 新增
- PWA Manifest 门禁：新增 `tools/check-manifest.mjs` 校验 `manifest.webmanifest`（必备字段/图标与快捷入口资源/禁止外链），并纳入 `check:all` 与 CI
- Bundle Size 预算门禁：新增 `tools/check-bundlesize.mjs` 校验 Vite 构建产物 `dist/gkb.min.{css,js}` gzip 体积，并纳入 `check:all` 与 CI（默认 CSS≤30kB/JS≤80kB，可通过 env 覆盖）
- 社区标准化：新增 `SECURITY.md` / `CODE_OF_CONDUCT.md`（并同步到 Docs Portal），补齐 Issue/PR 模板提升协作一致性
- 依赖自动更新：新增 `.github/dependabot.yml`，对 npm 依赖与 GitHub Actions 进行每周更新检查
- 安全扫描：新增 CodeQL 工作流 `.github/workflows/codeql.yml`（push/PR/每周定时）对 JavaScript 做静态分析
- A11y/SEO 门禁：新增 `tools/check-a11y.mjs` 校验 `lang/title/description` 与 CSP 兼容（禁止 inline style / on* handler），并纳入 `check:all` 与 CI
- A11y 细化：主导航（`#site-nav`）当前页链接统一补齐 `aria-current="page"`，并由门禁防回退

### 变更
- PWA 离线预缓存：`sw.js` 补齐 `docs/SECURITY.md` 与 `docs/CODE_OF_CONDUCT.md`（Docs Portal 离线可读）
- README：补齐 CI/CodeQL 状态徽章，并更新质量门禁清单（对齐 `npm run check:all`）
- HTML（CLS）：对 `images/placeholders/*` 的 `<img>` 强制要求 `width/height`，并补齐 `starlight-miracle.html` 占位图尺寸（降低布局抖动）

## [20260113-4] - 2026-01-13

### 变更
- Pixel UI v4.1：修复排版字距漂移（letter-spacing），并收敛 Banner/Card surface 为 token 驱动（暗色主题一致）
- 微交互覆盖：Micro-interactions 扩展到 `save-pill/filter-chip/view-btn/cmdk-item`，并对禁用控件自动跳过反馈（保持 UI/逻辑分离）
- 版本号 bump 至 `20260113-4`（全站 `?v=` 与 `data.js.version` 同步）

## [20260113-3] - 2026-01-13

### 变更
- 动效一致性：FX Transform System 在 hover/active/pressed 态显式输出 transform，避免历史样式覆盖（提升 Magnetic/Press 的稳定性）
- 版本号 bump 至 `20260113-3`（全站 `?v=` 与 `data.js.version` 同步）

## [20260113-2] - 2026-01-13

### 变更
- 微交互：`initMicroInteractions` 新增 Magnetic 磁吸跟随（spring + rAF）与 Press 按压态（`.is-pressed`），并用 CSS variables（`--fx-tx/--fx-ty`）保持 UI/逻辑分离
- 视觉系统：新增 FX Transform System（magnetic + hover lift + press 合成 transform），统一 `.btn/.icon-button/.chip/.tag` 的交互手感
- 文档：`docs/STYLE_GUIDE.md` 补齐 EVO-VIS v4 微交互 token/约定说明
- 版本号 bump 至 `20260113-2`（全站 `?v=` 与 `data.js.version` 同步）

## [20260113-1] - 2026-01-13

### 变更
- 视觉系统：EVO-VIS v4 “Pixel UI” 末尾覆盖（中性色收敛、阴影/边界层级更精准）
- 微交互：新增 `initMicroInteractions`（Spotlight hover 追光 + Click Ripple），并接入全站启动流程（尊重 Reduced Motion/Transparency）
- 文档：重制双语 `README.md`，同步“视觉与动效”与版本/缓存穿透约定
- 版本号 bump 至 `20260113-1`（全站 `?v=` 与 `data.js.version` 同步）

## [20260112-3] - 2026-01-12

### 新增
- HTML 图片门禁：`tools/check-html.mjs` 强制 `<img>` 显式声明 `loading/decoding`（并要求存在 `alt`）
- Atomic Design 规范：`docs/STYLE_GUIDE.md` 补齐 Atoms/Molecules/Organisms 分层与实践约定

### 变更
- 静态图片默认策略：根目录 HTML 的 `<img>` 统一补齐 `loading="lazy" decoding="async"`；首页 Hero 图提升为 `eager + fetchpriority`
- 工具链：`tools/check-html.mjs` 可测试化（导出 `validateHtml`/`main`）并新增单测 `tests/check-html.test.mjs`
- 版本号 bump 至 `20260112-3`（全站 `?v=` 与 `data.js.version` 同步）

## [20260112-2] - 2026-01-12

### 新增
- 本地日志监控：新增 `logger`（ring buffer），默认持久化 `info/warn/error` 到 `gkb-diagnostics-logs`
- 诊断闭环扩展：诊断面板新增“最近日志”区块，诊断包导出包含 logs
- 运行时质量门禁：新增 `tools/check-runtime.mjs` 校验关键能力（诊断/日志/面板入口）未被误删

### 变更
- 工具链：`npm run check:all` 与 CI 纳入 runtime 门禁；新增单测 `tests/check-runtime.test.mjs`
- Command Palette：新增“清空日志”入口（仅当有日志时出现）
- 版本号 bump 至 `20260112-2`（全站 `?v=` 与 `data.js.version` 同步）

## [20260112-1] - 2026-01-12

### 新增
- 运行时错误边界：捕获 `error/unhandledrejection/securitypolicyviolation` 并写入本地诊断日志（`gkb-diagnostics-errors`）
- 系统诊断面板：指挥舱新增“系统诊断”卡片 + 弹窗面板，可查看错误/埋点/健康快照并一键导出诊断包
- 健康监控增强：在不改变默认行为的前提下新增 FCP/INP 采样，并支持 `snapshot({ log: false })` 静默模式

### 变更
- Command Palette：新增诊断入口（打开面板/导出诊断包/开关埋点/清空错误）
- 版本号 bump 至 `20260112-1`（全站 `?v=` 与 `data.js.version` 同步）

## [20260111-1] - 2026-01-11

### 新增
- 指挥舱 DNA 画像与动量节奏，聚合本地收藏/进度/路线信号
- 探索页意图标签与加权推荐机制，支持一键生成路线
- Planner 冲刺计划（专注时长拆分、智能排序、计划复制）
- 社区热度雷达与话题画像标签
- 更新中心影响力评分与等级提示
- 游戏/攻略详情页新增节奏提示卡

### 变更
- UI 升级为 Quantum Glass + Bento 视觉层，并补齐相关组件样式
- 版本号 bump 至 `20260111-1`（全站 `?v=` 与 `data.js.version` 同步）
- 主题色与 PWA 元信息统一为 #f5f7fb / #0b0f16
- 性能优化：图片 lazy-loading + 关键卡片 `content-visibility`

## [20260101-1] - 2026-01-01

### 新增
- 运维脚本：新增 `tools/project-genesis.ps1`，用于一键 clone / bump 版本 / 跑校验 / 提交（可选 push）

### 变更
- UI：毛玻璃系统新增降级策略（`prefers-reduced-transparency` 与不支持 `backdrop-filter` 的环境）
- README：新增项目 Title ASCII 艺术字、快捷入口链接、Highlights（Emoji 特性清单），并同步示例版本号
- 版本号：bump 至 `20260101-1`（全站 `?v=` 与 `data.js.version` 同步）

## [20251231-2] - 2025-12-31

### 新增
- 贡献指南：新增 `docs/CONTRIBUTING.md` 与根目录 `CONTRIBUTING.md`（站内/站外双入口）
- Docs Portal：新增 `CONTRIBUTING` 文档导航（支持 `docs.html?doc=CONTRIBUTING` 直达）
- 离线预缓存：`sw.js` 预缓存新增 `docs/CONTRIBUTING.md`（随版本号更新）

### 变更
- README：补齐贡献者入口，并同步示例版本号与 docs 直达链接
- 版本号：bump 至 `20251231-2`（全站 `?v=` 与 `data.js.version` 同步）

## [20251231-1] - 2025-12-31

### 新增
- UI Evolution v3：在 `styles.css` 末尾新增 Aurora Glass SSOT 区块，统一渐变边框与组件视觉参数

### 变更
- 视觉一致性：`--grad-* / --border-grad` 与品牌色对齐，减少历史补丁导致的风格漂移
- 组件手感：按钮 / Icon Button 的阴影阶梯与 hover/press 反馈统一，并对高对比度模式做降级（禁用流光与强光晕）
- Banner：升级为主题自适配的玻璃面板（避免深浅主题下的对比度失真）
- 版本号：bump 至 `20251231-1`（全站 `?v=` 与 `data.js.version` 同步）

## [20251225-2] - 2025-12-25

### 新增
- EVO-VIS v2：新增黄金比例（phi）排版/间距 tokens（`--phi/--text-*/--space-*`），并补齐 12 级阴影阶梯（`--elev-1..12`）
- 容器视觉统一：主要卡片/面板升级为高级毛玻璃（`backdrop-filter`）+ 内高光 + 动态渐变边框（mask ring；尊重 `prefers-reduced-motion`）
- Skeleton Screen：新增 `.skeleton*` / `.is-skeleton-card`，并在攻略库首帧注入骨架屏（降低空白感）
- SVG Path Loading：文档加载 UI 升级为“墨迹描边”SVG loader + skeleton stack（更贴合国风动效）
- 本地埋点：新增 `telemetry` 模块（仅本地存储、可关闭），并暴露 `GKB.runtime.telemetry`

### 变更
- 游戏库筛选：补齐“我的游戏库”筛选逻辑（`wishlist/playing/done/none`），并支持 URL 同步 `?library=...`
- 游戏库筛选体验：筛选项实时展示可用数量并自动禁用 0 结果选项（多级筛选可用性更明确）
- 搜索预取：在攻略库/游戏库检测到明确意图时，预取前 N 个详情页（复用 `netClient.prefetch`，弱网/省流/离线自动降级）
- 版本号：bump 至 `20251225-2`（同步更新全站 `?v=` 与 `data.js.version`）

## [20251225-1] - 2025-12-25

### 新增
- 一键自检脚本：新增 `tools/check-all.mjs` 与 `npm run check:all`，本地可跑完 CI 同款校验链路（语法/单测覆盖/构建/断链/SW/Feed/数据模型）
- 工具链单测补齐：新增 `tests/site-lib.test.mjs`，覆盖 `tools/lib/site.mjs` 关键分支，维持覆盖率阈值

### 变更
- 对比度策略升级：高对比度模式在无用户显式设置时可跟随系统 `prefers-contrast: more` / `forced-colors: active`（首帧由 `boot.js` 注入，`scripts.js` 二次对齐）
- 工具链去重：`tools/validate-data.mjs` 复用 `tools/lib/site.mjs` 的 `loadDataFromDataJs/readText`，降低重复实现与维护成本
- 可选构建依赖收敛：Vite 压缩切换为内置 `esbuild`（移除 `terser` devDependency）
- 版本号：bump 至 `20251225-1`（同步更新全站 `?v=` 与 `data.js.version`）

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
