# 预算与门禁（Performance Budgets）

> 目的：把“性能与交付质量”从口号变成**可量化、可回归、可在 CI 中强制执行**的预算门禁。

## 一键执行入口

```bash
npm run check:all
```

该命令会执行所有预算门禁（以及断链/HTML/manifest/a11y/sitemap/SW/feed/data 等完整性门禁）。

---

## 1) 构建产物预算（Vite dist）

由 `tools/check-bundlesize.mjs` 强制：

| 指标 | 默认预算 | 环境变量覆盖 |
|---|---:|---|
| `dist/gkb.min.css` gzip | ≤ 30.00kB | `GKB_BUDGET_CSS_GZIP_KB` |
| `dist/gkb.min.js` gzip | ≤ 80.00kB | `GKB_BUDGET_JS_GZIP_KB` |

说明：

- 该预算用于确保“极限压缩构建”长期可控（即使当前部署仍走无构建路径）。
- 单位采用十进制 kB（1000 bytes），与 Vite 输出一致。

---

## 2) 核心资产预算（部署路径：根目录资源）

由 `tools/check-core-assets.mjs` 强制（主要覆盖当前 GitHub Pages 部署实际加载的核心文件）：

| 指标 | 默认预算 | 环境变量覆盖 |
|---|---:|---|
| `scripts.js` gzip | ≤ 120.00kB | `GKB_BUDGET_SCRIPTS_GZIP_KB` |
| `styles.css` gzip | ≤ 60.00kB | `GKB_BUDGET_STYLES_GZIP_KB` |
| `boot.js` gzip | ≤ 10.00kB | `GKB_BUDGET_BOOT_GZIP_KB` |
| `sw.js` gzip | ≤ 10.00kB | `GKB_BUDGET_SW_GZIP_KB` |
| `manifest.webmanifest` gzip | ≤ 5.00kB | `GKB_BUDGET_MANIFEST_GZIP_KB` |

为什么要有这条预算：

- 当前 Pages 部署不包含 `dist/`，所以“实际线上用户”加载的是根目录的 `scripts.js/styles.css`。
- 只靠 dist 预算会出现“CI 通过但线上变重”的错觉，因此必须额外预算真实部署路径的核心资产。

---

## 3) 离线壳预算（Service Worker 预缓存）

由 `tools/check-sw.mjs` 强制：

| 指标 | 默认预算 | 环境变量覆盖 |
|---|---:|---|
| `PRECACHE_URLS` 预缓存总大小（raw 合计） | ≤ 1200.00kB | `GKB_BUDGET_SW_PRECACHE_KB` |

补充约束（同样由 `tools/check-sw.mjs` 强制）：

- 必须覆盖所有根目录 HTML 入口页（离线可打开任意入口）
- JS/CSS/manifest 必须使用 `?v=${VERSION}` 版本化预缓存（避免幽灵缓存）
- 禁止预缓存外链资源
- 预缓存引用的资源必须真实存在

---

## 4) 体验级指标（当前阶段：目标值，后续补自动化）

这些是“用户真实体感”的目标值，目前先作为路线图目标（后续会补浏览器级自动化采样与门禁）：

```yaml
交互流畅度:
  LongTask: 主流程尽量为 0（或可解释且可定位）
  动效: 默认 60FPS 友好（transform/opacity 优先）
关键页面目标:
  首页/列表：交互可用优先，避免首屏重计算阻塞
  详情页：导航与内容渲染稳定（离线/缓存一致性不出错）
```

