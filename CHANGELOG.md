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

