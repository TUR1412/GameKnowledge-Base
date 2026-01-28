# 内容工作流（content/ → data.js）

本项目采用“内容源 + 生成产物”的模式：

- `content/`：**人类编辑入口**（适合多人协作、审核、减少 merge 冲突）
- `data.js`：**运行时 SSOT**（浏览器直接加载的数据源，禁止手改）

---

## 1) 目录结构

```text
content/
  meta.json              # 版本号与站点信息（生成 data.js 的元信息）
  taxonomy.json          # 标签/分类治理（canonical + aliases，阻止“脏标签/脏分类”）
  games/*.json           # 游戏条目（文件名 = id）
  guides/*.json          # 攻略条目（文件名 = id）
  topics/*.json          # 社区话题条目（文件名 = id）
```

---

## 2) 新增 / 修改内容的标准流程

在提交前，推荐按以下顺序操作：

1. 修改内容源（`content/`）
2. 重新生成 `data.js`
3. 跑全量门禁（CI 同款）

对应命令：

```bash
npm run build:data
npm run check:all
```

---

## 3) ID 命名规则（文件名 = id）

建议统一使用 **kebab-case**：

- ✅ `elden-ring.json`
- ✅ `dark-souls3.json`
- ✅ `starlight-miracle.json`

注意：

- `guides/*.json` 中的 `gameId`（如有）必须指向 `games/<id>.json` 的 id
- `icon` 必须是 `images/` 下的相对路径（例如 `images/icons/elden-ring.svg`）

---

## 4) 字段约束（以工具门禁为准）

字段约束的“唯一真实来源”是工具门禁（`tools/validate-data.mjs`）。

常见硬性要求（摘要）：

- games
  - 必填：`title/genre/year/rating/updated/platforms/summary/icon/modes/highlights`
  - `updated` 必须是 `YYYY-MM-DD`
  - `platforms/modes/highlights` 必须是非空数组
  - `icon` 必须以 `images/` 开头，且文件真实存在
  - `hasDeepGuide=true` 时必须提供 `deepGuideHref`，且文件真实存在
- guides
  - 必填：`title/summary/updated/difficulty/readingTime`
  - `readingTime` 必须是数字（分钟）
  - `updated` 必须是 `YYYY-MM-DD`
  - `gameId`（如提供）必须存在于 `games`
- topics
  - 必填：`title/starter/summary/category/replies/updated`
  - `replies` 必须是数字
  - `updated` 必须是 `YYYY-MM-DD`
  - `category` 必须在 `content/taxonomy.json.topicCategories` 中登记（允许通过 aliases 兼容旧写法）
  - `tags`（如提供）必须在 `content/taxonomy.json.tags` 中登记（允许通过 aliases 兼容旧写法）

---

## 5) 常见问题

### Q1：我改了 content/，CI 说 content/ 与 data.js 不一致

原因：你忘记重新生成 `data.js`。

解决：

```bash
npm run build:data
```

然后重新执行：

```bash
npm run check:all
```

### Q2：为什么不允许直接改 data.js

因为 `data.js` 是生成产物，手改会导致：

- 下次生成时被覆盖（改动丢失）
- 与 `content/` 源产生偏差，CI 门禁会失败

---

## 6) 迁移辅助（从旧 data.js 导出）

如果你需要把历史数据再导出一遍（例如误删 content/ 或需要重建），可以执行：

```bash
npm run export:content
```
