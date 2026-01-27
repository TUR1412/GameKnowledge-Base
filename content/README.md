# content/（内容源）

本目录是 GKB 的“可协作内容源”（适合多人编辑与审核）。

## 目录结构

```text
content/
  meta.json              # 版本号与站点信息（生成 data.js 的元信息）
  games/*.json           # 游戏条目（文件名 = id）
  guides/*.json          # 攻略条目（文件名 = id）
  topics/*.json          # 社区话题条目（文件名 = id）
```

## 如何生成运行时数据（data.js）

在仓库根目录执行：

```bash
npm run build:data
```

说明：

- `data.js` 是站点运行时的 SSOT（浏览器加载 `data.js`）
- `content/` 是协作源（人类编辑的主入口）

## 如何从现有 data.js 导出 content/（迁移辅助）

```bash
npm run export:content
```
