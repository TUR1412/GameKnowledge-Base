# 部署到 GitHub Pages

本仓库是纯静态站点（HTML/CSS/JS），非常适合直接部署到 GitHub Pages。

## 1) 开启 Pages

1. 打开仓库 `Settings`
2. 找到 `Pages`
3. `Build and deployment` → `Source` 选择 `Deploy from a branch`
4. `Branch` 选择 `master`（或你的默认分支） + `/ (root)`
5. 保存后等待几分钟，GitHub 会给你一个 Pages 地址

## 2) 404 兜底

已提供 `404.html`。当用户访问不存在页面时，GitHub Pages 会自动显示它。

## 3) 缓存刷新（非常重要）

本项目对核心静态资源使用 `?v=` 版本号做缓存穿透：

- `styles.css?v=...`
- `data.js?v=...`
- `scripts.js?v=...`

如果你修改了 `styles.css` / `scripts.js` / `data.js` 或页面结构，务必同步更新所有 HTML 中的版本号（见 `docs/STYLE_GUIDE.md`）。

## 4) 离线缓存（PWA）

本项目默认启用 PWA 能力：

- `manifest.webmanifest`：站点元信息
- `sw.js`：Service Worker（离线缓存 + 秒开体验）
- `offline.html`：离线兜底页

说明：

- Service Worker 只在 **HTTPS**（例如 GitHub Pages）或 `localhost` 下可用；在 `file://` 直接打开时属于增强项失败，不影响基本浏览。
- 首次访问需要联网完成缓存；之后断网仍可打开已缓存页面与资源。

## 5) 自定义域名（可选）

如果你有自定义域名，可以在 `Pages` 中配置，并在仓库根目录添加 `CNAME` 文件（内容为你的域名）。

## 6) SEO（Sitemap / Robots）

仓库根目录已提供：

- `sitemap.xml`
- `robots.txt`

如果你使用 **自定义域名** 或者仓库名发生变化，建议重新生成（确保 `Sitemap:` 与 `<loc>` 的域名正确）：

```bash
node tools/generate-sitemap.mjs --base https://your-domain.example/
```
