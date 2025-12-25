# 项目技术约定

本文件定义 GameKnowledge-Base 的工程约定与“发布稳定交付”规则；与 `helloagents/wiki/*` 一起构成知识层面的 SSOT。

---

## 技术栈

- **站点形态:** 纯静态多页（无需后端、无需框架）
- **前端运行时:** 原生 HTML / CSS / JavaScript（ES2015+）
- **数据层:** `data.js` 以 `window.GKB.data` 暴露数据（`games/guides/topics + version`）
- **离线能力:** `sw.js`（Service Worker）+ Cache Storage + `manifest.webmanifest`（PWA）
- **工具链:** Node.js（CI 使用 `lts/*`）+ Node Test Runner（`node --test`）+ Vite（可选：极限压缩构建，默认使用 esbuild 压缩）

---

## 发布与缓存穿透（必须遵守）

### 版本号 SSOT

- **SSOT:** `data.js` 的 `version: "YYYYMMDD-N"`
- 所有核心资源必须带 `?v=` 且版本一致：
  - `styles.css?v=...`
  - `boot.js?v=...`
  - `data.js?v=...`
  - `scripts.js?v=...`
  - `manifest.webmanifest?v=...`

### 修改后如何 bump 版本

当修改以下任一文件时，必须 bump 版本并全站替换：

- `styles.css`
- `boot.js`
- `data.js`
- `scripts.js`
- `sw.js`
- `manifest.webmanifest`

执行：

- `node tools/bump-version.mjs`

---

## 代码约定（前端）

- `scripts.js` 使用 IIFE + `"use strict"`，避免泄露全局变量
- DOM 查询与遍历优先复用 helper（`$` / `$$`）
- `innerHTML` 渲染必须对用户可控内容做 HTML 转义（例如来自 `localStorage` 的文本）
- 主题/对比度遵循“用户显式设置优先，其次跟随系统偏好”的策略（`boot.js` 首帧注入，`scripts.js` 二次对齐）
- 动效统一走 Motion helper：
  - `MotionLite`：`scripts.js` 内建 WAAPI 轻量层（无第三方依赖）
  - `motionAnimate(...)`：统一入口，内置 `prefers-reduced-motion` 降级与异常兜底

---

## 安全与合规

- 全站页面必须保持严格 CSP（禁止外链脚本/样式/图片等“可执行/可渲染资源”）
- 本地状态仅存 `localStorage`，不存储任何密钥/令牌
- Service Worker 只缓存同源 GET 请求；导航离线回退到 `offline.html`

---

## 测试与 CI

本项目以“可验证的稳定交付”为目标，CI 必须保持通过：

- `npm run check:all`：本地一键跑完 CI 同款校验（推荐作为提交前自检入口）
- `npm ci`：安装开发依赖（用于 Vite 构建）
- `node --check`：核心脚本与工具脚本语法检查
- `node --test`：Node Test Runner + 覆盖率阈值
- `node tools/check-links.mjs`：断链/资源/缓存穿透
- `node tools/check-html.mjs`：HTML 结构约束
- `node tools/check-sitemap.mjs`：sitemap/robots 完整性与数据页覆盖
- `node tools/check-sw.mjs`：Service Worker 预缓存策略约束
- `node tools/validate-data.mjs`：数据模型校验
- `node tools/generate-feed.mjs --check`：Atom 订阅文件一致性
- `npm run build:vite`：可选的极限压缩构建（产物在 `dist/`）
