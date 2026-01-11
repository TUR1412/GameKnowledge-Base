# GameKnowledge-Base

> 本文件包含项目级别的核心信息。详细的模块文档见 `modules/` 目录。

---

## 1. 项目概述

### 目标与背景

GameKnowledge-Base 是一个“数据驱动的纯静态游戏攻略站点”：

- **无需后端 / 无框架依赖**，可直接部署到 GitHub Pages 或任意静态托管
- **Local-first**：收藏/筛选/进度/笔记/回复等状态保存在浏览器本地
- **离线可用**：PWA + Service Worker 预缓存核心入口页与关键资源

### 范围

- **范围内**
  - 游戏/攻略/话题三类数据驱动内容
  - 全站搜索（Command Palette）与筛选体验
  - 行为画像与节奏引擎（DNA/动量/冲刺/热度/影响力）
  - PWA 离线、缓存穿透、稳定交付工具链
- **范围外**
  - 用户账号体系 / 服务端存储 / 实时多人协作
  - 任何需要密钥的第三方 API（避免把静态站点变成泄露源）

---

## 2. 模块索引

| 模块名称 | 职责 | 状态 | 文档 |
|---------|------|------|------|
| runtime | 浏览器运行时（页面、样式、交互、离线） | 稳定 | [modules/runtime.md](modules/runtime.md) |
| tooling | 工具链与 CI 校验（断链/SW/数据模型/Feed/Sitemap） | 稳定 | [modules/tooling.md](modules/tooling.md) |

---

## 3. 快速链接

- [技术约定](../project.md)
- [架构设计](arch.md)
- [URL / 浏览器侧 API](api.md)
- [数据模型](data.md)
- [变更历史](../history/index.md)
