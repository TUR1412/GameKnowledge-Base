# 任务清单: A11y / SEO 基础门禁（HTML 语义与 CSP 兼容）

目录: `helloagents/history/2026-01/202601120558_a11y-seo-gate/`

---

## 1) Tooling：新增 a11y/seo 检查脚本
- [√] 1.1 新增 `tools/check-a11y.mjs`：校验根目录 HTML 的基础语义（lang/title/description）与 CSP 兼容（禁止 inline style / on* handler）
- [√] 1.2 集成到 `tools/check-all.mjs` 与 CI（与线上门禁一致）

## 2) Tests：补齐单测覆盖
- [√] 2.1 新增 `tests/check-a11y.test.mjs` 覆盖通过/失败/CLI 分支

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`
- [√] 3.2 更新 `helloagents/wiki/modules/tooling.md`

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 提交并 push 到 `origin/master`

---

## 执行总结

- 新增 `tools/check-a11y.mjs`：基础语义（lang/title/description）+ CSP 兼容（禁止 inline style / on* handler）
- 已纳入 `npm run check:all` 与 CI，并补齐单测覆盖，降低未来回退风险
