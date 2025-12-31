# 任务清单: UI/UX 视觉革命 v3（Aurora Glass）

目录: `helloagents/plan/202512312032_ui-visual-evolution-v3/`

---

## 1. 设计系统（Tokens）收敛
- [√] 1.1 在 `styles.css` 末尾追加 “V20251231 UI Evolution” 区块：统一 `--grad-* / --border-grad / --glow-*` 与按钮/卡片消费方式，验证 why.md#需求-统一-aurora-glass-视觉体系
- [√] 1.2 为 `data-theme="dark"` 与 `data-contrast="high"` 提供对应 token 覆盖与降级策略，验证 why.md#需求-可访问性优先的降级策略

## 2. 关键组件视觉升级
- [√] 2.1 统一 `.btn/.btn-small/.btn-secondary/.btn-outline` 的阴影/渐变/press 手感，验证 why.md#需求-微交互世界级手感
- [√] 2.2 统一 `.icon-button` 的 hover/active/focus 反馈与阴影阶梯，验证 why.md#需求-微交互世界级手感
- [√] 2.3 统一 Hero/Banner 的光晕来源（使用 token），确保与全站背景一致，验证 why.md#需求-统一-aurora-glass-视觉体系

## 3. 安全检查
- [√] 3.1 执行安全检查（按G9: 不引入外链资源、不写入敏感信息、不放宽 CSP）

## 4. 版本与文档同步
- [√] 4.1 运行 `node tools/bump-version.mjs` bump 资源版本号（`?v=` 与 `data.js.version`），确保缓存穿透
- [√] 4.2 更新 `CHANGELOG.md` 与 `helloagents/CHANGELOG.md`，并补齐知识库记录（`helloagents/wiki/modules/runtime.md` 同步记录 UI Evolution v3）

## 5. 测试
- [√] 5.1 运行 `npm run check:all`，确保 CI 同款全量校验通过

---

## 执行小结
- 版本号已 bump：`20251225-2` → `20251231-1`
- 全量自检通过：`npm run check:all`
