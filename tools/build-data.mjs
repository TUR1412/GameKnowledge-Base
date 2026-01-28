import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const writeText = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const readJsonOptional = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const raw = readText(filePath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = String(err?.message || err || "unknown error");
    throw new Error(`[BUILD-DATA] JSON 解析失败：${filePath} -> ${msg}`);
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

const loadTaxonomy = (contentDir) => {
  const taxonomyPath = path.join(contentDir, "taxonomy.json");
  const taxonomy = readJsonOptional(taxonomyPath);
  if (!taxonomy) return null;

  const tagsTable = taxonomy.tags;
  const categoriesTable = taxonomy.topicCategories;
  if (!tagsTable || typeof tagsTable !== "object" || Array.isArray(tagsTable)) return null;
  if (!categoriesTable || typeof categoriesTable !== "object" || Array.isArray(categoriesTable)) return null;

  return { raw: taxonomy, tagIndex: buildAliasIndex(tagsTable), categoryIndex: buildAliasIndex(categoriesTable) };
};

const normalizeTags = ({ where, tags, taxonomy, errors }) => {
  if (!taxonomy) return tags;
  if (tags == null) return tags;
  if (!Array.isArray(tags)) {
    errors.push(`[BUILD-DATA] ${where}: tags 必须是数组`);
    return tags;
  }

  const out = [];
  const seen = new Set();

  tags.forEach((t) => {
    const raw = String(t || "").trim();
    if (!raw) {
      errors.push(`[BUILD-DATA] ${where}: tags 必须是非空字符串数组`);
      return;
    }
    const normalized = normalizeWithAlias(raw, taxonomy.tagIndex);
    if (!taxonomy.tagIndex.canonical.has(normalized)) {
      errors.push(`[BUILD-DATA] ${where}: tags 存在未登记标签 -> ${raw}`);
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
};

const normalizeTopicCategory = ({ where, category, taxonomy, errors }) => {
  if (!taxonomy) return category;
  const raw = String(category || "").trim();
  if (!raw) return category;
  const normalized = normalizeWithAlias(raw, taxonomy.categoryIndex);
  if (!taxonomy.categoryIndex.canonical.has(normalized)) {
    errors.push(`[BUILD-DATA] ${where}: category 未登记 -> ${raw}`);
    return category;
  }
  return normalized;
};

const readJson = (filePath) => {
  const raw = readText(filePath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = String(err?.message || err || "unknown error");
    throw new Error(`[BUILD-DATA] JSON 解析失败：${filePath} -> ${msg}`);
  }
};

const listJsonFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".json"))
    .map((d) => d.name)
    .sort();
};

const keyForObjectLiteral = (key) => {
  const k = String(key || "");
  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(k)) return k;
  return JSON.stringify(k);
};

const formatJs = (value, { indent = 0, indentStep = 2 } = {}) => {
  const pad = (n) => " ".repeat(n);

  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number") return Number.isFinite(value) ? String(value) : "null";
  if (t === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = value
      .map((v) => `${pad(indent + indentStep)}${formatJs(v, { indent: indent + indentStep, indentStep })}`)
      .join(",\n");
    return `[\n${inner}\n${pad(indent)}]`;
  }

  if (t === "object") {
    const entries = Object.entries(value || {});
    if (entries.length === 0) return "{}";

    const keys = entries.map(([k]) => String(k)).sort((a, b) => a.localeCompare(b));
    const lines = keys.map((k) => {
      const v = value[k];
      return `${pad(indent + indentStep)}${keyForObjectLiteral(k)}: ${formatJs(v, {
        indent: indent + indentStep,
        indentStep,
      })}`;
    });
    return `{\n${lines.join(",\n")}\n${pad(indent)}}`;
  }

  /* c8 ignore next */
  return "null";
};

const deriveIdFromFileName = (fileName) => String(fileName || "").replace(/\.json$/i, "").trim();

export const buildData = ({
  workspaceRoot = process.cwd(),
  contentDir,
  outFile,
} = {}) => {
  const errors = [];

  const resolvedContentDir = contentDir ?? path.join(workspaceRoot, "content");
  const resolvedOutFile = outFile ?? path.join(workspaceRoot, "data.js");

  const metaPath = path.join(resolvedContentDir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    errors.push(`[BUILD-DATA] 缺少内容元数据：${path.relative(workspaceRoot, metaPath).replace(/\\/g, "/")}`);
    return { ok: false, errors };
  }

  const meta = readJson(metaPath);
  if (!meta || typeof meta !== "object") errors.push("[BUILD-DATA] meta.json 必须是对象");

  const version = meta?.version;
  if (!isNonEmptyString(version)) errors.push("[BUILD-DATA] meta.json.version 必须是非空字符串（例：YYYYMMDD-N）");

  const site = meta?.site;
  if (!site || typeof site !== "object") errors.push("[BUILD-DATA] meta.json.site 必须是对象");
  if (!isNonEmptyString(site?.name)) errors.push("[BUILD-DATA] meta.json.site.name 不能为空");
  if (!isNonEmptyString(site?.tagline)) errors.push("[BUILD-DATA] meta.json.site.tagline 不能为空");
  if (!isNonEmptyString(site?.description)) errors.push("[BUILD-DATA] meta.json.site.description 不能为空");

  const contentGamesDir = path.join(resolvedContentDir, "games");
  const contentGuidesDir = path.join(resolvedContentDir, "guides");
  const contentTopicsDir = path.join(resolvedContentDir, "topics");

  const taxonomy = loadTaxonomy(resolvedContentDir);

  const games = {};
  const guides = {};
  const topics = {};

  const loadGroup = (label, dirPath, target) => {
    const files = listJsonFiles(dirPath);
    files.forEach((fileName) => {
      const id = deriveIdFromFileName(fileName);
      if (!isNonEmptyString(id)) {
        errors.push(`[BUILD-DATA] ${label}: 非法文件名（无法推导 id）：${fileName}`);
        return;
      }
      const filePath = path.join(dirPath, fileName);
      const obj = readJson(filePath);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        errors.push(`[BUILD-DATA] ${label}.${id}: JSON 必须是对象：${fileName}`);
        return;
      }

      // 标签/分类规范化（与 taxonomy.json 绑定）
      if (label === "topics") {
        obj.category = normalizeTopicCategory({ where: `${label}.${id}`, category: obj.category, taxonomy, errors });
      }
      // 注意：不要为“未声明 tags”的条目新增 tags 字段（否则会把 undefined 写成 null，破坏 content/ ↔ data.js 一致性）
      if (obj.tags != null) {
        obj.tags = normalizeTags({ where: `${label}.${id}`, tags: obj.tags, taxonomy, errors });
      }

      target[id] = obj;
    });
  };

  loadGroup("games", contentGamesDir, games);
  loadGroup("guides", contentGuidesDir, guides);
  loadGroup("topics", contentTopicsDir, topics);

  if (errors.length > 0) return { ok: false, errors };

  const data = {
    version: String(version).trim(),
    site,
    games,
    guides,
    topics,
  };

  const js = `/* 游戏攻略网 - 站点数据（由 tools/build-data.mjs 从 content/ 生成）\n *\n * 说明：\n * - 请勿手改本文件；修改请在 content/ 中进行，然后执行 build-data。\n * - 请勿在此硬编码任何密钥信息。\n */\n\n(() => {\n  const data = ${formatJs(data, { indent: 2 })};\n\n  window.GKB = window.GKB || {};\n  window.GKB.data = data;\n})();\n`;

  writeText(resolvedOutFile, js);
  return { ok: true, errors: [] };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const result = buildData({ workspaceRoot });
  if (!result.ok) {
    stderr("❌ build-data 未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout("✅ build-data 完成：已生成 data.js");
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
