# 数据模型（data.js）

站点的核心内容集中在 `data.js`，页面通过 `id` 参数从数据表渲染内容：

- `game.html?id=xxx` 读取 `data.games[xxx]`
- `guide-detail.html?id=yyy` 读取 `data.guides[yyy]`
- `forum-topic.html?id=zzz` 读取 `data.topics[zzz]`

> 设计目标：减少静态页面数量、降低断链风险、统一视觉与交互。

---

## 1) version

```js
version: "20251218-8"
```

用于标识数据版本（便于排查缓存/更新问题）。推荐与 HTML 引用的 `?v=` 保持一致。

---

## 2) games

```js
games: {
  "elden-ring": {
    title: "艾尔登法环",
    subtitle: "高自由度开放世界魂系动作RPG",
    genre: "动作角色 | 开放世界",
    rating: 9.7,
    year: 2022,
    platforms: ["PC", "PS5", "PS4"],
    icon: "images/icons/elden-ring.svg",
    summary: "……",
    // 可选：如果某游戏有专属深度静态攻略页
    hasDeepGuide: true,
    deepGuideHref: "starlight-miracle.html"
  }
}
```

### 字段建议

- `title`：展示标题（必填）
- `subtitle`：副标题（可选）
- `genre`：用于展示与搜索（建议填写）
- `rating`：数字评分（可选）
- `year`：年份（可选）
- `platforms`：数组（可选）
- `icon`：SVG 图标路径（建议本地路径）
- `summary`：简介（可选）
- `hasDeepGuide + deepGuideHref`：如果你保留某些“专属大攻略页”，可以引导到它

---

## 3) guides

```js
guides: {
  "civ6-science": {
    title: "文明6：科技胜利的终极战略",
    summary: "……",
    icon: "images/icons/strategy-icon.svg",
    tags: ["科技树", "城市规划", "节奏"],
    // 可选：用于在 game.html 中做“相关攻略”聚合
    gameId: "civilization6"
  }
}
```

### 字段建议

- `title`：标题（必填）
- `summary`：摘要（建议）
- `icon`：图标（建议本地）
- `tags`：标签数组（用于攻略库筛选）
- `gameId`：关联某个游戏（可选，但推荐）

---

## 4) topics

```js
topics: {
  "upcoming-games": {
    title: "2025 年最值得期待的游戏（你投哪一票？）",
    starter: "游戏预言家",
    summary: "……"
  }
}
```

话题页会把用户回复写入 `localStorage`，用于本地记录与复盘（不依赖后端）。
