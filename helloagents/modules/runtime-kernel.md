# 运行时内核（Runtime Kernel）v1

> 目标：把 `scripts.js` 从“巨石脚本”升级为可持续演进的运行时内核：可拆分、可测试、可按页面裁剪初始化，同时不牺牲“纯静态 + 无框架 + 严格 CSP + 离线一致性”。

## 1) 现状事实（以代码为准）

- 运行时入口仍是根目录 `scripts.js`（classic script，IIFE），由各页面 `<script src="scripts.js?v=...">` 引入。
- `scripts.js` 内部已经按能力分段（注释分隔），可稳定映射为模块边界：
  - Telemetry / Update Radar / NetStore+NetClient / VirtualList / FX / Toast / ErrorBoundary / Diagnostics / Settings / CmdK / SW / Pages（Home/AllGames/Guides/Game/Planner/Discover/Community/Forum/Docs/Boot）等。
- 运行时已对外暴露 `window.GKB.runtime` 的只读句柄，作为调试与“未来模块化迁移”的稳定 API 面（见 `scripts.js` 中的暴露块）。

## 2) v1 策略（唯一主线）

我采用“先抽离可测试 core，再逐步迁移页面/feature”的策略，原因是：

- `scripts.js` 里大量逻辑其实是可纯函数化的（storage/json/telemetry），先抽离可以立刻提升可测性与复用性。
- 保持页面行为不变是第一优先级：模块化必须在 CI 门禁下推进，任何回归都要被 gate 拦截。
- 交付路径不改变：短期不引入额外运行时外链与脚本数量，不破坏缓存穿透与 SW 预缓存契约。

## 3) 当前已落地（v1 起步）

### 3.1 已新增的 core 模块（可在 Node 环境直接单测）

- `src/runtime/core/dom.mjs`
  - `qs(selector, root=document)`：安全 `querySelector`（失败返回 `null`）
  - `qsa(selector, root=document)`：安全 `querySelectorAll`（失败返回空数组）
- `src/runtime/core/events.mjs`
  - `on(target, type, handler, options)`：注册事件并返回 `unsubscribe()`（失败为 no-op）
  - `once(target, type, handler, options)`：一次性事件（基于 `on`，强制 `{ once: true }`）
- `src/runtime/core/storage.mjs`
  - `createStorage(backend)`：对 `localStorage` 风格后端做 try/catch 包装
  - `safeJsonParse(value, fallback)`：JSON 解析兜底
  - `readStringList(storage, key)` / `writeStringList(storage, key, list)`：列表读写（trim + 去重）
  - `STORAGE_KEYS`：统一的 key 清单（用于后续迁移期对齐）
- `src/runtime/core/telemetry.mjs`
  - `createTelemetry({ storage, storageKeys, getPage, now, maxEvents })`：本地埋点闭环（无外发）
  - `sanitizeTelemetryMeta(meta, { maxStr, maxKey })`：meta 过滤与截断（隐私/体积约束）
- `src/runtime/core/motion.mjs`
  - `UI_PREFS`：对齐现网偏好键（motion/transparency/particles）
  - `getUiPref(name, deps)` / `setUiPref(name, value, deps)`：读取/写入偏好（localStorage + dataset）
  - `systemPrefersReducedMotion()` / `isMotionReduced()`：尊重系统 Reduced Motion 与用户偏好
- `src/runtime/core/net.mjs`
  - `createStore(initialState)`：极简 store（`getState/setState/subscribe`）
  - `createRequestClient({ store, fetch, baseHref, origin, ... })`：同源请求客户端（timeout/retry/内存热缓存/预取）
  - `normalizeSameOriginUrl(url, { baseHref, origin })`：同源 URL 归一化（非同源/协议相对直接拦截）
- `src/runtime/core/logger.mjs`
  - `createLogger({ storage, storageKeys, getPage, now, console, ... })`：本地日志（console 输出 + 持久化）
  - `logger.read()/clear()/getSummary()`：用于 Diagnostics/导出
- `src/runtime/core/diagnostics.mjs`
  - `createDiagnostics({ storage, storageKeys, getPage, getData, getUrl, getUserAgent, telemetry, logger, healthMonitor, ... })`
  - `diagnostics.captureError()`：错误采集（本地持久化 + 可选 telemetry 记录）
  - `diagnostics.buildBundle()`：构建可导出的诊断包（errors/logs/telemetry/health）

### 3.2 运行时兼容层（保持现网行为不变）

`scripts.js` 继续作为运行时入口，但已额外暴露以下只读句柄，作为后续“内部实现替换”的稳定 API：

- `GKB.runtime.storage`
- `GKB.runtime.storageKeys`
- `GKB.runtime.safeJsonParse`
- `GKB.runtime.readStringList`
- `GKB.runtime.writeStringList`
- `GKB.runtime.runIdleTask`
- `GKB.runtime.netStore`
- `GKB.runtime.net`
- `GKB.runtime.health`
- `GKB.runtime.telemetry`
- `GKB.runtime.diagnostics`
- `GKB.runtime.logger`

> 这一步的意义：未来把内部实现替换为模块化版本时，对外 API 不需要变动，减少迁移风险。

## 4) 验证方式（必须可复现）

在仓库根目录执行：

```bash
npm run check:all
```

包含：

- Node Test Runner + 覆盖率阈值（lines>=95, functions>=95, branches>=90）
- Vite build + dist 体积预算
- 站点完整性门禁（断链/HTML/manifest/a11y/sitemap/SW/feed/data）

## 5) 下一步迁移顺序（建议）

1. 建立 `src/runtime/pages/*` 的 page init 映射（按 `data-page` 精确初始化），逐步把“各页面 init”从 `scripts.js` 的长链分支迁出
2. 将 `scripts.js` 内部的 `netStore/netClient/logger/diagnostics` 逐步切换为调用 `src/runtime/core/*`（保持 classic script 入口不变）
3. 抽离 `virtual-list` 与 `fx`（性能敏感模块，适合独立预算与回归）
4. 建立“feature 注册表”：把可选能力（CmdK/Toast/FX/Update Radar 等）收敛成统一的 `register/init` 机制，支持按页面裁剪
