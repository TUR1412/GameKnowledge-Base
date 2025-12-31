# 技术设计: 贡献指南 + Docs Portal 扩展（离线可读）

## 技术方案

### 核心技术
- **Markdown 文档**：新增 `docs/CONTRIBUTING.md`（站内渲染 + GitHub 直接阅读）
- **Docs Portal 扩展**：在 `scripts.js` 的 `DOCS` 列表中新增 `CONTRIBUTING`
- **离线预缓存**：在 `sw.js` 的 `PRECACHE_URLS` 中加入 `docs/CONTRIBUTING.md?v=${VERSION}`
- **缓存穿透**：使用 `tools/bump-version.mjs` bump `?v=` 与 `data.js.version`

### 实现要点
- 站内文档入口通过 `?doc=` 参数路由：新增文档需要同时更新 `DOCS` 列表与 SW 预缓存列表。
- 版本号 bump 后需同步更新 README 中的示例版本号，避免“文档指导与代码事实不一致”。

## 安全与性能
- **安全:** 不引入外链资源，不放宽 CSP；贡献指南仅为 Markdown，不引入可执行内容。
- **性能:** 增量预缓存仅新增一个 Markdown 文件，影响极小；版本穿透保证离线更新一致。

## 测试与部署
- `npm run check:all`（CI 同款全量自检）
- `node tools/bump-version.mjs`（版本穿透）
