# 技术设计: UI Evolution v5（设置中心 + Planner 日历导出）

## 技术方案

### 核心技术
- 原生 HTML/CSS/JS（无框架）
- `localStorage`（偏好与本地状态持久化）
- `boot.js` 首帧 dataset 注入（避免主题/偏好闪烁）
- 复用现有运行时能力：Toast / Dialog / Command Palette / MotionLite / View Transition
- `.ics`（iCalendar）文本生成与本地下载（Blob + `<a download>`）

### 实现要点

#### 1) 统一偏好模型（Preference Model）

新增偏好（保持可选、可降级、无破坏）：

- `gkb-accent`：强调色预设（例如 `violet` / `cyan` / `rose` / `amber` / `slate`）
- `gkb-density`：密度（`comfortable` / `compact`）
- `gkb-motion`：动效（`auto` / `reduce`）
- `gkb-transparency`：透明度（`auto` / `reduce`）
- `gkb-particles`：粒子背景（`on` / `off`）

落地策略：

1. `boot.js` 在 CSS 加载前读取上述 key，并写入 `document.documentElement.dataset`：
   - `data-accent`
   - `data-density`
   - `data-motion`
   - `data-transparency`
   - `data-particles`
2. `scripts.js` 负责：
   - 提供 `applyPreference(...)` 与 `setPreference(...)`（统一写 dataset + 持久化）
   - 对 `prefersReducedMotion()` / 透明度降级逻辑增加“用户显式设置优先”分支
   - 在设置中心与 Command Palette 中提供入口与快捷动作

兼容性：
- 缺失 key 时默认跟随系统偏好（`prefers-*`）
- 用户显式设置时覆盖系统偏好

#### 2) 设置中心（Settings Center）

目标：一个面板管理所有“站点级偏好”，并聚合常用动作。

实现形态：
- 复用现有 Dialog/Panel 模式：创建 `settings-root`（backdrop + panel），结构对齐 `cmdk-root/diag-root` 以共享交互手感（focus trap、Esc 关闭、Reduced Motion 降级）。
- 入口：
  - Header actions 注入 Settings 按钮
  - Command Palette 新增 “打开设置中心”动作，并提供“强调色/密度/动效/透明度”快捷切换项
  - Dashboard 提供“设置中心”快捷入口（保持“指挥舱”作为用户控制台）

安全与 CSP：
- 禁止 inline style / on* handler（符合门禁）
- 不引入任何外链资源

#### 3) Planner `.ics` 日历导出

目标：把“冲刺节奏”导出到日历，形成可执行的日程提醒。

数据来源：
- 复用 `buildSprintSchedule(plan, data, focusMinutes)` 输出的 sessions
- 扩展 `gkb-plan-settings`：
  - `focusMinutes`（已存在）
  - `startDate`（YYYY-MM-DD）
  - `startTime`（HH:MM）

生成策略（默认值尽量合理）：
- 默认 `startDate = 今天`
- 默认 `startTime = 20:00`
- 每个 session 生成一个 VEVENT：
  - `SUMMARY`: `路线名 · 冲刺 N`
  - `DTSTART/DTEND`: 按 startDate/time 递增到 N 天后（每天 1 个冲刺，避免事件堆叠）
  - `DESCRIPTION`: 条目清单（游戏/攻略）+ 估算分钟数
  - `UID/DTSTAMP`: 标准字段，确保多次导入可区分

导出方式：
- 生成文本后使用 Blob 下载：`gkb-plan-<version>-<date>.ics`

#### 4) 视觉系统 v5（token 收敛与状态开关）

目标：在不破坏现有页面结构的前提下，让新增偏好具备明确的 CSS 入口，并减少视觉漂移。

做法：
- 在 `styles.css` 末尾追加 v5 patch（延续“末尾覆盖”策略，降低回归风险）
- 新增/收敛 token：
  - accent 颜色映射（按 `data-accent`）
  - 密度映射（按 `data-density` 调整 `--space-*`/gap/padding）
  - 动效/透明度降级（按 `data-motion`/`data-transparency` + `prefers-*`）
- 对关键组件统一消费 token（按钮/卡片/面板/弹层/输入控件），确保深色与高对比度下层级一致

## 安全与性能

- 安全：不处理任何敏感信息，不引入密钥；本地导入/导出仅处理 `gkb-*` 前缀数据
- CSP：保持 `script-src 'self'`、无 inline handler/style
- 性能：
  - 设置变更优先通过 CSS variable + dataset 驱动，避免频繁重排
  - 粒子背景可关闭，且初始化在 idle 阶段
  - `.ics` 生成纯字符串，O(n) 复杂度（n=session + items）

## 测试与部署

- 本地校验：`npm run check:all`
- 构建：`npm run build:vite`（门禁会验证 gzip 预算）
- 版本升级：执行 `node tools/bump-version.mjs` 同步全站 `?v=` 与 `data.js.version`
- 文档同步：更新 `docs/STYLE_GUIDE.md` 与 `helloagents/wiki/modules/runtime.md`

