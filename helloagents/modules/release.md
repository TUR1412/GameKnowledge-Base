# 发布流程与门禁（Release Contract）

> 目标：把“发布”变成一条可重复执行、可机器验证、不会产生幽灵缓存的稳定交付链路。

## 发布前必做（强制）

在仓库根目录执行：

1) bump 版本号（缓存穿透契约）

```bash
node tools/bump-version.mjs
```

2) 运行全链路门禁（CI 同款）

```bash
npm run check:all
```

若 `check:all` 未通过：禁止发布。先修复门禁问题再继续。

## 发布到 GitHub Pages

本仓库默认使用 GitHub Actions Pages 工作流：

- 工作流：`.github/workflows/pages.yml`
- 部署说明：`docs/DEPLOYMENT.md`

发布动作：

- 推送到默认分支（`master` 或 `main`）触发自动部署

## 为什么必须先 bump 再 check

核心原因是“版本一致性”：

- HTML 中的 `?v=` 需要与 `data.js` 的 `data.version` 对齐
- Service Worker 的预缓存依赖 `sw.js?v=...` 的版本来切换 `CACHE_NAME`

把 bump 放到最前面，才能保证后续门禁（断链/SW/manifest/预算）校验的是“即将发布”的版本形态。

## 门禁清单（机器可验证）

这些门禁都包含在 `npm run check:all` 里：

- `tools/check-links.mjs`：断链/外链资源禁止/缓存穿透版本一致性
- `tools/check-html.mjs`：HTML 结构与 CLS 约束
- `tools/check-manifest.mjs`：Web App Manifest 合规
- `tools/check-a11y.mjs`：A11y/SEO 基础门禁 + CSP 兼容（禁 inline script/style/on* handler）
- `tools/check-sitemap.mjs`：sitemap/robots 覆盖与 base 一致性
- `tools/check-sw.mjs`：SW 预缓存覆盖、版本化、外链禁止、资源存在性、预缓存体积预算
- `tools/check-core-assets.mjs`：部署路径核心资源 gzip 预算
- `tools/check-bundlesize.mjs`：Vite dist gzip 预算（极限压缩构建）
- `tools/generate-feed.mjs --check`：feed 一致性
- `tools/validate-data.mjs`：data.js 数据模型校验
- `node --test ...coverage`：单测与覆盖率阈值

## 常见失败与处理建议

- “更新了代码但线上没变”：先确认是否执行了 `node tools/bump-version.mjs`，并检查 `?v=` 与 `data.js.version` 是否对齐
- “离线异常/页面错配”：优先检查 `tools/check-sw.mjs` 是否通过；必要时在浏览器 DevTools 中 Unregister SW 并硬刷新

