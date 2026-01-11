# 任务清单: Bundle Size 性能预算门禁

目录: `helloagents/history/2026-01/202601120525_bundle-size-budget-gate/`

---

## 1) Tooling：Bundle Size 门禁脚本
- [√] 1.1 新增 `tools/check-bundlesize.mjs`：校验 `dist/gkb.min.{css,js}` 的 gzip 体积不超过预算（支持 env 覆盖）
- [√] 1.2 集成到 `tools/check-all.mjs` 与 CI（与线上门禁一致）

## 2) Tests：补齐单测覆盖
- [√] 2.1 新增 `tests/check-bundlesize.test.mjs` 覆盖通过/失败/CLI 分支

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`
- [√] 3.2 更新 `helloagents/wiki/modules/tooling.md`

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 提交并 push 到 `origin/master`

---

## 执行总结

- 新增可选构建产物体积预算门禁：默认 CSS ≤ 30kB、JS ≤ 80kB（gzip），支持使用 env 覆盖预算
- 门禁已纳入 `npm run check:all` 与 CI（与线上校验链路一致）
