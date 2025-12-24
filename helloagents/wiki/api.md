# API 手册（浏览器侧）

本项目无服务端 API；“API”主要指：

1. **URL 入口与 Query 参数约定**
2. **Service Worker 消息协议**
3. **本地状态的 Key 约定（localStorage）**

---

## 1) URL 入口（动态渲染页）

### 游戏详情页

- 路径：`game.html`
- Query：
  - `id`：游戏 ID（对应 `data.js -> data.games[id]`）

示例：`game.html?id=elden-ring`

### 攻略详情页

- 路径：`guide-detail.html`
- Query：
  - `id`：攻略 ID（对应 `data.js -> data.guides[id]`）

示例：`guide-detail.html?id=civ6-science`

### 话题讨论页

- 路径：`forum-topic.html`
- Query：
  - `id`：话题 ID（对应 `data.js -> data.topics[id]`）

示例：`forum-topic.html?id=upcoming-games`

---

## 2) URL 参数（可分享筛选结果）

### 游戏库页（all-games.html）

- `q` / `query`：搜索关键字
- `genre`：类型（逗号分隔，可多值）
- `platform`：平台（逗号分隔，可多值）
- `year`：年份（逗号分隔，可多值；含 `older` 等规则）
- `rating`：评分规则（逗号分隔，可多值）
- `saved=1`：只看收藏
- `sort`：排序方式
- `view`：视图（如 `list`）
- `reset=1`：重置状态（优先级最高）

### 攻略库页（all-guides.html）

- `q` / `query`：搜索关键字
- `tag` / `tags`：标签（逗号分隔，可多值）
- `saved=1` / `savedOnly=true`：只看收藏
- `sort`：排序方式
- `reset=1`：重置状态

---

## 3) Service Worker 消息协议

### 预缓存（离线包）

页面 → SW：

```json
{
  "type": "GKB_PRECACHE",
  "requestId": 1,
  "urls": ["images/icons/x.svg", "game.html?id=..."]
}
```

SW → 页面：

- `GKB_PRECACHE_PROGRESS`：进度回执（节流上报）
- `GKB_PRECACHE_DONE`：完成回执（含 ok/fail 计数）

---

## 4) localStorage Key（摘要）

Key 前缀统一为 `gkb-`，用于隔离站点数据与便于备份迁移，例如：

- `gkb-theme`：主题
- `gkb-contrast`：高对比度模式
- `gkb-saved-games` / `gkb-saved-guides` / `gkb-saved-topics`：收藏集合
- `gkb-update-radar`：NEW / UPDATED 雷达基线与已读状态
- `gkb-plans`：路线规划数据
