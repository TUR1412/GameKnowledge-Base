# 任务清单: UI Evolution v5（设置中心 + Planner 日历导出）

目录: `helloagents/plan/202601150530_ui-evo-v5-settings-planner-ics/`

---

## 1. 偏好系统（Preference Model）
- [√] 1.1 在 `boot.js` 中扩展首帧偏好注入：读取 `gkb-accent/gkb-density/gkb-motion/gkb-transparency/gkb-particles` 并写入 `html.dataset`，验证 why.md#需求-全局设置中心-场景-任意页面快速调整偏好
- [√] 1.2 在 `scripts.js` 中扩展 `STORAGE_KEYS` 与偏好读写 helper（dataset+localStorage 统一入口），并让 `prefersReducedMotion()` 支持用户覆盖（不破坏系统 prefers 分支）

## 2. 设置中心（UI + 交互）
- [√] 2.1 在 `scripts.js` 中实现 Settings Center（面板结构、Esc/Backdrop 关闭、focus 管理、Reduced Motion 降级），并在 Header actions 注入入口按钮
- [√] 2.2 在 `scripts.js` 的 Command Palette 中新增设置相关动作（打开设置、切换强调色/密度/动效/透明度/粒子开关），并记录本地埋点事件（不含敏感信息）
- [√] 2.3 在 `dashboard.html` 中增加“设置中心”入口与偏好概览区域（可选），保持无 JS 下结构可见

## 3. Planner 日历导出（.ics）
- [√] 3.1 在 `planner.html` 中新增开始日期/时间输入与“导出日历（.ics）”按钮，补齐 label/aria 描述，验证 why.md#需求-planner-日历导出-场景-冲刺节奏导入到日历
- [√] 3.2 在 `scripts.js` 的 Planner 模块中扩展 `planSettings`（startDate/startTime）并实现 `.ics` 生成与下载（含转义/折行），复用 `buildSprintSchedule`

## 4. 视觉系统 v5（CSS token 收敛）
- [√] 4.1 在 `styles.css` 末尾新增 v5 patch：支持 `data-accent/data-density/data-motion/data-transparency/data-particles`，并对核心组件消费 token（按钮/面板/输入/弹层/卡片）
- [√] 4.2 确保高对比度模式（`data-contrast="high"`）可读性优先：边界更清晰，玻璃与动态边框降级

## 5. 安全检查
- [√] 5.1 执行安全检查：确保无新增外链、无 inline style/handler、无敏感信息硬编码（按 G9）

## 6. 文档与知识库同步
- [√] 6.1 更新 `docs/STYLE_GUIDE.md`：新增偏好 key 约定与 Settings Center/Planner 导出规范
- [√] 6.2 更新 `helloagents/wiki/modules/runtime.md`：补齐偏好系统与日历导出能力说明
- [√] 6.3 更新 `helloagents/CHANGELOG.md`：记录本次变更（新增版本条目）

## 7. 测试与门禁
- [√] 7.1 运行 `npm run check:all`，确保全量门禁通过（含 Vite 构建与 bundle budget）

## 8. 版本升级与迁移
- [√] 8.1 执行 `node tools/bump-version.mjs` 同步版本号（`data.js.version` + 全站 HTML `?v=`）

## 9. 方案包迁移（强制）
- [√] 9.1 将本方案包迁移至 `helloagents/history/2026-01/202601150530_ui-evo-v5-settings-planner-ics/`，并更新 `helloagents/history/index.md`
