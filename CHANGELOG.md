# Changelog

本项目以“静态站点稳定交付”为目标：每次大改都会同步更新资源版本号（`?v=`），并通过 CI 做断链/资源/语法校验。

## 2026-01-13 (20260113-5)

### Changed
- Pixel UI v4.2：搜索/筛选/调节控件纳入 Pixel UI 体系（Search box / Filter options / Input & Select pills）
- Planner：专注时长滑杆升级为“可视化填充轨道”（JS 仅写入 `--range-pct`，保持 UI/逻辑分离）
- 微交互覆盖：Micro-interactions 扩展到 `search-btn`（ripple/press/magnetic），并保持 Reduced Motion/Disabled 控件降级安全
- 版本号 bump 至 `20260113-5`（同步更新全站 `?v=` 与 `data.js.version`）

## 2026-01-13 (20260113-4)

### Changed
- Pixel UI v4.1：修复标题字距漂移（letter-spacing），确保排版观感一致
- 视觉一致性：Banner / Card surface 全面改为 token 驱动，避免暗色主题出现硬编码“白底卡片”
- 微交互覆盖：Micro-interactions 扩展到 `save-pill / filter-chip / view-btn / cmdk-item`，并对禁用控件自动跳过反馈（更符合直觉）
- 版本号 bump 至 `20260113-4`（同步更新全站 `?v=` 与 `data.js.version`）

## 2026-01-13 (20260113-3)

### Changed
- 动效一致性：FX Transform System 在 hover/active/pressed 状态也显式输出 transform，避免旧样式覆盖导致 Magnetic/Press 等效果失效
- 版本号 bump 至 `20260113-3`（同步更新全站 `?v=` 与 `data.js.version`）

## 2026-01-13 (20260113-2)

### Changed
- 微交互：新增 Magnetic 磁吸跟随（spring + rAF）与 Press 按压态（`.is-pressed`），并以 CSS variables（`--fx-tx/--fx-ty`）保持 UI/逻辑分离
- 动效一致性：按钮/Chip/Icon Button 统一走 FX Transform System（hover/press/magnetic 合成 transform）
- 版本号 bump 至 `20260113-2`（同步更新全站 `?v=` 与 `data.js.version`）

## 2026-01-13 (20260113-1)

### Changed
- UI：EVO-VIS v4 “Pixel UI” 视觉重塑（更克制的中性色系统 + 更精准的阴影/边界层级）
- 微交互：卡片 hover 追光（Spotlight）+ 点击 Ripple（尊重 Reduced Motion/Transparency，60FPS 优先）
- 版本号 bump 至 `20260113-1`（同步更新全站 `?v=` 与 `data.js.version`）

## 2026-01-11 (20260111-1)

### Added
- 指挥舱 DNA 画像与动量节奏（基于本地收藏/进度/路线信号）
- 探索意图标签与加权推荐，引导一键生成路线
- Planner 冲刺计划（专注时长拆分、智能排序、计划复制）
- 社区热度雷达与话题画像提示
- 更新中心影响力评分与等级提示
- 游戏/攻略详情页节奏提示卡

### Changed
- UI 升级为 Quantum Glass + Bento 视觉层
- 版本号 bump 至 `20260111-1`（同步更新全站 `?v=` 与 `data.js.version`）
- 主题色与 PWA 元信息统一为 #f5f7fb / #0b0f16
- 性能优化：图片 lazy-loading + 关键卡片 `content-visibility`

## 2026-01-01 (20260101-1)

### Added
- 运维脚本：新增 `tools/project-genesis.ps1`，用于一键 clone / bump 版本 / 跑校验 / 提交（可选 push）

### Changed
- UI：毛玻璃系统新增降级策略（`prefers-reduced-transparency` 与不支持 `backdrop-filter` 的环境）
- README：新增项目 Title ASCII 艺术字、快捷入口链接、Highlights（Emoji 特性清单），并同步示例版本号
- 版本号：bump 至 `20260101-1`（同步更新全站 `?v=` 与 `data.js.version`）

## 2025-12-31 (20251231-2)

### Added
- 贡献指南：新增 `docs/CONTRIBUTING.md` 与根目录 `CONTRIBUTING.md`（站内/站外双入口）
- Docs Portal：新增 `?doc=CONTRIBUTING` 直达入口
- 离线增强：SW 预缓存覆盖贡献指南（离线可读）

### Changed
- README：补齐贡献者入口，并同步示例版本号与 docs 直达链接
- 版本号：bump 至 `20251231-2`（同步更新全站 `?v=` 与 `data.js.version`）

## 2025-12-31 (20251231-1)

### Added
- Aurora Glass v3：新增 UI Evolution SSOT（在 `styles.css` 末尾收敛关键视觉 tokens）

### Changed
- 视觉一致性：渐变边框与光晕 token 与品牌色对齐（消除历史补丁导致的风格漂移）
- 微交互手感：按钮 / Icon Button 统一阴影阶梯与 hover/press 反馈（更“跟手”、更克制）
- Banner 组件：升级为玻璃面板并主题自适配（避免深色/浅色主题下的对比度失真）
- 可访问性：高对比度模式关闭 hover 边框流动（减少干扰）
- 版本号：bump 至 `20251231-1`（同步更新全站 `?v=` 与 `data.js.version`）

## 2025-12-25 (20251225-2)

### Added
- EVO-VIS v2：12 列栅格 tokens + 12 级阴影阶梯（用于卡片/浮层/面板层级统一）
- Skeleton Screen：攻略库首帧骨架屏；文档加载改为 SVG Path“墨迹描边”加载动效
- 本地埋点：新增 `telemetry`（仅 localStorage、可关闭），辅助后续交互与性能优化

### Changed
- 游戏库筛选：补齐“我的游戏库”筛选逻辑，并支持 URL 同步 `?library=...`
- 游戏库筛选体验：筛选项显示可用数量并自动禁用 0 结果选项（减少“点了没反应”的挫败）
- 搜索预取：攻略库/游戏库在明确意图时预取前 N 个详情页（弱网/省流/离线自动降级）
- 版本号：bump 至 `20251225-2`（同步更新全站 `?v=` 与 `data.js.version`）

## 2025-12-25

### Added
- 一键自检：新增 `tools/check-all.mjs` 与 `npm run check:all`，本地可快速跑完 CI 同款校验链路
- 工具链单测：新增 `tests/site-lib.test.mjs`，覆盖 `tools/lib/site.mjs` 的关键逻辑与分支

### Changed
- 无障碍：高对比度模式支持跟随系统 `prefers-contrast: more` / `forced-colors: active`（用户未显式设置时）
- 工具链去重：`tools/validate-data.mjs` 复用 `tools/lib/site.mjs` 的数据加载与文本读写逻辑
- 可选构建：Vite 压缩切换为内置 `esbuild`（减少依赖）
- 版本号：bump 至 `20251225-1`（同步更新全站 `?v=` 与 `data.js.version`）

### Removed
- `terser` devDependency（改用 Vite 内置压缩）

## 2025-12-21

### Added
- 社区话题库：搜索/标签筛选/排序
- 话题收藏：话题页与话题库支持收藏/取消收藏
- 攻略排序：按更新时间/阅读时长/难度切换
- 游戏玩法重点与标签卡：展示核心机制与关键词
- 数据模型扩展：`modes` / `tags` / `highlights` / `replies`
- 游戏对比（Compare）：游戏库多选对比 + 对比栏 + 对比弹窗（最多 4 项）
- 更新雷达（NEW / UPDATED）：为条目建立已读基线，新增/更新自动标记
- 高对比度模式：提升文本与边界可读性（强光环境更清晰）
- 离线包一键缓存：缓存常用图标/封面/深度页资源，离线体验更完整

### Changed
- 话题页信息密度提升：更新日期 + 标签展示
- Service Worker：离线回退支持忽略 search（动态渲染页断网可直接打开模板页）
- 安全性：收紧 CSP（移除 `style-src 'unsafe-inline'`，补齐 `form-action 'self'`）

## 2025-12-24

### Added
- Atom 更新订阅：新增 `feed.xml`（Atom），并在更新中心提供订阅入口
- OpenSearch：新增 `opensearch.xml`，支持浏览器地址栏直搜并跳转到游戏库结果页
- CI 加固：新增 Feed 一致性校验（`node tools/generate-feed.mjs --check`）
- 可选构建：新增 Vite 极限压缩配置（`vite.config.mjs`）与构建入口（`src/bundle.mjs`）
- 工具链共享：新增 `tools/lib/site.mjs` 统一复用站点 base/url/xml/data 逻辑
- 交互式文档入口：新增 `docs.html`，站内渲染 `docs/*.md`（维护/贡献更顺手）
- 高延迟体验增强：新增运行时网络状态闭环（netStore/netClient）与内部链接 hover/focus 预取
- 长列表虚拟化：为攻略库 / 话题库引入零依赖虚拟列表渲染（超大数据量只渲染可视区）
- 工程自诊断：新增控制台 `GKB.health()` 与 `GKB.runtime.health.start()` 实时监控采样

### Changed
- 动效层内建：将 WAAPI 动效轻量层内联到 `scripts.js`，减少额外请求与维护点
- 启动调度：按 `data-page` 精确执行页面 init，减少无效调用
- Service Worker：导航请求短窗口等待网络，超时回退缓存并后台刷新；资源请求改为 SWR（缓存优先 + 后台更新）
- 工具脚本去重：站点相关工具复用 `tools/lib/site.mjs`，降低重复实现与维护成本
- URL 参数解析去重：抽象 `readSearch*` helper，多个页面共享同一套解析逻辑
- UI 细节：修复 Header 水平对齐（移除重复 padding），横幅纹理层改为零资源 CSS pattern（消除构建 unresolved）
- 动效手感：补齐 Motion tokens（时长 + Bezier）并收敛关键组件 transition（按钮/弹窗/卡片）
- 文本与图标：标题支持截断 + 渐变遮罩（mask 支持时），SVG 在 flex 布局下对齐更稳定

### Removed
- `vendor/motion.js` 及其在 HTML / SW / 工具链 / 单测中的引用

## 2025-12-22

### Added
- 更新中心页面（Updates）：聚合 NEW / UPDATED，支持一键标为已读
- 路线规划页面（Planner）：路线管理、拖拽排序、分享链接导入/导出、进度汇总
- 探索页面（Discover）：本地个性化推荐（基于收藏/最近访问/在玩状态）+ 一键生成路线
- PWA Shortcuts：从桌面/系统菜单直达指挥舱/路线/更新/探索
- README 动态演示图：新增 3 张可播放的 SVG Demo
- 社区话题共享元素转场：话题卡片 → 讨论页 Banner 形变级转场（更连贯）
- 离线包缓存进度回执：缓存过程中 Toast 实时显示 done/total（失败项提示）

### Changed
- Command Palette：开合动效升级（Motion），并加入新模块入口
- Toast：进出场动效升级（Motion）
- Service Worker：预缓存补齐新入口页与动效库（`vendor/motion.js`）
- 首页：新增“探索推荐”入口按钮
- 跨页转场：支持跨文档 View Transition（卡片→详情 Banner 形变），不支持浏览器继续使用淡出降级
- 微交互一致性：Planner 列表增删/拖拽反馈、Compare 弹窗/对比栏动效、收藏星标弹性反馈（统一 Motion 参数）
- View Transition：新增 root 级“导演剪辑”过渡（轻量淡入淡出 + blur/scale），`prefers-reduced-motion` 自动关闭
- 性能压榨：Command Palette 选中态改为差分更新；社区话题筛选预计算 search blob + 减少 localStorage 读取
- 工具链：单测覆盖外链资源检测与解析空输入分支，维持覆盖率阈值通过
- 动效库瘦身：`vendor/motion.js` 替换为 WAAPI 轻量实现（体积约 82KB → 7KB），保留 `Motion.animate/stagger` 兼容接口
- 工具链加固：CI 检查强制要求 `vendor/motion.js` 版本一致（防止忘记 bump 导致幽灵缓存）

## 2025-12-20

### Added
- 主页“最近访问”模块：自动回到最近浏览的游戏/攻略
- 攻略进度清单：可勾选步骤并显示完成度
- 攻略阅读进度条：顶部可视化阅读进度
- 攻略专注阅读模式：一键隐藏侧栏、提升行距
- 攻略阅读时长估算：根据正文计算阅读时间
- 攻略阅读设置：字号/行距可调并记忆
- 攻略小节链接复制：标题一键复制定位链接
- 攻略继续阅读：自动记录当前小节并一键返回
- 游戏/攻略个人笔记：自动保存到本地
- 攻略章节导航 Chips：顶部快速跳转章节
- 游戏库筛选 Chips：快速移除筛选条件
- 游戏收藏：游戏详情页支持收藏/取消收藏
- 游戏库收藏筛选：只看收藏的游戏
- 游戏评分可视条：详情页直观显示评分强度
- 筛选链接记忆：游戏库/攻略库筛选自动同步 URL
- 话题回复计数：讨论页实时显示回复数量
- 话题回复排序：最新/最早切换
- 数据模型扩展：`updated` / `difficulty` / `playtime` / `steps`
- 新增游戏与攻略条目：博德之门3、十字军之王3、地平线 西之绝境

### Changed
- 视觉体系升级：暖色品牌色 + 双重极光背景 + 更强玻璃质感
- 目录与卡片层级优化，交互按钮统一为新调色板
- “最新更新”排序逻辑补齐（使用 `data-updated`）
- 目录高亮跟随阅读进度（自动定位当前章节）
- Command Palette 新增阅读快捷操作（专注/字号/行距）
- 攻略快捷键：R 切换专注、+/- 调整字号、L 切换行距

## 2025-12-19

### Added
- 首页 Hero 重构：数据统计 + 视觉预览面板
- Bento 功能矩阵区块（核心能力集中呈现）
- Aurora/Noise 背景叠层与玻璃质感增强
- 全站输入控件的辅助标签（`sr-only`）与可访问性补强

### Changed
- 移动端导航按钮图标统一（菜单开/关）
- 首页与 RPG 文案更新至 2025 语境

## 2025-12-18

### Added
- PWA 离线能力：`sw.js` + `manifest.webmanifest` + `offline.html`
- Command Palette 本地数据工具：导出/导入/清空（收藏/筛选/回复等）

### Changed
- 主题启动逻辑抽离为 `boot.js`（减少重复内联脚本）
- 导航可访问性：移动端菜单 `aria-label` 与当前页 `aria-current="page"` 自动维护
- CI：新增 `boot.js` / `sw.js` / `tools/check-links.mjs` 语法检查与版本一致性校验

## 2025-12-17

### Added
- 全站搜索（Command Palette）：`Ctrl + K` / `/`
- 本地收藏体系：收藏/取消收藏、攻略库“只看收藏”
- 最近访问：游戏/攻略详情页自动记录
- GitHub Actions CI：`node --check` + 断链/资源/缓存穿透检查
- 友好 404 页面：`404.html`
- 本地占位图资源：替换外链 `via.placeholder.com`

### Changed
- 动效与可访问性：`prefers-reduced-motion` 下自动降级；JS 失效时滚动 reveal 组件默认可见
- 工程化：新增 `.editorconfig` / `.gitattributes` 统一编码与换行
