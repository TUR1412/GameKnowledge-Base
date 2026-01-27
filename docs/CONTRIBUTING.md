# 贡献指南（Contributing）

欢迎你参与维护与扩展 **GameKnowledge-Base**。

本项目的核心哲学是：**纯静态、无框架、数据驱动、Local-first、可离线、可长期维护**。  
因此，贡献不仅是“把内容加进来”，更要保证：**可用性、稳定交付、缓存穿透、离线一致性**。

---

## 1) 你可以贡献什么？

### A. 内容贡献（最常见）
- 新增游戏条目（`content/games/*.json`）
- 新增/完善攻略（`content/guides/*.json`）
- 新增/完善社区话题（`content/topics/*.json`）
- 修复错别字、补齐字段、优化标签体系

> 重要：当前仓库已启用 `content/ → data.js` 的内容工作流。`data.js` 是运行时产物（浏览器直接加载），**禁止手改**；内容修改请在 `content/` 中进行。

### B. 体验贡献（欢迎但更需要自检）
- UI/UX 微交互与视觉一致性优化（`styles.css` / `scripts.js`）
- 离线缓存策略优化（`sw.js`）
- 工具链增强（`tools/*.mjs` + `tests/*.mjs`）

---

## 2) 本地开发：推荐流程

```bash
# 1) 安装依赖
npm ci

# 2) 若改了内容源（content/），先生成运行时 data.js
npm run build:data

# 3) 跑 CI 同款全量自检（强烈推荐）
npm run check:all

# 4) 启动本地预览（任选其一）
npm run dev:vite
# 或
npm run preview:vite
```

> 提示：直接双击 `index.html` 也能看内容，但部分浏览器在 `file://` 下会限制 `localStorage` / Service Worker，无法验证完整体验。

---

## 3) 缓存穿透（必须遵守）

本项目采用 “**资源版本号**” 机制避免幽灵缓存：所有 HTML 页面引用的关键静态资源必须带 `?v=YYYYMMDD-N`。

当你修改以下任意文件时，**必须 bump 版本号**：
- `styles.css`
- `boot.js`
- `scripts.js`
- `data.js`
- `manifest.webmanifest`
- `sw.js`
- 以及任何会被 Service Worker 预缓存的关键入口/资源

推荐使用自动脚本（会同步更新全站 HTML 与 `data.js.version`）：

```bash
node tools/bump-version.mjs
```

> 补充：当仓库存在 `content/meta.json` 时，`bump-version` 会以其为版本号 SSOT，并在 bump 后自动执行 `build-data` 重新生成 `data.js`（避免漏生成）。

---

## 4) 数据贡献：最小规则（务必通过校验）

### 4.1 不要破坏数据模型
- 修改数据时，务必对照 `docs/DATA_MODEL.md`（数据模型说明）与 `docs/CONTENT_WORKFLOW.md`（内容工作流）
- 字段含义、默认值、可选字段要保持一致
- 新增字段时：优先“可选字段 + 有默认行为”，避免要求全量数据回填

### 4.2 标签体系要克制
- 标签是“导航与过滤”的基础能力
- 尽量复用已有标签；新增标签要考虑命名一致性与聚合价值

### 4.3 运行本地数据校验（强烈建议）

```bash
# 如果你改了 content/，先生成 data.js
npm run build:data

# 校验数据模型 + content 与 data.js 一致性
npm run validate:data
```

---

## 5) UI/UX 贡献：设计系统优先（SSOT）

视觉系统以 `styles.css` 的 token 为唯一真实来源（SSOT）。

推荐做法：
- 想“换风格/换品牌色” → **优先改 token**，不要到处改组件 `rgba(...)`
- 高对比度（`data-contrast="high"`）→ **可读性优先**：关闭动态边框流动与强烈毛玻璃
- Reduced Motion → 动效必须可降级（CSS + JS 双通道都要尊重系统偏好）

---

## 6) 提交与 PR 约定

### Commit Message（建议）
- `feat: ...` 新功能
- `fix: ...` 修复
- `docs: ...` 文档
- `refactor: ...` 重构（不改变行为）
- `perf: ...` 性能

### 自检清单（提交前）
- [ ] `npm run check:all` 通过
- [ ] 如涉及静态资源/离线：已运行 `node tools/bump-version.mjs`
- [ ] 不引入外链资源（字体/CDN/第三方脚本），避免离线与稳定交付被破坏

---

## 7) 常见问题（FAQ）

### Q: 为什么不引入框架/不引入外链？
A: 这是“稳定交付 + 离线一致性”的核心约束：减少构建复杂度、减少运行时依赖、减少不可控外部变量，才能让纯静态站点也具备产品级体验。

### Q: 我只改了 README，需要 bump 版本吗？
A: 一般不需要。但如果你改动了 `styles.css/scripts.js/data.js/sw.js` 或根目录 HTML 页面，必须 bump。
