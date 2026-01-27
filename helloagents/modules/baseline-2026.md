# 基线快照（2026）

> 目的：把“现状”固化为可重复获取的客观指标，后续所有升级都以此为对比基线（避免主观感受驱动）。

## 元信息

```yaml
时间: 2026-01-27
仓库: TUR1412/GameKnowledge-Base
基线 commit: 87dca5bbd4c9df8defb77424536234d9ae93c8cf
数据版本（SSOT）: 20260115-2
环境: Windows (PowerShell)
Node: v22.14.0
npm: 10.9.2
```

## 一键复现（CI 同款）

在仓库根目录执行：

```bash
npm ci
npm run check:all
```

> 说明：`npm run check:all` 会执行语法检查、单测与覆盖率阈值、Vite 构建、体积预算门禁，以及站点完整性校验（断链/HTML/manifest/a11y/sitemap/sw/feed/data）。

## 关键指标（本次测量结果）

### 内容规模

```yaml
games: 10
guides: 18
topics: 15
合计条目: 43
```

### 站点入口（根目录 HTML）

```yaml
HTML 入口页数: 20
```

### 构建产物（Vite dist）与预算

> 来自 `npm run check:all` 的 Vite build 输出与 `tools/check-bundlesize.mjs` 门禁。

```yaml
dist/gkb.min.css:
  raw: 160.53kB
  gzip: 27.89kB
  budget_gzip: 30.00kB
dist/gkb.min.js:
  raw: 227.10kB
  gzip: 70.39kB
  budget_gzip: 80.00kB
```

### 运行时关键资产（仓库根目录）体积

> 说明：这些是“非构建路径”下浏览器直接加载的核心文件体积（可用于评估“零构建预览”的成本）。

```yaml
boot.js:
  raw: 4.24kB
  gzip: 1.82kB
scripts.js:
  raw: 403.62kB
  gzip: 95.81kB
styles.css:
  raw: 232.01kB
  gzip: 41.20kB
data.js:
  raw: 20.72kB
  gzip: 6.65kB
sw.js:
  raw: 7.87kB
  gzip: 2.73kB
manifest.webmanifest:
  raw: 1.77kB
  gzip: 0.62kB
```

### 离线预缓存（Service Worker）

> 来自 `tools/check-sw.mjs` 的门禁统计 + 额外汇总（按文件真实大小合计）。

```yaml
html_coverage: 20
precache_items_total: 37
precache_total_size: 978.00kB
missing_files: 0
```

结论（基线事实）

- 预缓存已覆盖所有入口页（离线可打开任意入口）
- 预缓存的核心资源全部带 `?v=${VERSION}`（版本一致性机制健全）
- 预缓存资源总体量约 1MB，当前可接受，但未来内容规模增长时需要“分层离线包”以避免无限膨胀

### SEO / 可发现性

```yaml
sitemap:
  base: https://tur1412.github.io/GameKnowledge-Base/
  urls_total: 61
  static: 18
  games: 10
  guides: 18
  topics: 15
feed:
  entries: 43
opensearch: enabled
```

### PWA Manifest

```yaml
icons: 2
shortcuts: 4
```

### 质量门禁状态（当前基线）

```yaml
check:all: PASS
unit_tests: PASS (Node Test Runner)
coverage_threshold: PASS (lines>=95, functions>=95, branches>=90)
```

## 基线结论（升级抓手）

从“Owner”的角度，我在基线上看到的最关键矛盾是：

1) **内容规模增长 vs. 单文件数据源**  
现在条目总量 43 很轻松，但一旦上百/上千，`data.js` 作为“协作写作源”会变成冲突与维护地狱。升级必须先把“内容源格式”从 `data.js` 解耦出来（保留运行时 SSOT，但让它成为生成产物）。

2) **运行时能力增长 vs. `scripts.js` 巨石化风险**  
当前 `scripts.js`（raw 403.62kB）承担了太多职责：功能继续扩张会提高回归成本与维护成本。需要把运行时升级为模块化内核（core/pages/features）。

3) **离线预缓存增长 vs. 缓存体积不可控**  
预缓存约 978kB 是健康的起点，但如果未来加入大量图片/深度攻略/更多入口页，这个体积会线性增长。需要尽早引入“分层离线包”（核心壳层必备，内容包按需下载）。

4) **质量门禁已很强，但缺少“Owner 视角”的发布/性能预算维度**  
当前门禁聚焦结构正确性与体积预算（dist），下一阶段要补齐：更贴近用户体验的预算与发布流程自动化（避免人肉流程成为幽灵缓存源头）。

