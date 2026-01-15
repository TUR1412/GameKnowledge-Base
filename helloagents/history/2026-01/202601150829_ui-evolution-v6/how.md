# 技术设计: UI Evolution v6（视觉 SSOT 收敛 + 部署稳态 + 交互完善）

## 技术方案

### 核心技术

- 原生 HTML / CSS / JavaScript（无框架）
- 主题/偏好首帧注入：`boot.js` → `html.dataset`
- 运行时偏好与组件：`scripts.js`
- PWA：`sw.js` + `manifest.webmanifest`
- GitHub Pages：`.github/workflows/pages.yml`

### 实现要点

#### 1) 视觉系统（styles.css）以 Accent 为主导 SSOT

目标：让“强调色”真正成为全站唯一主色驱动源，避免历史补丁残留导致的风格漂移。

策略：

1. **收敛 token**：在 `styles.css` 的 UI Evolution v5（末尾）基础上，补齐以下派生 token：
   - `--secondary-color / --secondary-dark / --secondary-light`：由 accent 派生互补/邻近色（与 `--grad-b`/`--glow-secondary` 保持一致）
   - `--accent-color`：统一指向 `--accent`（避免存在多个“accent”语义来源）
   - `--fx-spot-1/2`、`--fx-ripple`：与 accent 联动，保证卡片追光/点击涟漪在切换强调色时不割裂
2. **对主题/高对比/降级保持一致**：
   - `data-theme="dark"` 下适当提高 glow/spot 的不透明度，但控制饱和度，避免“霓虹刺眼”
   - `data-contrast="high"` 下关闭追光与干扰性渐变，保持边界清晰
3. **修复全局选择器隐患**：
   - 将可能存在兼容性风险的复杂 `:not(...)` 组合，替换为“基础选择器 + 局部覆盖”的方式，避免在部分浏览器上整条规则失效

#### 2) Settings Center：增加“仅重置外观偏好”

目标：把“外观偏好”与“业务数据”拆开，让用户可以快速恢复默认 UI，而不需要清空所有 localStorage 数据。

策略：

- UI：在 Settings Center 的“离线与数据”区增加独立按钮 `settings-reset-ui`（命名以 action 为准）
- 逻辑：
  - 清除/回退的 key 范围限定为：`theme/contrast/accent/density/motion/transparency/particles`
  - 执行后立即对齐 `html.dataset`（与 `boot.js` 的首帧策略一致）
  - 通过 Toast 给出明确提示（不会影响收藏/笔记/进度等）
- 风险控制：不触碰 `savedGames/savedGuides/...` 等业务 key，避免“误清空”带来不可逆损失

#### 3) GitHub Pages：部署稳态与文档对齐

目标：让“看起来没部署”的问题可诊断、可复现、可回归。

策略：

- workflow：在 `pages.yml` 中补齐官方推荐的 Pages 配置步骤（例如 `actions/configure-pages`），确保环境/权限/输出路径更标准化。
- docs：更新 `docs/DEPLOYMENT.md`，同时说明：
  - **方案A：GitHub Actions 部署（推荐）**：对应仓库设置 `Pages -> Source: GitHub Actions`
  - **方案B：分支部署（兜底）**：`Deploy from a branch` + `master` + `/ (root)`
  - 常见排障：缓存穿透版本号、Actions 是否触发、仓库 Pages 是否开启等

## 架构设计（无新增模块）

本次不引入新模块与新依赖，保持既有架构：

- `boot.js` 负责首帧 dataset 注入
- `styles.css` 消费 dataset + token
- `scripts.js` 负责偏好读写与设置中心交互
- Pages 仍为“纯静态托管”，不增加构建依赖

## 架构决策 ADR

### ADR-20260115-UIEVO6-01: 视觉系统以 Accent 单源派生为 SSOT

**上下文:** `styles.css` 存在多轮 token/组件叠加，导致强调色切换时仍有固定色残留（追光/辅色/边框等），维护成本高且容易出现跨页风格漂移。  
**决策:** 以 `--accent-*` 为单源，统一派生 primary/secondary/glow/fx 等关键 token，并以 `data-contrast`/`data-theme` 做确定性降级。  
**理由:** 保持可维护性与可回归性：改一个源 → 全站一致变化；同时符合现有“token SSOT”约定。  
**替代方案:**  
- 保留多套历史 token（拒绝原因：漂移不可控、维护成本持续上升）  
- 引入 UI 框架（拒绝原因：违背“无外部依赖/纯静态”的交付目标）  
**影响:** UI 更一致；需要对 `styles.css` 做一次集中收敛，且必须跑全量门禁验证。

## 安全与性能

- 安全
  - 不引入外链资源，继续遵守 CSP
  - 不新增密钥/令牌存储
  - “仅重置外观偏好”不清空业务数据，避免误操作导致用户数据丢失
- 性能
  - token 派生为纯 CSS 变量，不引入额外运行时代价
  - 继续尊重 `prefers-reduced-motion` 与 `content-visibility` 等既有性能策略

## 测试与部署

- 本地验证：`npm run check:all`
- 版本号更新：修改核心资源后运行 `node tools/bump-version.mjs`（确保 `data.js.version` 与全站 `?v=` 一致）
- 部署：push 到 `master` 后由 GitHub Actions Pages workflow 部署；或使用分支部署兜底

