# 技术设计: 运行时可观测性与诊断面板

## 技术方案

### 核心技术

- **浏览器原生能力**：
  - `window.addEventListener("error")`
  - `window.addEventListener("unhandledrejection")`
  - `document.addEventListener("securitypolicyviolation")`
  - `PerformanceObserver`（扩展 FCP/INP 等）
- **Local-first 存储**：`localStorage` ring buffer（受限大小、写入失败可降级）
- **现有组件复用**：Toast / Command Palette / Bento 卡片 / Glass Token

### 实现要点

1. **Diagnostics Store（ring buffer）**
   - 新增 `gkb-diagnostics-errors` 等 key
   - 结构化记录：`{ ts, page, kind, message, stack?, meta? }`
   - 严格截断与白名单（防止爆量与潜在隐私泄露）

2. **全局错误边界**
   - 捕获以下事件并记录：
     - `error`（含资源加载错误与脚本异常）
     - `unhandledrejection`
     - `securitypolicyviolation`（CSP 违规在排障时非常关键）
   - 用户提示策略：
     - 使用现有 Toast 组件提示“已记录到本地，可导出诊断包”
     - 节流：避免连续异常刷屏

3. **诊断面板（Diagnostics Panel）**
   - 入口：
     - Command Palette 快捷操作：打开诊断面板 / 导出诊断包 / 清空错误 / 开关埋点
     - Dashboard 增加“系统诊断”卡片：摘要 + 一键打开
   - 内容：
     - 概览：版本、页面、在线状态、CLS/LCP/FCP/INP（静默快照）
     - 最近错误：按时间倒序展示摘要
     - 最近埋点：读取 `telemetry.read()` 最近 N 条并展示

4. **Health Monitor 扩展**
   - 采集新增指标（浏览器支持则启用，不支持自动降级）：
     - `paint` → `first-contentful-paint`
     - `event` → INP 近似值（取 max 或 p98 近似，保持实现简洁）
   - `snapshot()` 扩展为 `snapshot({ log = true } = {})`，默认保持原行为（继续输出控制台表格），允许 UI 侧静默读取。

## 安全与性能

- **安全**
  - 不引入外链监控 SDK（保持离线可用与稳定交付）
  - 不记录用户输入全文、localStorage 全量内容、URL query 全量等潜在敏感字段
  - 导出包为用户主动操作（显式点击/快捷操作触发）

- **性能**
  - 监听器数量最小化；写 localStorage 失败不抛错
  - 错误 toast 节流，避免渲染抖动
  - 面板仅在打开时渲染明细列表

## 测试与部署

- **自测**
  - `npm ci`
  - `npm test` / `npm run test:coverage`
  - `npm run check:all`
  - `npm run build:vite`
- **版本与缓存**
  - 修改 `scripts.js` / `styles.css` / `dashboard.html` 后执行 `node tools/bump-version.mjs`，同步更新 `data.js` 的 version 与所有 HTML 的 `?v=`。

