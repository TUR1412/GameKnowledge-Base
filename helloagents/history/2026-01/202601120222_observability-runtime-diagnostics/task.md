# 任务清单: 运行时可观测性与诊断面板

目录: `helloagents/plan/202601120222_observability-runtime-diagnostics/`

---

## 1. Runtime：错误边界与诊断存储
- [√] 1.1 在 `scripts.js` 中实现 diagnostics store（ring buffer + 截断/白名单），验证 why.md#需求-运行时异常兜底错误边界-场景-页面执行抛出异常
- [√] 1.2 在 `scripts.js` 中实现全局错误边界监听（error/unhandledrejection/securitypolicyviolation）并写入 diagnostics，验证 why.md#需求-运行时异常兜底错误边界-场景-promise-未处理拒绝

## 2. Runtime：诊断面板与入口
- [√] 2.1 在 `scripts.js` 中实现 Diagnostics Panel（open/close/focus trap/render），并接入 Command Palette 快捷操作，验证 why.md#需求-诊断面板与导出-场景-用户贡献者需要快速自检
- [√] 2.2 在 `dashboard.html` 增加“系统诊断”卡片结构，并在 `initDashboardPage` 中渲染摘要/绑定按钮
- [√] 2.3 在 `styles.css` 中补充诊断面板样式（复用 Aurora/Glass tokens），保证移动端可读性

## 3. Runtime：健康监控指标增强
- [√] 3.1 在 `scripts.js` 的 health monitor 中扩展 FCP/INP 采样，并让 `snapshot` 支持 `{ log=false }` 静默模式

## 4. 文档与知识库同步
- [√] 4.1 更新 `README.md`（中英双语）补充诊断能力与入口说明
- [√] 4.2 更新 `helloagents/wiki/modules/runtime.md` 同步新增模块能力，并补充变更索引
- [√] 4.3 更新 `helloagents/CHANGELOG.md` 记录本次变更

## 5. 安全检查
- [√] 5.1 执行安全检查：确认诊断包不包含敏感信息/不外发，CSP 下无内联脚本新增

## 6. 测试与质量门禁
- [√] 6.1 执行 `npm test` 与 `npm run test:coverage`
- [√] 6.2 执行 `npm run check:all` 与 `npm run build:vite`
- [√] 6.3 执行 `node tools/bump-version.mjs` 并确保 `tools/check-links.mjs` 通过

---

## 执行总结

- 版本号已 bump：`20260111-1` → `20260112-1`
- 校验链路：`npm run check:all` 通过（含覆盖率阈值、Vite build、断链/SW/Feed/数据模型校验）
