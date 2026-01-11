# 变更历史索引

本文件记录所有已完成变更的索引，便于追溯和查询。

---

## 索引

| 时间戳 | 功能名称 | 类型 | 状态 | 方案包路径 |
|--------|----------|------|------|------------|
| 202601120618 | docs-precache-and-readme | PWA/文档 | ✅已完成 | [2026-01/202601120618_docs-precache-and-readme](2026-01/202601120618_docs-precache-and-readme/) |
| 202601120607 | nav-aria-current | A11y/质量 | ✅已完成 | [2026-01/202601120607_nav-aria-current](2026-01/202601120607_nav-aria-current/) |
| 202601120558 | a11y-seo-gate | 工具链/质量 | ✅已完成 | [2026-01/202601120558_a11y-seo-gate](2026-01/202601120558_a11y-seo-gate/) |
| 202601120553 | codeql-security-scan | 安全/工具链 | ✅已完成 | [2026-01/202601120553_codeql-security-scan](2026-01/202601120553_codeql-security-scan/) |
| 202601120551 | dependabot-standardization | 工具链/协作 | ✅已完成 | [2026-01/202601120551_dependabot-standardization](2026-01/202601120551_dependabot-standardization/) |
| 202601120540 | community-standards | 文档/协作 | ✅已完成 | [2026-01/202601120540_community-standards](2026-01/202601120540_community-standards/) |
| 202601120525 | bundle-size-budget-gate | 工具链/性能 | ✅已完成 | [2026-01/202601120525_bundle-size-budget-gate](2026-01/202601120525_bundle-size-budget-gate/) |
| 202601120409 | check-html-testability | 工具链/测试 | ✅已完成 | [2026-01/202601120409_check-html-testability](2026-01/202601120409_check-html-testability/) |
| 202601120351 | image-performance-gate | 工具链/性能 | ✅已完成 | [2026-01/202601120351_image-performance-gate](2026-01/202601120351_image-performance-gate/) |
| 202601120253 | local-logging-and-runtime-checks | 运行时/工具链 | ✅已完成 | [2026-01/202601120253_local-logging-and-runtime-checks](2026-01/202601120253_local-logging-and-runtime-checks/) |
| 202601120222 | observability-runtime-diagnostics | 运行时/可观测性 | ✅已完成 | [2026-01/202601120222_observability-runtime-diagnostics](2026-01/202601120222_observability-runtime-diagnostics/) |
| 202601112050 | quantum-runtime-expansion | 重构/功能增强 | ✅已完成 | [2026-01/202601112050_quantum-runtime-expansion](2026-01/202601112050_quantum-runtime-expansion/) |
| 202512242055 | singularity-refactor | 重构/功能增强 | ✅已完成 | [2025-12/202512242055_singularity-refactor](2025-12/202512242055_singularity-refactor/) |
| 202512242324 | ui-visual-domain | 轻量迭代/视觉优化 | ✅已完成 | [2025-12/202512242324_ui-visual-domain](2025-12/202512242324_ui-visual-domain/) |
| 202512312032 | ui-visual-evolution-v3 | 视觉优化/设计系统 | ✅已完成 | [2025-12/202512312032_ui-visual-evolution-v3](2025-12/202512312032_ui-visual-evolution-v3/) |
| 202512312257 | docs-contributing-portal | 文档/工具链 | ✅已完成 | [2025-12/202512312257_docs-contributing-portal](2025-12/202512312257_docs-contributing-portal/) |

---

## 按月归档

### 2026-01

- [202601120618_docs-precache-and-readme](2026-01/202601120618_docs-precache-and-readme/) - Docs 预缓存补齐 + README 门禁对齐
- [202601120607_nav-aria-current](2026-01/202601120607_nav-aria-current/) - 主导航 aria-current 规范化（.active 对齐）
- [202601120558_a11y-seo-gate](2026-01/202601120558_a11y-seo-gate/) - A11y/SEO 基础门禁（lang/title/description）+ CSP 兼容检查
- [202601120553_codeql-security-scan](2026-01/202601120553_codeql-security-scan/) - CodeQL 静态分析（JavaScript 安全扫描）
- [202601120551_dependabot-standardization](2026-01/202601120551_dependabot-standardization/) - Dependabot 标准化（npm / GitHub Actions 每周更新）
- [202601120540_community-standards](2026-01/202601120540_community-standards/) - 安全策略/行为准则 + GitHub 协作模板（Issue/PR）
- [202601120525_bundle-size-budget-gate](2026-01/202601120525_bundle-size-budget-gate/) - 可选构建产物体积预算门禁（dist gzip）
- [202601120409_check-html-testability](2026-01/202601120409_check-html-testability/) - `tools/check-html.mjs` 可测试化（validateHtml/main）+ 单测补齐
- [202601120351_image-performance-gate](2026-01/202601120351_image-performance-gate/) - 图片性能门禁（img loading/decoding）+ Atomic Design 规范补齐
- [202601120253_local-logging-and-runtime-checks](2026-01/202601120253_local-logging-and-runtime-checks/) - 本地日志监控 + 运行时质量门禁（诊断面板扩展 / CI 门禁）
- [202601120222_observability-runtime-diagnostics](2026-01/202601120222_observability-runtime-diagnostics/) - 运行时可观测性：错误边界 + 诊断面板 + 健康指标增强
- [202601112050_quantum-runtime-expansion](2026-01/202601112050_quantum-runtime-expansion/) - 量子运行时扩展与体验重构

### 2025-12

- [202512242055_singularity-refactor](2025-12/202512242055_singularity-refactor/) - 动效层内建 + Feed/OpenSearch + 启动调度优化
- [202512242324_ui-visual-domain](2025-12/202512242324_ui-visual-domain/) - UI 视觉一致性：Header 对齐/动效手感/长文本遮罩
- [202512312032_ui-visual-evolution-v3](2025-12/202512312032_ui-visual-evolution-v3/) - Aurora Glass v3：视觉 SSOT 收敛（渐变边框/按钮/横幅）+ 高对比降级
- [202512312257_docs-contributing-portal](2025-12/202512312257_docs-contributing-portal/) - 贡献指南 + Docs Portal 扩展（离线可读）
