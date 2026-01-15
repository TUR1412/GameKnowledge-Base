# 任务清单: UI Evolution v6（视觉 SSOT 收敛 + 部署稳态 + 交互完善）

目录: `helloagents/plan/202601150829_ui-evolution-v6/`

---

## 1. 视觉系统（styles.css）

- [√] 1.1 在 `styles.css` 中补齐 Accent 派生 token（secondary/glow/fx 等），验证 why.md#需求-视觉一致性（跨主题与偏好）-场景-主题--强调色组合切换
- [√] 1.2 在 `styles.css` 中修复可能存在兼容性风险的全局链接样式选择器，并用局部覆盖替代复杂 `:not(...)`，验证 why.md#需求-视觉一致性（跨主题与偏好）-场景-主题--强调色组合切换
- [√] 1.3 在 `styles.css` 中对按钮/Chip/Icon Button/卡片的交互态（hover/active/focus/disabled）做一致性收敛，确保在高对比/低动效/低透明下可读性优先，验证 why.md#需求-视觉一致性（跨主题与偏好）-场景-高对比与低动效低透明降级

## 2. Runtime 偏好系统（scripts.js）

- [√] 2.1 在 `scripts.js` 的 Settings Center 增加“仅重置外观偏好”动作（不影响业务数据），验证 why.md#需求-设置中心可控重置-场景-只重置外观偏好
- [√] 2.2 在 `scripts.js` 中为新动作补齐 Toast 提示、telemetry 事件与 Command Palette 快捷动作（如适用），并确保 Reduced Motion 下入场/关闭无异常

## 3. Pages 部署稳态（workflow + docs）

- [√] 3.1 在 `.github/workflows/pages.yml` 中补齐 Pages 标准化配置步骤，提升部署可诊断性，验证 why.md#需求-pages-部署可回归-场景-推送后自动部署
- [√] 3.2 更新 `docs/DEPLOYMENT.md`：明确 GitHub Actions 与分支部署两条路径、排障要点（缓存穿透/Pages 设置/Actions 状态）
- [-] 3.3 如有必要，同步更新 `README.md` 中的部署说明/链接（避免文档与实际交付路径不一致）
  > 备注: README 已通过 docs 链接指向部署说明，本次以 `docs/DEPLOYMENT.md` 作为 SSOT，无需重复维护。

## 4. 安全检查

- [√] 4.1 检查本次变更未引入外链资源、未破坏 CSP、未新增敏感信息存储；确认“仅重置外观偏好”不会误清空业务数据

## 5. 知识库与变更记录

- [√] 5.1 更新 `docs/STYLE_GUIDE.md`：补齐外观偏好重置约定与 token 收敛说明
- [√] 5.2 更新 `CHANGELOG.md`（对外）与 `helloagents/CHANGELOG.md`（SSOT）记录本次 UI Evolution v6
- [√] 5.3 更新 `helloagents/wiki/modules/runtime.md`（如涉及偏好系统/设置中心新增动作）

## 6. 验证与发布

- [√] 6.1 运行 `npm run check:all` 确保门禁通过
- [√] 6.2 运行 `node tools/bump-version.mjs` 同步更新 `data.js.version` 与全站 `?v=`
- [√] 6.3 再次运行 `npm run check:all` 做发布前回归确认

