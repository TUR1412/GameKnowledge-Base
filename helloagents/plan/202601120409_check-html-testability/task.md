# 任务清单: check-html 可测试化与单测补齐

目录: `helloagents/plan/202601120409_check-html-testability/`

---

## 1) Tooling：check-html 可测试化
- [√] 1.1 重构 `tools/check-html.mjs`：导出 `validateHtml` + `main`，保持 CLI 行为不变
- [√] 1.2 保持现有门禁：Head 基础/禁止内联脚本/Skip Link/图片性能属性（alt/loading/decoding）

## 2) Tests：补齐单测覆盖
- [√] 2.1 新增 `tests/check-html.test.mjs` 覆盖通过/失败/CLI 分支

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`（如需要）
- [√] 3.2 更新 `helloagents/wiki/modules/tooling.md`（如需要）

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [ ] 4.2 提交并 push 到 `origin/master`
