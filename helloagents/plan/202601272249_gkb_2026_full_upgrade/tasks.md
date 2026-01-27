# 任务清单: GKB 2026 全方位升级

目录: `helloagents/plan/202601272249_gkb_2026_full_upgrade/`

---

## 任务状态符号说明

| 符号 | 状态 | 说明 |
|------|------|------|
| `[ ]` | pending | 待执行 |
| `[√]` | completed | 已完成 |
| `[X]` | failed | 执行失败 |
| `[-]` | skipped | 已跳过 |
| `[?]` | uncertain | 待确认 |

---

## 执行状态

```yaml
总任务: 31
已完成: 9
完成率: 29%
```

---

## 任务列表

### 0. 基线与治理（先量化再开刀）

- [√] 0.1 建立升级基线：输出当前体积/性能/离线/搜索指标快照
  - 交付: `helloagents/modules/baseline-2026.md`
  - 验证: 指标可重复获取（同一 commit 多次执行一致）

- [√] 0.2 明确性能预算：定义 JS/CSS gzip、长任务阈值、关键页面加载目标
  - 验证: `npm run check:all` 可在 CI 中执行并失败于回退

- [√] 0.3 建立“发布门禁清单”：把 release 必做项写成机器可验证步骤
  - 验证: 文档与工具脚本一致（以工具脚本为准）

### 1. 内容引擎 v1（content -> data.js）

- [√] 1.1 新增 `content/` 目录结构（games/guides/topics），定义源格式与字段约束
  - 验证: 至少迁移 1 条 games + 1 条 guides + 1 条 topics 作为样例

- [√] 1.2 实现 `tools/build-data.mjs`：从 `content/` 生成 `data.js`
  - 依赖: 1.1
  - 验证: 生成输出稳定排序；重复执行无 diff（相同输入）

- [√] 1.3 扩展 `tools/validate-data.mjs`：同时校验源文件与生成产物一致性
  - 依赖: 1.2
  - 验证: 破坏样例字段能给出可定位错误（文件+字段）

- [√] 1.4 新增内容工作流文档：`docs/CONTENT_WORKFLOW.md`
  - 验证: 新贡献者按文档可在 10 分钟内完成“新增内容 + 通过 CI”

### 2. 运行时内核 v1（模块化 + 可测试）

- [√] 2.1 在 `src/runtime/` 拆分 core 模块（dom/storage/events/motion/net/diagnostics/telemetry）
  - 交付: `src/runtime/core/{dom,events,storage,telemetry,motion,net,logger,diagnostics}.mjs`
  - 交付: `tests/runtime-{core,net,diagnostics,dom-events-motion}.test.mjs`
  - 兼容: `scripts.js` 暴露 `GKB.runtime.{storage,storageKeys,safeJsonParse,readStringList,writeStringList,runIdleTask,netStore,net,health,telemetry,diagnostics,logger}` 只读句柄（页面行为不变）
  - 验证: `npm run check:all` 通过（覆盖率阈值不回退）

- [ ] 2.2 在 `src/runtime/pages/` 建立页面入口（按 `data-page` 精确 init）
  - 依赖: 2.1
  - 验证: 任意页面不会初始化不相关逻辑（可通过日志/断言验证）

- [ ] 2.3 将现有 `scripts.js` 逐步迁移到模块化入口（保留 IIFE 入口作为兼容层）
  - 依赖: 2.2
  - 验证: 功能不回退（关键路径手动验收 + 自动门禁通过）

### 3. 构建与交付 v1（默认发布链路）

- [ ] 3.1 调整 Vite 构建输出策略：产物可被 SW 预缓存且可预算（稳定文件名或可追踪映射）
  - 验证: `tools/check-bundlesize.mjs` 对新产物仍可生效

- [ ] 3.2 形成“发布命令”：串联 build + 校验 + bump version + 生成 feed/sitemap
  - 验证: 单命令可本地跑通，且 CI 可复用同一入口

- [ ] 3.3 更新 `pages.yml`：发布产物与站点引用一致（避免部署了 dist 但页面仍引用旧资源）
  - 依赖: 3.1, 3.2
  - 验证: GitHub Pages 部署后，离线可用且版本一致性通过

### 4. 搜索与信息架构（把搜索做成核心产品能力）

- [ ] 4.1 引入搜索 Worker：索引构建/重建放到 Worker，主线程只做交互
  - 验证: 首开不出现明显卡顿（长任务门禁通过）

- [ ] 4.2 索引持久化：将索引缓存到 IndexedDB（或压缩 blob），并与版本号绑定
  - 依赖: 4.1
  - 验证: 版本变化自动失效重建；版本不变命中缓存

- [ ] 4.3 信息架构收敛：标签/分类规范化（统一大小写、同义合并、展示规则）
  - 验证: 数据校验可阻止新增“脏标签”

### 5. 离线与更新（可控、可进度、可回滚）

- [ ] 5.1 离线包分层：核心壳层/页面/媒体资源分层缓存，支持选择性下载
  - 验证: 弱网下可见进度；失败可重试；不影响在线访问

- [ ] 5.2 SW 更新 UX：提示新版本可用，并提供“立即刷新/稍后”选择
  - 验证: 不出现“旧 SW + 新页面”错配导致的异常（通过一致性门禁）

- [ ] 5.3 增强一致性门禁：把“版本号一致性 + 预缓存清单完整性”覆盖到新增产物
  - 验证: 漏加资源必失败于 CI

- [ ] 5.4 状态可携带：提供本地数据一键导出/导入（不引入后端）
  - 验证: 导出文件不包含任何密钥/令牌；导入具备版本迁移策略；导入后可正常浏览与离线

### 6. SEO / 分享 / 增长

- [ ] 6.1 为关键页面补齐结构化数据（JSON-LD）与 Open Graph（可批量生成）
  - 验证: `tools/check-html.mjs` 增加对应约束并纳入 CI

- [ ] 6.2 sitemap/feed 生成升级：覆盖新增内容与入口页（0 漏页）
  - 验证: `tools/check-sitemap.mjs` / `tools/generate-feed.mjs --check` 通过

### 7. 文档与知识库同步（让升级可持续）

- [ ] 7.1 模块文档：新增 `helloagents/modules/content-engine.md`
  - 验证: 内容格式、生成流程、校验规则写清楚且与代码一致

- [ ] 7.2 模块文档：新增 `helloagents/modules/runtime-kernel.md`
  - 验证: 模块边界、页面入口、feature 注册机制可被复用

- [ ] 7.3 模块文档：新增 `helloagents/modules/offline-and-updates.md`
  - 验证: SW 策略、离线包策略、更新 UX 与门禁一致

- [√] 7.4 收敛入口：更新 `helloagents/INDEX.md` 与 `helloagents/context.md`，保证新旧文档不割裂
  - 验证: 新成员只看这两个文件即可找到“做事入口”

---

## 执行备注

> 执行过程中的重要记录（阻断点、权衡、回滚原因等）写在这里，确保后续复盘可追溯。

| 任务 | 状态 | 备注 |
|------|------|------|
