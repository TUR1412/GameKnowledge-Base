# 安全策略 / Security Policy

---

## 中文（CN）

### 适用范围

本安全策略适用于 GameKnowledge-Base 仓库及其发布的静态站点内容（HTML/CSS/JS/PWA 与工具链脚本）。

### 支持版本

- 本项目默认仅支持 `master` 分支的最新版本（Latest）。
- 若你发现旧版本问题，也欢迎报告，但修复会以最新版本为基线评估与回归。

### 漏洞报告（负责任披露）

请不要在公开 Issue/PR 中发布漏洞细节。

优先级建议：

1. **优先**：使用 GitHub 的 “Report a vulnerability”/Security Advisories 私密通道（若仓库已启用）。
2. **否则**：创建一个 Issue（避免敏感细节），只提供高层描述，并请求维护者提供私密沟通方式继续跟进。

### 报告内容建议

为了更快定位问题，请尽量包含：

- 漏洞类型（XSS / CSP 绕过 / 供应链 / 缓存投毒 / 权限与数据泄露等）
- 影响范围（受影响页面/功能、可利用前提、潜在后果）
- 复现步骤（最小化步骤）
- 建议的缓解措施（如果你已有方向）
- 你的测试环境（浏览器/系统/网络条件）

### 响应与处置

我们会尽量：

- 在合理时间内确认收到报告
- 评估影响与修复优先级
- 在修复后发布说明（避免暴露可利用细节）

---

## English (EN)

### Scope

This policy applies to the GameKnowledge-Base repository and its published static site (HTML/CSS/JS/PWA and tooling scripts).

### Supported Versions

- We primarily support the latest version on the `master` branch.
- Reports on older versions are welcome, but fixes will be evaluated and validated against the latest version.

### Reporting (Responsible Disclosure)

Please do not disclose sensitive details in public issues or pull requests.

Recommended order:

1. **Preferred**: Use GitHub “Report a vulnerability” / Security Advisories (if enabled for this repository).
2. **Otherwise**: Open an issue without sensitive details, and ask maintainers for a private communication channel.

### What to Include

To help us reproduce and fix the issue, please include:

- Vulnerability type (XSS / CSP bypass / supply chain / cache poisoning / data exposure, etc.)
- Impact and scope (affected pages/features, prerequisites, potential outcomes)
- Minimal reproduction steps
- Suggested mitigations (if any)
- Your environment (browser/OS/network conditions)

### Response

We will try to:

- Acknowledge receipt within a reasonable timeframe
- Assess impact and prioritize a fix
- Publish a post-fix note without exploit details
