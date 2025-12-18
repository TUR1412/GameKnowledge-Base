import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const existsRel = (relPath) => {
  try {
    return fs.existsSync(path.join(WORKSPACE_ROOT, relPath));
  } catch (_) {
    return false;
  }
};

const loadDataFromDataJs = () => {
  const dataPath = path.join(WORKSPACE_ROOT, "data.js");
  if (!fs.existsSync(dataPath)) return null;

  const code = readText(dataPath);
  const context = { window: { GKB: {} } };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "data.js" });
  return context.window?.GKB?.data || null;
};

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

const validateIcon = (where, icon) => {
  if (!isNonEmptyString(icon)) return [`[DATA] ${where}: icon 不能为空`];
  if (!icon.startsWith("images/")) return [`[DATA] ${where}: icon 必须是 images/ 下的相对路径 -> ${icon}`];
  if (!existsRel(icon)) return [`[DATA] ${where}: icon 文件不存在 -> ${icon}`];
  return [];
};

const validateTags = (where, tags) => {
  if (tags == null) return [];
  if (!Array.isArray(tags)) return [`[DATA] ${where}: tags 必须是数组`];
  const bad = tags.filter((t) => !isNonEmptyString(t));
  if (bad.length > 0) return [`[DATA] ${where}: tags 必须是非空字符串数组`];
  return [];
};

const main = () => {
  const data = loadDataFromDataJs();
  if (!data) {
    console.error("❌ 无法读取 data.js（请在仓库根目录运行）");
    process.exit(1);
  }

  const errors = [];

  const games = data.games || {};
  const guides = data.guides || {};
  const topics = data.topics || {};

  // Games
  for (const [id, g] of Object.entries(games)) {
    const where = `games.${id}`;
    if (!isNonEmptyString(id)) errors.push(`[DATA] ${where}: id 不能为空`);
    if (!g || typeof g !== "object") {
      errors.push(`[DATA] ${where}: 必须是对象`);
      continue;
    }
    if (!isNonEmptyString(g.title)) errors.push(`[DATA] ${where}: title 不能为空`);
    if (!isNonEmptyString(g.genre)) errors.push(`[DATA] ${where}: genre 不能为空`);
    if (!isNumber(g.year)) errors.push(`[DATA] ${where}: year 必须是数字`);
    if (!isNumber(g.rating)) errors.push(`[DATA] ${where}: rating 必须是数字`);
    if (!Array.isArray(g.platforms) || g.platforms.length === 0) {
      errors.push(`[DATA] ${where}: platforms 必须是非空数组`);
    }
    if (!isNonEmptyString(g.summary)) errors.push(`[DATA] ${where}: summary 不能为空`);
    errors.push(...validateIcon(where, g.icon));
    if (g.hasDeepGuide === true) {
      if (!isNonEmptyString(g.deepGuideHref)) {
        errors.push(`[DATA] ${where}: hasDeepGuide=true 时必须提供 deepGuideHref`);
      } else if (!existsRel(g.deepGuideHref)) {
        errors.push(`[DATA] ${where}: deepGuideHref 指向不存在页面 -> ${g.deepGuideHref}`);
      }
    }
  }

  // Guides
  for (const [id, g] of Object.entries(guides)) {
    const where = `guides.${id}`;
    if (!isNonEmptyString(id)) errors.push(`[DATA] ${where}: id 不能为空`);
    if (!g || typeof g !== "object") {
      errors.push(`[DATA] ${where}: 必须是对象`);
      continue;
    }
    if (!isNonEmptyString(g.title)) errors.push(`[DATA] ${where}: title 不能为空`);
    if (!isNonEmptyString(g.summary)) errors.push(`[DATA] ${where}: summary 不能为空`);
    if (g.gameId != null) {
      const gameId = String(g.gameId || "");
      if (!gameId) errors.push(`[DATA] ${where}: gameId 不能为空字符串`);
      else if (!(gameId in games)) errors.push(`[DATA] ${where}: gameId 不存在 -> ${gameId}`);
    }
    if (g.icon != null) errors.push(...validateIcon(where, g.icon));
    errors.push(...validateTags(where, g.tags));
  }

  // Topics
  for (const [id, t] of Object.entries(topics)) {
    const where = `topics.${id}`;
    if (!isNonEmptyString(id)) errors.push(`[DATA] ${where}: id 不能为空`);
    if (!t || typeof t !== "object") {
      errors.push(`[DATA] ${where}: 必须是对象`);
      continue;
    }
    if (!isNonEmptyString(t.title)) errors.push(`[DATA] ${where}: title 不能为空`);
    if (!isNonEmptyString(t.starter)) errors.push(`[DATA] ${where}: starter 不能为空`);
    if (!isNonEmptyString(t.summary)) errors.push(`[DATA] ${where}: summary 不能为空`);
  }

  if (errors.length > 0) {
    console.error("❌ data.js 数据校验未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  const counts = `games=${Object.keys(games).length}, guides=${Object.keys(guides).length}, topics=${Object.keys(topics).length}`;
  console.log(`✅ data.js 数据校验通过：${counts}`);
};

main();

