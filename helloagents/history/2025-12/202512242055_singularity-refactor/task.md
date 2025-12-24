# 方案包：singularity-refactor（task）

> **类型:** 重构 + 功能增强  
> **范围:** runtime / tooling / docs  
> **状态:** ✅已完成

## 任务清单

- [√] 移除 `vendor/motion.js`，将 Motion WAAPI 轻量层内联到 `scripts.js`
- [√] 全站 HTML 移除对动效脚本的引用，并保持核心资源 `?v=` 约束不变
- [√] `sw.js` 预缓存移除动效脚本并补齐新静态文件（feed/opensearch）
- [√] 更新 `tools/check-links.mjs` / `tools/check-sw.mjs` / `tools/bump-version.mjs` 适配资源变化
- [√] 更新单测：移除对动效脚本的版本一致性假设，保持覆盖率阈值
- [√] 启动调度优化：按 `data-page` 精确执行页面 init
- [√] 新增 OpenSearch：`opensearch.xml` + 全站 `<link rel="search"...>`
- [√] 新增 Atom Feed：`tools/generate-feed.mjs` + `feed.xml` + CI `--check`
- [√] 更新 README 与 HelloAGENTS 知识库（SSOT）
- [√] 推送远程仓库（已推送至分支 `singularity-refactor-20251224`）
- [√] 清理本地克隆目录（推送成功后执行）
