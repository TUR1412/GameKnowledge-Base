# 技术设计: 本地日志监控与运行时质量门禁

## 技术方案

### 核心技术

- `localStorage` ring buffer（有限容量、可清空、写失败降级）
- 统一日志接口：`logger.{debug,info,warn,error}`（控制台输出 + 可选持久化）
- 工具链门禁：Node.js 脚本扫描关键文件内容（HTML/CSS/JS）并输出可读错误
- 单元测试：Node Test Runner（`node --test`）覆盖门禁脚本分支

### 实现要点

1. **Storage Keys**
   - `gkb-diagnostics-logs`：日志列表（ring buffer）

2. **Log Entry Schema（最小集合）**
   - `ts`：时间戳
   - `level`：`debug|info|warn|error`
   - `page`：`data-page`（或空）
   - `message`：短文本（强制截断）
   - `meta`：白名单对象（仅 string/number/boolean，键数限制）

3. **与诊断闭环整合**
   - `diagnostics.buildBundle()` 增加 `logs`
   - Diagnostics Panel 增加“最近日志”列表
   - Command Palette 增加“清空日志”入口（仅在日志非空时显示）

4. **工具链门禁 `tools/check-runtime.mjs`**
   - 校验点（增量且稳定）：
     - `scripts.js`：必须包含关键模块标记（例如 `initErrorBoundary` / `openDiagnosticsDialog` / `gkb-diagnostics-logs` key）
     - `styles.css`：必须包含诊断面板样式类（例如 `.diag-panel`）
     - `dashboard.html`：必须包含诊断卡片容器 id（例如 `dash-diagnostics`）
   - 输出：失败时列出缺失项，便于快速修复。

## 安全与性能

- **安全:** 不引入外链监控/日志 SDK；不写入敏感字段；导出为用户主动触发
- **性能:** ring buffer 限量；日志持久化默认避免 debug 高频写入

## 测试与部署

- 本地执行：
  - `npm run check:all`
  - `node tools/check-runtime.mjs`
- 修改核心文件后执行 `node tools/bump-version.mjs` 保持缓存穿透一致

