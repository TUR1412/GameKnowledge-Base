# 任务清单: Placeholder 图片尺寸门禁（CLS）+ 页面补齐
目录: `helloagents/history/2026-01/202601120642_placeholder-img-dimensions-gate/`

---

## 1) HTML 质量门禁（CLS）
- [√] 1.1 扩展 `tools/check-html.mjs`：对 `images/placeholders/*` 的 `<img>` 强制要求 `width/height`，用于降低 CLS
- [√] 1.2 补齐单测：`tests/check-html.test.mjs` 增加占位图宽高缺失的失败用例

## 2) 页面修复
- [√] 2.1 补齐 `starlight-miracle.html` 中占位图的 `width/height`（cover/screenshot/avatar）

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`
- [√] 3.2 更新 `helloagents/history/index.md`

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 提交并 push 到 `origin/master`

---

## 执行总结

- HTML 门禁扩展为 CLS 友好：占位图强制要求 width/height（避免加载后布局抖动）
- 页面补齐：`starlight-miracle.html` 占位图尺寸补齐（cover/screenshot/avatar）
- 验证：`npm run check:all` 通过（单测、覆盖率、构建、站点完整性与门禁链路）
