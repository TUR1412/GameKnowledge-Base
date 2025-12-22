# Changelog

本项目以“静态站点稳定交付”为目标：每次大改都会同步更新资源版本号（`?v=`），并通过 CI 做断链/资源/语法校验。

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
