import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadDataFromDataJs } from "./lib/site.mjs";

const writeText = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const stableJsonStringify = (value) => {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (!v || typeof v !== "object") return v;
    const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
    const out = {};
    keys.forEach((k) => {
      out[k] = sort(v[k]);
    });
    return out;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};

const buildTaxonomyFromData = (data) => {
  const tags = new Map();
  const addTag = (t) => {
    const v = String(t || "").trim();
    if (!v) return;
    tags.set(v, true);
  };

  Object.values(data?.games || {}).forEach((g) => (Array.isArray(g?.tags) ? g.tags.forEach(addTag) : null));
  Object.values(data?.guides || {}).forEach((g) => (Array.isArray(g?.tags) ? g.tags.forEach(addTag) : null));
  Object.values(data?.topics || {}).forEach((t) => (Array.isArray(t?.tags) ? t.tags.forEach(addTag) : null));

  const categories = new Map();
  Object.values(data?.topics || {}).forEach((t) => {
    const c = String(t?.category || "").trim();
    if (!c) return;
    categories.set(c, true);
  });

  const sortedTags = Array.from(tags.keys()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const sortedCategories = Array.from(categories.keys()).sort((a, b) => a.localeCompare(b, "zh-CN"));

  const obj = { version: 1, tags: {}, topicCategories: {} };
  sortedTags.forEach((t) => {
    obj.tags[t] = [];
  });
  sortedCategories.forEach((c) => {
    obj.topicCategories[c] = [];
  });

  return obj;
};

export const exportContent = ({
  workspaceRoot = process.cwd(),
  outDir = path.join(process.cwd(), "content"),
} = {}) => {
  const data = loadDataFromDataJs({ workspaceRoot });
  if (!data) {
    return { ok: false, errors: ["[EXPORT] 无法读取 data.js（请在仓库根目录运行）"] };
  }

  ensureDir(outDir);
  ensureDir(path.join(outDir, "games"));
  ensureDir(path.join(outDir, "guides"));
  ensureDir(path.join(outDir, "topics"));

  const meta = { version: data.version, site: data.site };
  writeText(path.join(outDir, "meta.json"), stableJsonStringify(meta));

  // 标签/分类治理：首次导出时生成 taxonomy.json（后续由维护者迭代 aliases）
  const taxonomyPath = path.join(outDir, "taxonomy.json");
  if (!fs.existsSync(taxonomyPath)) {
    const taxonomy = buildTaxonomyFromData(data);
    writeText(taxonomyPath, stableJsonStringify(taxonomy));
  }

  const writeGroup = (dirName, obj) => {
    const entries = Object.entries(obj || {}).sort(([a], [b]) => String(a).localeCompare(String(b)));
    entries.forEach(([id, value]) => {
      const safeId = String(id || "").trim();
      if (!safeId) return;
      writeText(path.join(outDir, dirName, `${safeId}.json`), stableJsonStringify(value));
    });
  };

  writeGroup("games", data.games);
  writeGroup("guides", data.guides);
  writeGroup("topics", data.topics);

  return { ok: true, errors: [] };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const r = exportContent({ workspaceRoot });
  if (!r.ok) {
    stderr("❌ export-content 未通过：");
    r.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout("✅ export-content 完成：已导出到 content/");
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
