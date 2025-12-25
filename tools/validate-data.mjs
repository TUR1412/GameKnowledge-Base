import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadDataFromDataJs, readText } from "./lib/site.mjs";

export { loadDataFromDataJs, readText } from "./lib/site.mjs";

export const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
export const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
export const isDateString = (v) => isNonEmptyString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

export const validateIcon = ({ where, icon, existsRel }) => {
  if (!isNonEmptyString(icon)) return [`[DATA] ${where}: icon 不能为空`];
  if (!String(icon).startsWith("images/")) {
    return [`[DATA] ${where}: icon 必须是 images/ 下的相对路径 -> ${icon}`];
  }
  if (!existsRel(String(icon))) return [`[DATA] ${where}: icon 文件不存在 -> ${icon}`];
  return [];
};

export const validateTags = ({ where, tags }) => {
  if (tags == null) return [];
  if (!Array.isArray(tags)) return [`[DATA] ${where}: tags 必须是数组`];
  const bad = tags.filter((t) => !isNonEmptyString(t));
  if (bad.length > 0) return [`[DATA] ${where}: tags 必须是非空字符串数组`];
  return [];
};

export const validateStringArray = ({ where, value, label }) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length === 0) return [`[DATA] ${where}: ${label} 必须是非空数组`];
  const bad = value.filter((t) => !isNonEmptyString(t));
  if (bad.length > 0) return [`[DATA] ${where}: ${label} 必须是非空字符串数组`];
  return [];
};

export const validateData = ({ data, existsRel, workspaceRoot }) => {
  const errors = [];

  const safeExistsRel =
    typeof existsRel === "function"
      ? existsRel
      : (relPath) => {
          try {
            return fs.existsSync(path.join(workspaceRoot, relPath));
          } catch (_) {
            return false;
          }
        };

  const games = data?.games || {};
  const guides = data?.guides || {};
  const topics = data?.topics || {};

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
    if (!isDateString(g.updated)) errors.push(`[DATA] ${where}: updated 必须是 YYYY-MM-DD 格式`);
    if (!Array.isArray(g.platforms) || g.platforms.length === 0) {
      errors.push(`[DATA] ${where}: platforms 必须是非空数组`);
    }
    if (!isNonEmptyString(g.summary)) errors.push(`[DATA] ${where}: summary 不能为空`);
    errors.push(...validateIcon({ where, icon: g.icon, existsRel: safeExistsRel }));
    errors.push(...validateStringArray({ where, value: g.modes, label: "modes" }));
    errors.push(...validateTags({ where, tags: g.tags }));
    errors.push(...validateStringArray({ where, value: g.highlights, label: "highlights" }));
    if (g.hasDeepGuide === true) {
      if (!isNonEmptyString(g.deepGuideHref)) {
        errors.push(`[DATA] ${where}: hasDeepGuide=true 时必须提供 deepGuideHref`);
      } else if (!safeExistsRel(g.deepGuideHref)) {
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
    if (!isDateString(g.updated)) errors.push(`[DATA] ${where}: updated 必须是 YYYY-MM-DD 格式`);
    if (!isNonEmptyString(g.difficulty)) errors.push(`[DATA] ${where}: difficulty 不能为空`);
    if (!isNumber(g.readingTime)) errors.push(`[DATA] ${where}: readingTime 必须是数字`);
    if (g.gameId != null) {
      const gameId = String(g.gameId || "");
      if (!gameId) errors.push(`[DATA] ${where}: gameId 不能为空字符串`);
      else if (!(gameId in games)) errors.push(`[DATA] ${where}: gameId 不存在 -> ${gameId}`);
    }
    if (g.icon != null) errors.push(...validateIcon({ where, icon: g.icon, existsRel: safeExistsRel }));
    errors.push(...validateTags({ where, tags: g.tags }));
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
    if (!isNonEmptyString(t.category)) errors.push(`[DATA] ${where}: category 不能为空`);
    if (!isDateString(t.updated)) errors.push(`[DATA] ${where}: updated 必须是 YYYY-MM-DD 格式`);
    if (!isNumber(t.replies)) errors.push(`[DATA] ${where}: replies 必须是数字`);
    errors.push(...validateTags({ where, tags: t.tags }));
  }

  return {
    errors,
    counts: {
      games: Object.keys(games).length,
      guides: Object.keys(guides).length,
      topics: Object.keys(topics).length,
    },
  };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const data = loadDataFromDataJs({ workspaceRoot });
  if (!data) {
    stderr("❌ 无法读取 data.js（请在仓库根目录运行）");
    return 1;
  }

  const result = validateData({ data, workspaceRoot });
  if (result.errors.length > 0) {
    stderr("❌ data.js 数据校验未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  const counts = `games=${result.counts.games}, guides=${result.counts.guides}, topics=${result.counts.topics}`;
  stdout(`✅ data.js 数据校验通过：${counts}`);
  return 0;
};

const isRunAsScript = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
};

/* c8 ignore next */
if (isRunAsScript()) {
  process.exit(main());
}
