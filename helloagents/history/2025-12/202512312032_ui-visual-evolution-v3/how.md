# 技术设计: UI/UX 视觉革命 v3（Aurora Glass）

## 技术方案

### 核心技术
- **CSS Design Tokens（变量）**：在 `styles.css` 末尾新增/收敛 token，作为全站视觉 SSOT。
- **渐变边框 ring（mask）**：复用既有 `mask-composite` 方案，只调整渐变源与强度，确保“只画边框环”不污染内容背景。
- **毛玻璃（backdrop-filter）**：复用 `--glass-*` tokens 控制 blur/saturation/brightness，并在高对比与 Reduced Motion 场景下自动降级。
- **Motion Tokens**：严格复用 `--dur-*` / `--ease-*`；不引入新依赖，不引入外链资源。

### 实现要点
- **策略选择：末尾覆盖（低回归风险）**
  - 不重排既有大段 CSS，而是通过末尾追加/覆盖实现“收敛与升级”，确保快速回滚与定位问题。
- **token 收敛原则**
  - `--grad-*` / `--border-grad` / `--glow-*` / `--elev-*` 形成一套闭环：卡片/按钮/导航/浮层只消费 token，不各写一套 rgba。
- **可访问性与降级**
  - `:root[data-contrast="high"]`：关闭 blur 与动态边框（更实的边界、更高对比文本）
  - `@media (prefers-reduced-motion: reduce)`：关闭 hover 动画与边框流动动画，保留必要的状态反馈
- **性能红线**
  - 避免在长列表元素上增加额外合成层；对 skeleton / virtualization 场景保持低成本样式（不加 blur、不加复杂滤镜）。

## 架构决策 ADR

### ADR-001: 采用“设计系统 token 收敛 + 末尾覆盖”而非全量重排 CSS
**上下文:** `styles.css` 历史较长且存在多轮补丁，直接重排会带来高回归风险与高成本 diff。  
**决策:** 延续末尾覆盖策略，但把“覆盖”升级为“收敛到 token SSOT”，逐步减少散落的颜色/阴影写法。  
**理由:** 在保证稳定交付的前提下获得可维护性与一致性提升；更容易做 A/B 与回滚。  
**替代方案:** 全量重写/拆分为多文件 → 拒绝原因: 对静态交付与工具链版本穿透要求不友好，回归面过大。  
**影响:** 末尾新增一段 “V20251231 UI Evolution” 作为当前视觉 SSOT；后续迭代继续追加在其后或直接修改该段落。

## 安全与性能
- **安全:** 不引入外链资源；不降低 CSP；不新增内联脚本；保持纯静态可托管。
- **性能:** 减少不必要的 filter/backdrop-filter 作用域；hover/动画严格受 token 与媒体查询控制。

## 测试与部署
- **测试:** 运行 `npm run check:all`（语法、单测覆盖率、Vite build、断链/HTML/Sitemap/SW/Feed/数据模型校验）。
- **部署:** 修改后使用 `node tools/bump-version.mjs` bump `?v=` 与 `data.js.version`，保证缓存穿透；再按既有流程推送到 GitHub Pages。
