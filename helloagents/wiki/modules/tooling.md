# tooling 模块

本模块描述“稳定交付工具链”：通过脚本与 CI 把常见问题在 PR 阶段扼杀。

---

## 1) 工具脚本（tools/*.mjs）

- `tools/check-links.mjs`
  - 断链检查（仅校验站内 `.html` 链接）
  - 图片资源存在性校验（`images/`）
  - 缓存穿透版本一致性（核心资源 `?v=` 必须存在且全站一致）
  - 禁止外链“可执行/可渲染资源”（脚本/样式/图片/media）

- `tools/check-html.mjs`
  - HTML 结构约束（例如必需 meta、关键节点等）

- `tools/check-sw.mjs`
  - Service Worker 预缓存策略校验
  - 强制 VERSION 机制存在，避免缓存幽灵

- `tools/check-sitemap.mjs`
  - robots/sitemap 完整性 + URL 覆盖（静态页 + 数据驱动页）

- `tools/validate-data.mjs`
  - `data.js` 数据模型校验与常见错误提示

- `tools/bump-version.mjs`
  - 自动 bump `?v=` 与 `data.version`，避免手工同步失误

- `tools/generate-sitemap.mjs`
  - 基于 `data.js` 生成 `sitemap.xml` 与 `robots.txt`

- `tools/generate-feed.mjs`
  - 基于 `data.js` 生成 Atom 订阅 `feed.xml`
  - 支持 `--check`：CI 校验 `feed.xml` 是否最新

---

## 2) 测试（tests/*.test.mjs）

采用 Node Test Runner（`node --test`），对关键工具脚本做单测与覆盖率约束：

- 覆盖率阈值由 `package.json` 与 CI 统一控制
- 重点覆盖：断链/版本一致性/SW 预缓存解析/数据模型校验等高风险分支
