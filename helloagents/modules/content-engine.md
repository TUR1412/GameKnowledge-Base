# 内容引擎（Content Engine）v1

> 目标：把“内容协作”和“运行时数据”解耦。人类编辑 `content/`，机器生成 `data.js`；并用可验证门禁确保一致性、可维护性和可持续扩展。

## 1) SSOT 与职责划分（代码事实）

- `content/`：协作源（人类编辑入口）
  - `content/meta.json`：版本号与站点信息（SSOT）
  - `content/taxonomy.json`：标签/分类治理（canonical + aliases）
  - `content/{games,guides,topics}/*.json`：条目源文件（文件名 = id）
- `data.js`：运行时 SSOT（浏览器加载的唯一数据源，禁止手改）

> 原则：`data.js` 是“运行时唯一真实来源”，但它是生成产物；当文档与代码不一致时，以工具门禁与生成器行为为准。

## 2) 工具链入口（必须可复现）

在仓库根目录执行：

```bash
npm run build:data
npm run validate:data
```

对应脚本：

- `tools/build-data.mjs`
  - 从 `content/` 生成 `data.js`
  - 生成输出稳定排序（重复执行无 diff）
  - 在生成阶段对 `tags/category` 做规范化（依据 `content/taxonomy.json`）
- `tools/validate-data.mjs`
  - 校验 `data.js` 数据模型
  - 当存在 `content/meta.json` 时，强制校验 `content/` 与 `data.js` 一致性
  - 强制执行 taxonomy：阻止“脏标签/脏分类”进入主线
- `tools/export-content.mjs`
  - 从现有 `data.js` 导出 `content/`（迁移/恢复辅助）
  - 若 `content/taxonomy.json` 不存在，会基于当前数据生成一个最小 taxonomy（仅 canonical，aliases 需后续补齐）

## 3) taxonomy 规则（Owner 视角：治理而非放任）

### 3.1 为什么必须有 taxonomy

标签与分类的最大风险是“越写越脏”：

- 同义词、大小写、带空格等导致筛选与搜索分裂（例如 `Build`/`构筑`）
- 新贡献者无法判断“应该用哪个写法”
- 统计/推荐/过滤规则越来越难维护

因此引入 `content/taxonomy.json`：

- `tags`：canonical → aliases[]
- `topicCategories`：canonical → aliases[]

### 3.2 治理策略

- 允许 aliases：兼容历史写法与惯用写法
- 运行时统一 canonical：UI 展示、搜索与筛选使用同一个口径
- 新增标签/分类：必须先登记到 taxonomy（否则 CI 阻断）

## 4) CI 门禁（持续可交付）

内容链路相关门禁都在 `npm run check:all` 中：

- `tools/validate-data.mjs`：模型 + `content/` ↔ `data.js` 一致性 + taxonomy
- `tools/check-links.mjs`：版本一致性（HTML ?v= ↔ data.version）与资源存在性
- `tools/check-sitemap.mjs` / `tools/generate-feed.mjs --check`：SEO 产物一致性

## 5) 日常工作流（推荐）

1) 修改 `content/`（必要时同时改 `content/taxonomy.json`）
2) 生成数据：`npm run build:data`
3) 全链路门禁：`npm run check:all`
4) 发布：推荐 `npm run release`（自动生成/注入 SEO/bump/generate feed+sitemap/校验）

