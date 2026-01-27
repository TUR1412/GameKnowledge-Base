import fs from "node:fs";
import path from "node:path";

import { buildData } from "./build-data.mjs";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const writeText = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

const listRootHtmlFiles = () =>
  fs
    .readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const pad2 = (n) => String(n).padStart(2, "0");

const todayStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
};

const parseCurrentVersion = (dataJsText) => {
  const m = dataJsText.match(/version:\s*"([^"]+)"/);
  return m ? String(m[1] || "").trim() : "";
};

const nextVersion = (current) => {
  const m = String(current).trim().match(/^(\d{8})-(\d+)$/);
  const today = todayStamp();
  if (!m) return `${today}-1`;
  const [, date, seqRaw] = m;
  const seq = Number(seqRaw || 0);
  if (date !== today) return `${today}-1`;
  return `${date}-${Math.max(1, seq + 1)}`;
};

const replaceAll = (content, re, replacer) => {
  const next = content.replace(re, replacer);
  return { next, changed: next !== content };
};

const bumpAssetVersionsInHtml = (content, version) => {
  const patterns = [
    { label: "styles", re: /styles\.css\?v=[^"']+/g, required: true },
    { label: "manifest", re: /manifest\.webmanifest\?v=[^"']+/g, required: true },
    { label: "boot", re: /boot\.js\?v=[^"']+/g, required: true },
    { label: "data", re: /data\.js\?v=[^"']+/g, required: true },
    { label: "scripts", re: /scripts\.js\?v=[^"']+/g, required: true },
  ];

  let next = content;
  const hits = {};
  for (const p of patterns) hits[p.label] = 0;

  for (const p of patterns) {
    const { next: updated, changed } = replaceAll(next, p.re, (m) => {
      hits[p.label] += 1;
      return m.replace(/v=[^"']+/, `v=${version}`);
    });
    next = updated;
    if (!changed) {
      // no-op
    }
  }

  const requiredLabels = new Set(patterns.filter((p) => p.required).map((p) => p.label));
  const missing = Object.entries(hits)
    .filter(([label, count]) => requiredLabels.has(label) && count === 0)
    .map(([label]) => label);

  return { next, missing };
};

const bumpDocsStyleGuide = (content, version) => {
  return content
    .replace(/styles\.css\?v=[^\s"']+/g, `styles.css?v=${version}`)
    .replace(/manifest\.webmanifest\?v=[^\s"']+/g, `manifest.webmanifest?v=${version}`)
    .replace(/boot\.js\?v=[^\s"']+/g, `boot.js?v=${version}`)
    .replace(/data\.js\?v=[^\s"']+/g, `data.js?v=${version}`)
    .replace(/scripts\.js\?v=[^\s"']+/g, `scripts.js?v=${version}`);
};

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

const main = () => {
  const args = new Set(process.argv.slice(2));
  const isDryRun = args.has("--dry-run");

  const contentMetaPath = path.join(WORKSPACE_ROOT, "content", "meta.json");
  const hasContentMeta = fs.existsSync(contentMetaPath);

  const dataPath = path.join(WORKSPACE_ROOT, "data.js");
  if (!hasContentMeta && !fs.existsSync(dataPath)) {
    console.error("❌ 未找到 data.js（请在仓库根目录运行）");
    process.exit(1);
  }

  let current = "";
  if (hasContentMeta) {
    try {
      const meta = JSON.parse(readText(contentMetaPath));
      current = String(meta?.version || "").trim();
    } catch (err) {
      console.error(`❌ content/meta.json 解析失败：${String(err?.message || err || "unknown error")}`);
      process.exit(1);
    }
  } else {
    const dataText = readText(dataPath);
    current = parseCurrentVersion(dataText);
  }

  if (!current) {
    console.error(
      hasContentMeta
        ? "❌ content/meta.json 中未找到 version（例：\"version\": \"20251218-1\"）"
        : "❌ data.js 中未找到 data.version（例：version: \"20251218-1\"）"
    );
    process.exit(1);
  }

  const target = nextVersion(current);

  const filesToUpdate = [
    ...listRootHtmlFiles().map((f) => path.join(WORKSPACE_ROOT, f)),
    path.join(WORKSPACE_ROOT, "docs", "STYLE_GUIDE.md"),
    path.join(WORKSPACE_ROOT, "docs", "DATA_MODEL.md"),
    hasContentMeta ? path.join(WORKSPACE_ROOT, "content", "meta.json") : path.join(WORKSPACE_ROOT, "data.js"),
  ].filter((p) => fs.existsSync(p));

  const missingByFile = [];
  let touched = 0;

  for (const filePath of filesToUpdate) {
    const rel = path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, "/");
    const raw = readText(filePath);

    let next = raw;
    let changed = false;

    if (rel.endsWith(".html")) {
      const result = bumpAssetVersionsInHtml(next, target);
      next = result.next;
      changed = changed || next !== raw;
      if (result.missing.length > 0) {
        missingByFile.push({ file: rel, missing: result.missing });
      }
    } else if (rel === "data.js") {
      next = next.replace(/version:\s*"([^"]+)"/, `version: "${target}"`);
      changed = changed || next !== raw;
    } else if (rel === "content/meta.json") {
      try {
        const meta = JSON.parse(next);
        if (!meta || typeof meta !== "object") throw new Error("meta.json 必须是对象");
        meta.version = target;
        next = stableJsonStringify(meta);
        changed = changed || next !== raw;
      } catch (err) {
        console.error(`❌ content/meta.json 更新失败：${String(err?.message || err || "unknown error")}`);
        process.exit(1);
      }
    } else if (rel === "docs/STYLE_GUIDE.md") {
      next = bumpDocsStyleGuide(next, target);
      changed = changed || next !== raw;
    } else if (rel === "docs/DATA_MODEL.md") {
      next = next.replace(/version:\s*"([^"]+)"/, `version: "${target}"`);
      changed = changed || next !== raw;
    }

    if (!changed) continue;
    touched += 1;
    if (!isDryRun) writeText(filePath, next);
  }

  if (missingByFile.length > 0) {
    console.error("❌ 发现缺少缓存穿透版本号的页面（请先补齐以下资源引用）：");
    for (const item of missingByFile) {
      console.error(`- ${item.file}: 缺少 ${item.missing.join(", ")}`);
    }
    process.exit(1);
  }

  // 如果启用了 content/meta.json，则以 meta 为 SSOT 并重新生成 data.js
  if (hasContentMeta && !isDryRun) {
    const r = buildData({ workspaceRoot: WORKSPACE_ROOT });
    if (!r.ok) {
      console.error("❌ bump-version：build-data 失败：");
      r.errors.forEach((e) => console.error(`- ${e}`));
      process.exit(1);
    }
    touched += 1;
  }

  const mode = isDryRun ? "DRY RUN" : "写入完成";
  const extra = hasContentMeta ? (isDryRun ? " (would regenerate data.js)" : " + regenerated data.js") : "";
  console.log(`✅ bump-version ${mode}: ${current} -> ${target}${extra}（更新文件数=${touched}）`);
};

main();
