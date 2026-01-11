# 任务清单: 图片性能规范与原子设计文档补齐

目录: `helloagents/plan/202601120351_image-performance-gate/`

---

## 1. Tooling：HTML 图片门禁
- [√] 1.1 更新 `tools/check-html.mjs`：为 `<img>` 强制要求 `alt/loading/decoding`

## 2. Runtime：补齐 img 性能属性
- [√] 2.1 批量为根目录 HTML 的 `<img>` 补齐 `loading/decoding`
- [√] 2.2 首屏关键图补齐 eager + fetchpriority + width/height

## 3. Docs：Atomic Design 规范
- [√] 3.1 更新 `docs/STYLE_GUIDE.md`：补齐 Atomic Design 分层与图片性能规范

## 4. 测试与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 执行 `node tools/bump-version.mjs` 并复跑关键校验
- [√] 4.3 提交并 push 到 `origin/master`

---

## 执行总结

- 版本号已 bump：`20260112-2` → `20260112-3`
- 校验链路：`npm run check:all` 通过（含 HTML 图片门禁 / Runtime 门禁 / 覆盖率阈值 / Vite build / 断链/SW/Feed/数据模型校验）
