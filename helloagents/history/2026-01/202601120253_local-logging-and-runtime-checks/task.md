# 任务清单: 本地日志监控与运行时质量门禁

目录: `helloagents/plan/202601120253_local-logging-and-runtime-checks/`

---

## 1. Runtime：本地日志（logger）
- [√] 1.1 在 `scripts.js` 中实现 logger（ring buffer + 截断/白名单），并写入 `gkb-diagnostics-logs`
- [√] 1.2 扩展 `diagnostics.buildBundle()`：导出包含 logs；诊断面板新增“最近日志”区域
- [√] 1.3 Command Palette 增加日志相关入口（如清空日志/导出诊断包）

## 2. Tooling：运行时门禁
- [√] 2.1 新增 `tools/check-runtime.mjs`（可被测试驱动的 main 函数 + CLI）
- [√] 2.2 将 `tools/check-runtime.mjs` 纳入 `tools/check-all.mjs` 与 CI 工作流

## 3. Tests：覆盖新增门禁
- [√] 3.1 新增 `tests/check-runtime.test.mjs` 覆盖通过/失败分支，保证覆盖率阈值不回退

## 4. 文档与知识库同步
- [√] 4.1 更新 `README.md` 补充日志监控与门禁自检入口
- [√] 4.2 更新 `helloagents/wiki/modules/runtime.md` 同步新增日志能力
- [√] 4.3 更新 `helloagents/CHANGELOG.md` 记录版本变更

## 5. 测试与发布
- [√] 5.1 运行 `npm run check:all`
- [√] 5.2 执行 `node tools/bump-version.mjs` 并复跑关键校验
- [√] 5.3 提交并 push 到 `origin/master`

---

## 执行总结

- 版本号已 bump：`20260112-1` → `20260112-2`
- 校验链路：`npm run check:all` 通过（含覆盖率阈值、Vite build、断链/SW/Feed/数据模型校验、Runtime 门禁）
