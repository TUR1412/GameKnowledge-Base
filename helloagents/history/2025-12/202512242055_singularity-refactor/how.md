# 方案包：singularity-refactor（how）

## 技术方案概述

本次改造以“减少冗余 + 强化可验证性”为主线，保持纯静态架构不变：

1. **动效层内建**
   - 将 `vendor/motion.js` 的 WAAPI 轻量实现内联到 `scripts.js`（MotionLite）
   - 保持 `Motion.animate/stagger` 语义一致（仅内部使用，不再依赖额外脚本）

2. **启动调度优化**
   - `DOMContentLoaded` 阶段改为按 `body[data-page]` 精确调度页面 init
   - 全局关键交互仍优先初始化（主题/导航/Command Palette/PWA/Toast）

3. **新增 OpenSearch + Atom Feed**
   - `opensearch.xml`：浏览器地址栏直搜（跳转 `all-games.html?q={searchTerms}`）
   - `tools/generate-feed.mjs`：从 `data.js` 生成 `feed.xml`（Atom）
   - 在 `updates.html` 增加订阅入口，并在 CI 增加 `--check` 校验

4. **离线策略补齐**
   - `sw.js` 预缓存加入 `opensearch.xml` 与 `feed.xml`
   - 仍保持核心资源 `?v=` 版本机制与缓存隔离

## 风险与规避

- **缓存幽灵风险**
  - 规避：继续使用 `sw.js?v=VERSION` + `CACHE_NAME` 绑定版本；核心资源保持 `?v=` 同步

- **工具链约束变化**
  - 规避：同步更新 `tools/check-links.mjs` / `tools/check-sw.mjs` 与单测，确保 CI 可验证

- **Feed 绝对链接基址**
  - 规避：从 `robots.txt` 的 `Sitemap:` 推导 base（可移植到自定义域名）
