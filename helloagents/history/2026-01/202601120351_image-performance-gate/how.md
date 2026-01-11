# 技术设计: 图片性能规范与原子设计文档补齐

## 技术方案

### 1) HTML 图片门禁（tools/check-html.mjs）

- 扫描根目录所有 `*.html`
- 对每个 `<img>` 要求：
  - 必须存在 `alt="..."`（允许为空字符串）
  - 必须存在 `loading="lazy|eager"`（显式声明加载策略）
  - 必须存在 `decoding="async|auto|sync"`（建议 async）

该门禁在 `npm run check:all` 与 CI 中执行，确保策略可回归。

### 2) 批量补齐 img 属性

- 默认策略：`loading="lazy" decoding="async"`
- 首屏关键图（如首页 Hero）：`loading="eager" fetchpriority="high" decoding="async"` 并补齐 `width/height`（降低 CLS）

### 3) Atomic Design 规范沉淀

在 `docs/STYLE_GUIDE.md` 中新增：

- Atoms：按钮/徽章/Chip/图标按钮等最小可复用单元
- Molecules：卡片/信息列表等复合片段
- Organisms：Header/Hero/面板类组件等页面级结构
- 图片性能规范（与门禁一致）

## 风险评估与规避

- **风险：** 某些页面存在特殊 `<img>` 写法导致门禁误报
  - **规避：** 门禁只要求属性存在，不做尺寸/类型强约束；必要时可通过最小改动补齐属性
- **风险：** lazy 策略影响首屏关键图显示
  - **规避：** 对首页 Hero 图显式改为 eager + fetchpriority

