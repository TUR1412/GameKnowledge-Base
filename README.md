# 游戏攻略网 · GameKnowledge-Base

<p align="center">
  <strong>纯静态 · 无框架 · 离线可用 · 数据驱动</strong><br>
  游戏知识库与攻略站点，一次构建，轻松部署到 GitHub Pages。
</p>

<p align="center">
  <a href="https://github.com/TUR1412/GameKnowledge-Base/actions/workflows/ci.yml">
    <img src="https://github.com/TUR1412/GameKnowledge-Base/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <img src="https://img.shields.io/badge/PWA-Offline%20Ready-5d3fd3" alt="PWA">
  <img src="https://img.shields.io/badge/Static-No%20Framework-00c2ff" alt="Static">
</p>

<p align="center">
  <img src="images/placeholders/screenshot-ui.svg" alt="界面预览" width="840">
</p>

---

## 核心定位

- 纯静态交付：HTML/CSS/JS 即开即用，无需后端
- 结构化知识库：`data.js` 数据驱动，统一渲染入口
- 离线增强：Service Worker + PWA Manifest
- 可访问性与稳健性：JS 失效仍可浏览，动效可降级

---

## 功能矩阵

- **Command Palette 全站搜索**：Ctrl + K / “/” 直达，搜游戏/攻略/话题
- **收藏体系**：攻略收藏本地持久化，支持“只看收藏”
- **本地备份/迁移**：导出/导入/清空 localStorage 数据
- **主题切换**：深浅主题自动记忆
- **数据驱动页面**：`game.html?id=...` / `guide-detail.html?id=...` / `forum-topic.html?id=...`
- **PWA 离线**：断网仍能访问已缓存页面
- **CI 自动审查**：语法/断链/缓存穿透检查

---

## 快速开始

### 1) 本地直接打开

双击打开 `index.html` 即可预览。若浏览器对 `file://` 的 `localStorage` 有限制，可使用任意静态服务器打开。

### 2) GitHub Pages 部署

详见：`docs/DEPLOYMENT.md`

---

## 数据扩展（从这里开始）

核心数据集中在 `data.js`：

```js
version: "20251219-1",

games: {
  "elden-ring": { title: "艾尔登法环", rating: 9.7, ... }
},

guides: {
  "civ6-science": { title: "文明6：科技胜利的终极战略", ... }
},

topics: {
  "upcoming-games": { title: "2025 年最值得期待的游戏", ... }
}
```

字段规范与示例：`docs/DATA_MODEL.md`

---

## 命令与脚本

```bash
# JS 语法检查
node --check boot.js
node --check scripts.js
node --check data.js
node --check sw.js

# 断链/资源/缓存穿透检查
node tools/check-links.mjs

# 数据模型校验
node tools/validate-data.mjs

# 统一升级资源版本号（推荐）
node tools/bump-version.mjs

# 重新生成 Sitemap（如启用自定义域名）
node tools/generate-sitemap.mjs --base https://your-domain.example/
```

---

## 项目结构

```text
.
├─ boot.js                   # 启动脚本（早期主题/No-JS 处理）
├─ index.html                # 首页
├─ all-games.html            # 游戏库（筛选/排序/视图）
├─ all-guides.html           # 攻略库（搜索/标签/收藏）
├─ game.html                 # 游戏详情（通过 id 参数渲染）
├─ guide-detail.html         # 攻略详情（通过 id 参数渲染）
├─ forum-topic.html          # 话题页（通过 id 参数渲染 + 本地回复）
├─ 404.html                  # 友好 404
├─ offline.html              # 离线兜底页
├─ data.js                   # 站点数据
├─ scripts.js                # 全站交互脚本
├─ sw.js                     # Service Worker
├─ manifest.webmanifest      # PWA Manifest
├─ styles.css                # 全站样式
├─ images/                   # 图标与占位图
├─ tools/                    # CI/检查/生成脚本
└─ .github/workflows/ci.yml  # CI 工作流
```

---

## 设计与体验规范

- 视觉与交互规范：`docs/STYLE_GUIDE.md`
- 数据模型规范：`docs/DATA_MODEL.md`
- 部署指南：`docs/DEPLOYMENT.md`

---

## 变更记录

详见：`CHANGELOG.md`
