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
  - 图片性能门禁：要求 `<img>` 显式声明 `loading/decoding`（降低 CLS 与首屏资源竞争）
  - CLS 细化：对 `images/placeholders/*` 的 `<img>` 强制要求 `width/height`（进一步降低布局抖动）

- `tools/check-manifest.mjs`
  - PWA Manifest 质量门禁：校验 `manifest.webmanifest` 必备字段、图标/快捷入口资源存在性、禁止外链

- `tools/check-a11y.mjs`
  - A11y/SEO 基础门禁：要求 `<html>` 具有 `lang`、必须有 `<title>` 与 meta description
  - CSP 兼容门禁：禁止 inline style（`<style>`/`style=""`）与 on* 事件属性（例如 `onclick=""`）

- `tools/check-bundlesize.mjs`
  - 可选构建（Vite）产物体积预算门禁：校验 `dist/gkb.min.{css,js}` gzip 体积
  - 默认预算：CSS ≤ 30kB、JS ≤ 80kB（可用 env 覆盖：`GKB_BUDGET_CSS_GZIP_KB` / `GKB_BUDGET_JS_GZIP_KB`）

- `tools/check-sw.mjs`
  - Service Worker 预缓存策略校验
  - 强制 VERSION 机制存在，避免缓存幽灵

- `tools/check-sitemap.mjs`
  - robots/sitemap 完整性 + URL 覆盖（静态页 + 数据驱动页）

- `tools/check-runtime.mjs`
  - 运行时关键能力门禁（诊断/日志/面板入口存在性）
  - 目标：防止关键模块被误删/改名（例如 `initErrorBoundary` / `openDiagnosticsDialog` / `gkb-diagnostics-logs`）

- `tools/validate-data.mjs`
  - `data.js` 数据模型校验与常见错误提示

- `tools/bump-version.mjs`
  - 自动 bump `?v=` 与 `data.version`，避免手工同步失误

- `tools/generate-sitemap.mjs`
  - 基于 `data.js` 生成 `sitemap.xml` 与 `robots.txt`

- `tools/generate-feed.mjs`
  - 基于 `data.js` 生成 Atom 订阅 `feed.xml`
  - 支持 `--check`：CI 校验 `feed.xml` 是否最新

- `tools/lib/site.mjs`
  - 工具链共享库：`normalizeBase/buildUrl/escapeXml/loadDataFromDataJs/listRootHtml` 等
  - 目标：减少重复实现，降低“修一处漏一处”的风险

- `tools/check-all.mjs`
  - 本地一键跑完 CI 同款校验（语法/单测覆盖/构建/断链/SW/Feed/数据模型）
  - 对应 npm 脚本：`npm run check:all`

---

## 1.1 可选构建（Vite）

- `vite.config.mjs`
  - 极限压缩构建配置（esbuild minify + treeshake），用于生成可选的压缩产物
- `src/bundle.mjs`
  - Vite 入口：打包并压缩 `styles.css` 与 `scripts.js`
- 命令：
  - `npm ci`
  - `npm run build:vite`（输出 `dist/gkb.min.js` + `dist/gkb.min.css`）

---

## 2) 测试（tests/*.test.mjs）

采用 Node Test Runner（`node --test`），对关键工具脚本做单测与覆盖率约束：

- 覆盖率阈值由 `package.json` 与 CI 统一控制
- 重点覆盖：断链/版本一致性/HTML 结构与图片门禁/SW 预缓存解析/数据模型校验/运行时门禁等高风险分支   

---

## 3) 变更历史

- [202601120351_image-performance-gate](../../history/2026-01/202601120351_image-performance-gate/) - 图片性能门禁（img loading/decoding）+ Atomic Design 规范补齐
- [202601120642_placeholder-img-dimensions-gate](../../history/2026-01/202601120642_placeholder-img-dimensions-gate/) - CLS：占位图尺寸门禁（width/height）+ 页面补齐
- [202601120701_manifest-quality-gate](../../history/2026-01/202601120701_manifest-quality-gate/) - PWA Manifest 质量门禁（结构/资源/外链）
- [202601120525_bundle-size-budget-gate](../../history/2026-01/202601120525_bundle-size-budget-gate/) - 可选构建产物体积预算门禁（dist gzip）
- [202601120558_a11y-seo-gate](../../history/2026-01/202601120558_a11y-seo-gate/) - A11y/SEO 基础门禁 + CSP 兼容检查
- [202601120607_nav-aria-current](../../history/2026-01/202601120607_nav-aria-current/) - 主导航 aria-current 规范化（.active 对齐）
