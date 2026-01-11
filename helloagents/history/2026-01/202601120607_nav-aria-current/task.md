# 任务清单: 导航 aria-current 门禁 + 页面一致性修复

目录: `helloagents/history/2026-01/202601120607_nav-aria-current/`

---

## 1) A11y 门禁升级
- [√] 1.1 扩展 `tools/check-a11y.mjs`：要求主导航（`#site-nav`）中 `.active` 链接必须带 `aria-current="page"`
- [√] 1.2 维持现有规则：lang/title/description + CSP 兼容检查

## 2) HTML 修复
- [√] 2.1 为所有页面主导航的当前页链接补齐 `aria-current="page"`（与 `.active` 对齐）

## 3) Tests：回归与覆盖
- [√] 3.1 更新 `tests/check-a11y.test.mjs` 覆盖新规则（失败/通过）

## 4) 知识库同步
- [√] 4.1 更新 `helloagents/CHANGELOG.md`

## 5) 验证与发布
- [√] 5.1 运行 `npm run check:all`
- [√] 5.2 提交并 push 到 `origin/master`

---

## 执行总结

- 主导航当前页链接统一补齐 `aria-current="page"`，与 `.active` 对齐
- `tools/check-a11y.mjs` 新增门禁防止未来回退，并补齐单测覆盖
