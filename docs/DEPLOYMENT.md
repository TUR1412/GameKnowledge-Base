# 部署到 GitHub Pages

本仓库是纯静态站点（HTML/CSS/JS），非常适合直接部署到 GitHub Pages。

## 1) 推荐：GitHub Actions 自动部署（稳定交付）

本仓库已内置 Pages 工作流：`.github/workflows/pages.yml`（会打包站点产物并部署）。

开启步骤：

1. 打开仓库 `Settings`
2. 找到 `Pages`
3. `Build and deployment` → `Source` 选择 **`GitHub Actions`**
4. 保存后，推送到 `master`（或 `main`）会自动触发部署

排障建议（当你感觉“似乎没有再部署”时）：

- 打开 `Actions` → 查看 `Deploy to GitHub Pages` 工作流是否执行、是否失败
- 确认 `Settings -> Pages` 已开启且 Source 为 `GitHub Actions`
- 如修改了核心静态资源，务必 bump 版本号（见下文“缓存刷新”）

## 2) 兜底：Deploy from a branch（无需 Actions）

如果你不希望使用 Actions，也可以直接从分支部署（纯静态站点同样可用）：

1. 打开仓库 `Settings`
2. 找到 `Pages`
3. `Build and deployment` → `Source` 选择 `Deploy from a branch`
4. `Branch` 选择 `master`（或你的默认分支） + `/ (root)`
5. 保存后等待几分钟，GitHub 会给你一个 Pages 地址

## 3) 404 兜底

已提供 `404.html`。当用户访问不存在页面时，GitHub Pages 会自动显示它。

## 4) 缓存刷新（非常重要）

本项目对核心静态资源使用 `?v=` 版本号做缓存穿透：

- `styles.css?v=...`
- `data.js?v=...`
- `scripts.js?v=...`

如果你修改了 `styles.css` / `scripts.js` / `data.js` 或页面结构，务必同步更新所有 HTML 中的版本号（见 `docs/STYLE_GUIDE.md`）。

### 一键 bump 版本号（推荐）

为了避免逐页手改漏改，本仓库提供了自动升级脚本（会同步更新 `data.js.version` 与根目录 HTML 中的资源版本号）：

```bash
node tools/bump-version.mjs
```

### 一键发布（推荐：包含生成/校验）

如果你希望把“生成 + bump + 校验 + sitemap/feed”一口气跑完，推荐：

```bash
npm run release
```

## 5) 离线缓存（PWA）

本项目默认启用 PWA 能力：

- `manifest.webmanifest`：站点元信息
- `sw.js`：Service Worker（离线缓存 + 秒开体验）
- `offline.html`：离线兜底页

说明：

- Service Worker 只在 **HTTPS**（例如 GitHub Pages）或 `localhost` 下可用；在 `file://` 直接打开时属于增强项失败，不影响基本浏览。
- 首次访问需要联网完成缓存；之后断网仍可打开已缓存页面与资源。

## 6) 自定义域名（可选）

如果你有自定义域名，可以在 `Pages` 中配置，并在仓库根目录添加 `CNAME` 文件（内容为你的域名）。

## 7) SEO（Sitemap / Robots）

仓库根目录已提供：

- `sitemap.xml`
- `robots.txt`

如果你使用 **自定义域名** 或者仓库名发生变化，建议重新生成（确保 `Sitemap:` 与 `<loc>` 的域名正确）：

```bash
node tools/generate-sitemap.mjs --base https://your-domain.example/
```
