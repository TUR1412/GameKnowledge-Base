# 模块文档索引

本目录用于沉淀“可长期复用”的模块级文档（API、数据结构、关键流程、约束与决策）。

建议写法：

- 以模块/能力命名文件，例如：`runtime.md`、`content-pipeline.md`、`offline.md`
- 每次实现关键变更时同步更新对应模块文档，保证“文档与代码一致”

## 模块列表

- `helloagents/modules/baseline-2026.md`：2026 基线快照（升级前的客观指标）
- `helloagents/modules/budgets.md`：预算与门禁（构建产物/核心资产/离线壳）
- `helloagents/modules/content-engine.md`：内容引擎（content/ → data.js + taxonomy 治理）
- `helloagents/modules/release.md`：发布流程与门禁（Release Contract）
- `helloagents/modules/runtime-kernel.md`：运行时内核（模块化 core + 迁移策略）
- `helloagents/modules/offline-and-updates.md`：离线与更新（分层离线包 + 更新 UX + 门禁）
