import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadDataFromDataJs, readText } from "./lib/site.mjs";

export { loadDataFromDataJs, readText } from "./lib/site.mjs";

export const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
export const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
export const isDateString = (v) => isNonEmptyString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

const stableSort = (v) => {
  if (Array.isArray(v)) return v.map(stableSort);
  if (!v || typeof v !== "object") return v;
  const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
  const out = {};
  keys.forEach((k) => {
    out[k] = stableSort(v[k]);
  });
  return out;
};

const stableStringify = (v) => JSON.stringify(stableSort(v));

const readJsonFileOrNull = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const raw = readText(filePath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = String(err?.message || err || "unknown error");
    throw new Error(`[TAXONOMY] JSON 解析失败：${filePath} -> ${msg}`);
  }
};

const isAsciiLike = (s) => /^[\x00-\x7F]+$/.test(String(s || ""));

const buildAliasIndex = (table) => {
  const alias = new Map();
  const canonical = new Set();

  const obj = table && typeof table === "object" ? table : {};
  Object.entries(obj).forEach(([rawCanonical, rawAliases]) => {
    const c = String(rawCanonical || "").trim();
    if (!c) return;

    canonical.add(c);
    alias.set(c, c);
    if (isAsciiLike(c)) alias.set(c.toLowerCase(), c);

    const list = Array.isArray(rawAliases) ? rawAliases : [];
    list.forEach((a) => {
      const k = String(a || "").trim();
      if (!k) return;
      alias.set(k, c);
      if (isAsciiLike(k)) alias.set(k.toLowerCase(), c);
    });
  });

  return { alias, canonical };
};

const normalizeWithAlias = (value, aliasIndex) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const direct = aliasIndex.alias.get(raw);
  if (direct) return direct;

  const lower = raw.toLowerCase();
  const lowered = lower !== raw ? aliasIndex.alias.get(lower) : null;
  if (lowered) return lowered;

  return raw;
};

export const loadTaxonomyFromContent = ({ workspaceRoot = process.cwd() } = {}) => {
  const contentDir = path.join(workspaceRoot, "content");
  const metaPath = path.join(contentDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;

  const taxonomyPath = path.join(contentDir, "taxonomy.json");
  if (!fs.existsSync(taxonomyPath)) {
    return {
      ok: false,
      errors: ["[TAXONOMY] 缺少 content/taxonomy.json（标签/分类治理必备）"],
      taxonomy: null,
    };
  }

  const taxonomy = readJsonFileOrNull(taxonomyPath);
  if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy)) {
    return { ok: false, errors: ["[TAXONOMY] taxonomy.json 必须是对象"], taxonomy: null };
  }

  const tagsTable = taxonomy.tags;
  const categoriesTable = taxonomy.topicCategories;
  if (!tagsTable || typeof tagsTable !== "object" || Array.isArray(tagsTable)) {
    return { ok: false, errors: ["[TAXONOMY] taxonomy.json.tags 必须是对象（canonical->aliases[]）"], taxonomy: null };
  }
  if (!categoriesTable || typeof categoriesTable !== "object" || Array.isArray(categoriesTable)) {
    return {
      ok: false,
      errors: ["[TAXONOMY] taxonomy.json.topicCategories 必须是对象（canonical->aliases[]）"],
      taxonomy: null,
    };
  }

  const tagIndex = buildAliasIndex(tagsTable);
  const categoryIndex = buildAliasIndex(categoriesTable);
  return { ok: true, errors: [], taxonomy: { raw: taxonomy, tagIndex, categoryIndex } };
};

const listJsonFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".json"))
    .map((d) => d.name)
    .sort();
};

const readJson = (filePath) => {
  const raw = readText(filePath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = String(err?.message || err || "unknown error");
    throw new Error(`[CONTENT] JSON 解析失败：${filePath} -> ${msg}`);
  }
};

export const loadDataFromContent = ({ workspaceRoot = process.cwd() } = {}) => {
  const contentDir = path.join(workspaceRoot, "content");
  const metaPath = path.join(contentDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;

  const meta = readJson(metaPath);
  const version = meta?.version;
  const site = meta?.site;

  const readGroup = (dirName) => {
    const dirPath = path.join(contentDir, dirName);
    const out = {};
    listJsonFiles(dirPath).forEach((fileName) => {
      const id = String(fileName || "").replace(/\.json$/i, "").trim();
      if (!id) return;
      const obj = readJson(path.join(dirPath, fileName));
      out[id] = obj;
    });
    return out;
  };

  return {
    version,
    site,
    games: readGroup("games"),
    guides: readGroup("guides"),
    topics: readGroup("topics"),
  };
};

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

export const normalizeTags = ({ where, tags, taxonomy, errors }) => {
  if (!taxonomy) return tags;
  if (tags == null) return tags;
  if (!Array.isArray(tags)) return tags;

  const out = [];
  const seen = new Set();

  tags.forEach((t) => {
    const raw = String(t || "").trim();
    if (!raw) {
      errors.push(`[DATA] ${where}: tags 必须是非空字符串数组`);
      return;
    }
    const normalized = normalizeWithAlias(raw, taxonomy.tagIndex);
    if (!taxonomy.tagIndex.canonical.has(normalized)) {
      errors.push(`[DATA] ${where}: tags 存在未登记标签 -> ${raw}`);
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
};

export const normalizeTopicCategory = ({ where, category, taxonomy, errors }) => {
  if (!taxonomy) return category;
  const raw = String(category || "").trim();
  if (!raw) return category;
  const normalized = normalizeWithAlias(raw, taxonomy.categoryIndex);
  if (!taxonomy.categoryIndex.canonical.has(normalized)) {
    errors.push(`[DATA] ${where}: category 未登记 -> ${raw}`);
    return category;
  }
  return normalized;
};

export const validateStringArray = ({ where, value, label }) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length === 0) return [`[DATA] ${where}: ${label} 必须是非空数组`];
  const bad = value.filter((t) => !isNonEmptyString(t));
  if (bad.length > 0) return [`[DATA] ${where}: ${label} 必须是非空字符串数组`];
  return [];
};

export const validateData = ({ data, existsRel, workspaceRoot, taxonomy = null }) => {
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
    g.tags = normalizeTags({ where, tags: g.tags, taxonomy, errors });
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
    g.tags = normalizeTags({ where, tags: g.tags, taxonomy, errors });
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
    t.category = normalizeTopicCategory({ where, category: t.category, taxonomy, errors });
    if (!isDateString(t.updated)) errors.push(`[DATA] ${where}: updated 必须是 YYYY-MM-DD 格式`);
    if (!isNumber(t.replies)) errors.push(`[DATA] ${where}: replies 必须是数字`);
    t.tags = normalizeTags({ where, tags: t.tags, taxonomy, errors });
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

  const taxonomyResult = loadTaxonomyFromContent({ workspaceRoot });
  if (taxonomyResult && taxonomyResult.ok === false) {
    stderr("❌ taxonomy 校验未通过：");
    taxonomyResult.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  const taxonomy = taxonomyResult && taxonomyResult.ok ? taxonomyResult.taxonomy : null;

  const result = validateData({ data, workspaceRoot, taxonomy });
  if (result.errors.length > 0) {
    stderr("❌ data.js 数据校验未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  const contentData = loadDataFromContent({ workspaceRoot });
  if (contentData) {
    const contentErrors = [];
    if (!isNonEmptyString(contentData.version)) contentErrors.push("[CONTENT] meta.json.version 不能为空");
    if (!contentData.site || typeof contentData.site !== "object") contentErrors.push("[CONTENT] meta.json.site 必须是对象");
    if (!isNonEmptyString(contentData.site?.name)) contentErrors.push("[CONTENT] meta.json.site.name 不能为空");
    if (!isNonEmptyString(contentData.site?.tagline)) contentErrors.push("[CONTENT] meta.json.site.tagline 不能为空");
    if (!isNonEmptyString(contentData.site?.description)) contentErrors.push("[CONTENT] meta.json.site.description 不能为空");

    const contentValidation = validateData({ data: contentData, workspaceRoot, taxonomy });
    contentErrors.push(...contentValidation.errors);

    if (contentErrors.length > 0) {
      stderr("❌ content/ 数据校验未通过：");
      contentErrors.forEach((e) => stderr(`- ${e}`));
      return 1;
    }

    if (stableStringify(contentData) !== stableStringify(data)) {
      stderr("❌ content/ 与 data.js 不一致：请先运行 `node tools/build-data.mjs` 重新生成 data.js");
      return 1;
    }
  }

  const counts = `games=${result.counts.games}, guides=${result.counts.guides}, topics=${result.counts.topics}`;
  stdout(`✅ data.js 数据校验通过：${counts}${contentData ? "（content/ 已对齐）" : ""}`);
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
