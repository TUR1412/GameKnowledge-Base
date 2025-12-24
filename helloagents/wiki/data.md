# 数据模型

本项目的数据由 `data.js` 提供，并注入到浏览器全局：

- `window.GKB.data`

数据层的目标是：**一次维护数据，多页统一渲染**（game / guide / topic 三类动态页）。

---

## 1) 顶层结构

```js
window.GKB.data = {
  version: "YYYYMMDD-N",
  games: { [gameId]: Game },
  guides: { [guideId]: Guide },
  topics: { [topicId]: Topic }
}
```

- `version`：发布版本（同时用于 `?v=` 缓存穿透的 SSOT）
- `games/guides/topics`：以 `id` 为 key 的字典结构（便于 O(1) 查找与稳定链接）

---

## 2) Game（游戏）

常用字段（字段并非强制全量，缺失时 UI 会友好兜底）：

- `title`：展示标题（必填建议）
- `updated`：更新时间（建议 `YYYY-MM-DD`）
- `genre/platform/year/rating`：用于筛选与展示
- `summary` / `description`：摘要
- `tags`：标签数组（用于筛选/展示）
- `highlights`：玩法重点（用于详情页信息卡）
- `modes`：模式/玩法（如 单人/多人/联机等）

---

## 3) Guide（攻略）

常用字段：

- `title`：攻略标题
- `gameId`：归属游戏 ID（建议填写，便于关联跳转）
- `summary`：摘要
- `updated`：更新时间
- `tags`：标签数组（用于筛选）
- `difficulty`：难度（字符串）
- `readingTime`：阅读时长（分钟，数字）
- `steps`：步骤清单（用于进度勾选）

---

## 4) Topic（话题）

常用字段：

- `title`：话题标题
- `summary`：话题摘要
- `starter`：发起人
- `updated`：更新时间
- `tags`：标签数组
- `category`：分类（单值）
- `replies`：回复数（作为展示基线；本地回复会叠加）

---

## 5) 与其他模块的关系

- `tools/validate-data.mjs`：在 CI 中校验数据形状与常见错误
- `tools/generate-sitemap.mjs`：基于数据生成动态页 URL
- `tools/generate-feed.mjs`：基于数据生成 Atom 订阅（`feed.xml`）
