# Changelog

本项目以“静态站点稳定交付”为目标：每次大改都会同步更新资源版本号（`?v=`），并通过 CI 做断链/资源/语法校验。

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

## 2025-12-18

### Added
- PWA 离线能力：`sw.js` + `manifest.webmanifest` + `offline.html`
- Command Palette 本地数据工具：导出/导入/清空（收藏/筛选/回复等）

### Changed
- 主题启动逻辑抽离为 `boot.js`（减少重复内联脚本）
- 导航可访问性：移动端菜单 `aria-label` 与当前页 `aria-current="page"` 自动维护
- CI：新增 `boot.js` / `sw.js` / `tools/check-links.mjs` 语法检查与版本一致性校验

## 2025-12-19

### Added
- 首页 Hero 重构：数据统计 + 视觉预览面板
- Bento 功能矩阵区块（核心能力集中呈现）
- Aurora/Noise 背景叠层与玻璃质感增强
- 全站输入控件的辅助标签（`sr-only`）与可访问性补强

### Changed
- 移动端导航按钮图标统一（☰ / ✕）
- 首页与 RPG 文案更新至 2025 语境
