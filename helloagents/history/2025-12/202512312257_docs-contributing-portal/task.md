# 任务清单: 贡献指南 + Docs Portal 扩展（离线可读）

目录: `helloagents/plan/202512312257_docs-contributing-portal/`

---

## 1. 文档新增
- [√] 1.1 新增 `docs/CONTRIBUTING.md`，覆盖内容贡献/工程贡献/版本穿透/自检清单
- [√] 1.2 新增根目录 `CONTRIBUTING.md`，作为 GitHub 入口并指向站内文档

## 2. Docs Portal 扩展
- [√] 2.1 在 `scripts.js` 的文档列表中新增 `CONTRIBUTING`
- [√] 2.2 更新 `docs.html` 的描述与提示文案（支持 `?doc=CONTRIBUTING` 直达）

## 3. 离线预缓存
- [√] 3.1 在 `sw.js` 预缓存列表加入 `docs/CONTRIBUTING.md?v=${VERSION}`

## 4. 缓存穿透与一致性
- [√] 4.1 bump 版本号：`20251231-1` → `20251231-2`
- [√] 4.2 README 示例版本号与 docs 直达链接同步更新

## 5. 测试
- [√] 5.1 运行 `npm run check:all`，确保 CI 同款校验通过

