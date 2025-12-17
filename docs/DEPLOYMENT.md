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

## 4) 自定义域名（可选）

如果你有自定义域名，可以在 `Pages` 中配置，并在仓库根目录添加 `CNAME` 文件（内容为你的域名）。

