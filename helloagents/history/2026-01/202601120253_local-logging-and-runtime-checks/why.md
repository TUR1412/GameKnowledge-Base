# 变更提案: 本地日志监控与运行时质量门禁

## 需求背景

本项目是“纯静态 / 无框架 / Local-first / PWA 离线”的多页站点，已具备：

- 本地埋点（`telemetry`，仅存本地，可开关）
- 工程自诊断（`GKB.health()` + `health.start()` 采样）
- 错误边界与诊断面板（本地错误记录 + 一键导出诊断包）

但从行业标准的“可观测性闭环”角度看，仍缺少两类关键能力：

1. **本地日志监控（Structured Logging）**
   - 现状：日志主要散落在 `console.*` 与偶发 `console.error`，缺少统一格式与本地留存（排障难以复盘）。
   - 目标：补齐一个轻量、无依赖、可导出、可清空的本地日志 ring buffer，并与诊断面板/诊断包导出整合。

2. **运行时质量门禁（Runtime Check Gate）**
   - 现状：CI 主要检查工具链与站点完整性，但对“关键体验模块是否被意外删除/改名”缺少约束。
   - 目标：新增 `tools/check-runtime.mjs` 对关键运行时模块进行结构校验，并补齐单测覆盖，形成“改动可回归”的最低保障。

所有变更必须遵循开闭原则：**不破坏现有核心架构与业务逻辑**，仅通过增量扩展提升稳定交付能力。

## 变更内容

1. 新增 `logger`：统一的本地日志接口（level + meta），写入 `localStorage`（ring buffer）。
2. 诊断能力扩展：诊断包导出包含日志；诊断面板新增“最近日志”区域，并支持清空日志。
3. 新增工具链门禁：`tools/check-runtime.mjs` 校验诊断/日志模块在关键文件中的存在性（HTML/CSS/JS）。
4. 新增单测：覆盖 `tools/check-runtime.mjs` 的通过/失败分支，保证覆盖率阈值不回退。

## 影响范围

- **模块:** runtime / tooling / docs / helloagents SSOT
- **文件（预期）:**
  - `scripts.js`
  - `styles.css`
  - `dashboard.html`（如需补充按钮或摘要位）
  - `tools/check-runtime.mjs`（新增）
  - `tests/check-runtime.test.mjs`（新增）
  - `tools/check-all.mjs`、`.github/workflows/ci.yml`（纳入门禁）
  - `README.md`、`helloagents/wiki/modules/runtime.md`、`helloagents/CHANGELOG.md`

## 核心场景

### 需求: 本地日志监控
**模块:** runtime

#### 场景: 贡献者复现问题需要日志上下文
- 预期结果：
  - 可在诊断面板查看最近日志
  - 可导出诊断包（包含日志/错误/埋点/健康快照）
  - 不记录敏感信息（默认只允许短文本 + 白名单 meta）

#### 场景: 日志过多需要快速清理
- 预期结果：
  - 一键清空日志（不影响收藏/进度等业务数据）

### 需求: 运行时质量门禁
**模块:** tooling

#### 场景: 关键能力被误删/改名
- 预期结果：
  - CI 在 PR 阶段直接失败并给出明确错误提示
  - 本地可通过 `npm run check:all` 一键发现问题

## 风险评估

- **风险:** 日志可能被滥用记录敏感信息（PII）
  - **缓解:** 字段白名单 + 强制截断；仅本地存储；导出为用户主动行为
- **风险:** 日志写入影响性能/存储占用
  - **缓解:** ring buffer 限量；写失败静默降级；默认不做高频 debug 持久化

