# 任务清单: PWA Manifest 质量门禁（结构/资源/外链）
目录: `helloagents/history/2026-01/202601120701_manifest-quality-gate/`

---

## 1) Manifest 门禁
- [√] 1.1 新增 `tools/check-manifest.mjs`：校验 `manifest.webmanifest` 必备字段、JSON 合法性、icon/shortcut 资源存在性、禁止外链
- [√] 1.2 纳入工具链：更新 `tools/check-all.mjs` 与 CI（`.github/workflows/ci.yml`）

## 2) 单元测试
- [√] 2.1 新增 `tests/check-manifest.test.mjs` 覆盖通过/失败分支与 CLI 运行分支

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`
- [√] 3.2 更新 `helloagents/wiki/modules/tooling.md`
- [√] 3.3 更新 `helloagents/history/index.md`

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 提交并 push 到 `origin/master`

---

## 执行总结

- PWA：新增 Manifest 质量门禁（必备字段/图标与快捷入口资源/禁止外链），避免 PWA 元信息“悄悄退化”
- 工具链：`npm run check:all` 与 CI 对齐，保障本地与线上一致
- 测试：新增单测覆盖关键失败分支，维持覆盖率阈值通过
