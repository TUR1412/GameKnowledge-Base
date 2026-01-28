# 离线与更新（Offline & Updates）v1

> 目标：让 PWA 离线能力“可控、可进度、可验证”，同时避免版本错配导致的幽灵缓存问题。

## 1) Service Worker 策略（代码事实）

- 文件：`sw.js`
- 版本：通过 `sw.js?v=...` 的查询参数注入 `VERSION`，并绑定到 `CACHE_NAME = gkb-cache-${VERSION}`
- 预缓存（Precache）：`PRECACHE_URLS` 覆盖所有根目录 HTML + 关键资源（`styles/data/scripts/boot/manifest/search-worker`）与关键 docs
- 运行时策略：
  - 导航（HTML）：网络优先；超时回退缓存；同时后台刷新（避免白屏）
  - 静态资源：缓存优先（SWR：命中缓存立即返回，后台刷新）

## 2) 分层离线包（可选下载）

### 2.1 壳层（自动）

首次安装 SW 时会预缓存“壳层”：入口页 + 核心脚本/样式/数据/文档。

### 2.2 内容包（手动）

通过 Command Palette（Ctrl+K）提供两类“离线包”：

- **媒体离线包**：图标/封面/深度页（提升离线观感与可读性）
- **文档离线包**：`docs/*.md`（让 Docs Portal 离线可读）

缓存过程由 SW message 通道回传进度：

- `GKB_PRECACHE_PROGRESS`：展示成功/失败/总量
- `GKB_PRECACHE_DONE`：完成态（成功或部分成功）

离线包状态写入本地（`gkb-offline-pack:{version}:{kind}`）：

- `status=complete`：全部成功（下次触发会直接提示“已就绪”）
- `status=partial`：存在失败项（允许稍后重试）

## 3) 更新 UX（避免版本错配）

离线缓存最常见的灾难是：“旧页面 + 新缓存 / 旧缓存 + 新页面”错配。

当前策略（`scripts.js`）：

- `registration.updatefound` + `installing.statechange(installed)`：检测到新 SW 安装完成后，提示“新版本已就绪”
  - 首次安装不提示（避免新用户困惑）
- `navigator.serviceWorker.controllerchange`：控制权切换后提示刷新（避免旧页面继续运行）
- Command Palette 提供：
  - “检查离线缓存更新”
  - “立即刷新（应用新版本）”

## 4) 门禁（必须可验证）

相关门禁均在 `npm run check:all`：

- `tools/check-sw.mjs`
  - 强制要求预缓存覆盖所有 HTML
  - 强制要求关键资源带 `?v=${VERSION}`
  - 强制预缓存 `search-worker.js?v=${VERSION}`
  - 预缓存资源存在性 + 总量预算
- `tools/check-links.mjs`
  - HTML 核心资源 `?v=` 版本一致性 + 与 `data.js.version` 对齐
- `tools/check-core-assets.mjs`
  - 部署核心资产 gzip 预算（避免体积失控）

## 5) 操作建议（Owner 视角）

- 任何会影响“首屏资源/入口页/离线体验”的改动，都应该通过 `npm run release` 发布（确保 bump + 校验链路完整）
- 离线包是“增强项”，失败不应阻断在线访问；但必须提供可见进度与可重试路径

