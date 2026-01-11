# 任务清单: Docs 预缓存补齐 + README 专业化补强
目录: `helloagents/history/2026-01/202601120618_docs-precache-and-readme/`

---

## 1) PWA 离线体验（Docs）
- [√] 1.1 扩展 `sw.js` 的 `PRECACHE_URLS`：补齐 `docs/SECURITY.md` 与 `docs/CODE_OF_CONDUCT.md`（版本化 `?v=${VERSION}`）

## 2) README 专业化补强
- [√] 2.1 增加 CI/CodeQL 状态徽章
- [√] 2.2 更新 Gate 清单（对齐当前工具链门禁）

## 3) 知识库同步
- [√] 3.1 更新 `helloagents/CHANGELOG.md`
- [√] 3.2 归档方案包到 `helloagents/history/` 并更新 `helloagents/history/index.md`

## 4) 验证与发布
- [√] 4.1 运行 `npm run check:all`
- [√] 4.2 提交并 push 到 `origin/master`

---

## 执行总结

- PWA：Docs Portal 离线预缓存补齐（安全策略/行为准则离线可读）
- README：补齐 CI/CodeQL 徽章，并把质量门禁清单与 `npm run check:all` 对齐
- 验证：`npm run check:all` 全部通过（含单测覆盖率门禁 / 构建 / 站点完整性检查）
