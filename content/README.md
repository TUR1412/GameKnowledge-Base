# content/（内容源）

本目录是 GKB 的“可协作内容源”（适合多人编辑与审核）。

## 目录结构

```text
content/
  meta.json              # 版本号与站点信息（生成 data.js 的元信息）
  taxonomy.json          # 标签/分类治理（canonical + aliases，阻止“脏标签/脏分类”进入主线）
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
- `taxonomy.json` 是“内容治理入口”：新增标签/话题分类前，先在此登记 canonical（必要时补 aliases）

## 如何从现有 data.js 导出 content/（迁移辅助）

```bash
npm run export:content
```

> 提示：当 `content/taxonomy.json` 不存在时，`export-content` 会根据现有数据自动生成一个最小 taxonomy（仅包含当前已使用的 tags/category；aliases 需要后续手动补齐）。
