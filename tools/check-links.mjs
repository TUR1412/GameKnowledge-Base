import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const exists = (relativePath) => fs.existsSync(path.join(WORKSPACE_ROOT, relativePath));

const stripQueryAndHash = (value) => String(value || "").split(/[?#]/, 1)[0];

const normalizeRelative = (value) => {
  const raw = stripQueryAndHash(value).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "";
  if (raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";
  if (raw.startsWith("#")) return "";
  return raw.replace(/^[./\\]+/, "");
};

const listRootHtmlFiles = () =>
  fs
    .readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const htmlFiles = listRootHtmlFiles();
const htmlSet = new Set(htmlFiles);

const errors = [];

const extractVersion = (content, re) => {
  const m = content.match(re);
  return m ? String(m[1] || "").trim() : "";
};

const requireCacheBusting = (fileName, content) => {
  const required = [
    { label: "styles", regex: /href="styles\.css\?v=([^"]+)"/ },
    { label: "manifest", regex: /href="manifest\.webmanifest\?v=([^"]+)"/ },
    { label: "boot", regex: /src="boot\.js\?v=([^"]+)"/ },
    { label: "data", regex: /src="data\.js\?v=([^"]+)"/ },
    { label: "scripts", regex: /src="scripts\.js\?v=([^"]+)"/ },
  ];

  const versions = {};
  for (const item of required) {
    const v = extractVersion(content, item.regex);
    versions[item.label] = v;
    if (!v) {
      errors.push(`[CACHE] ${fileName}: 缺少 ${item.label} 的 ?v= 版本号（缓存穿透）`);
    }
  }

  const present = Object.values(versions).filter(Boolean);
  const unique = new Set(present);
  if (unique.size > 1) {
    const detail = Object.entries(versions)
      .map(([k, v]) => `${k}=${v || "MISSING"}`)
      .join(", ");
    errors.push(`[CACHE] ${fileName}: 核心资源版本号不一致 -> ${detail}`);
  }

  return present[0] || "";
};

const checkLocalHtmlLinks = (fileName, content) => {
  const hrefRe = /href="([^"]+)"/g;
  for (const match of content.matchAll(hrefRe)) {
    const href = match[1];
    const rel = normalizeRelative(href);
    if (!rel) continue;
    if (!rel.toLowerCase().includes(".html")) continue;
    if (!rel.toLowerCase().endsWith(".html")) continue;
    if (!htmlSet.has(rel)) {
      errors.push(`[LINK] ${fileName}: 指向不存在页面 -> ${href}`);
    }
  }
};

const checkImages = (fileName, content) => {
  const refRe = /(?:src|href)="(images\/[^"]+)"/g;
  for (const match of content.matchAll(refRe)) {
    const ref = match[1];
    const rel = normalizeRelative(ref);
    if (!rel) continue;
    if (!exists(rel)) {
      errors.push(`[ASSET] ${fileName}: 引用不存在资源 -> ${ref}`);
    }
  }
};

let globalVersion = "";
for (const html of htmlFiles) {
  const content = readText(path.join(WORKSPACE_ROOT, html));
  const v = requireCacheBusting(html, content);
  if (!globalVersion && v) globalVersion = v;
  else if (globalVersion && v && v !== globalVersion) {
    errors.push(`[CACHE] ${html}: 版本号与全站不一致（期望 ${globalVersion}，实际 ${v}）`);
  }
  checkLocalHtmlLinks(html, content);
  checkImages(html, content);
}

// 全站版本一致性：HTML ?v= 必须与 data.js 的 data.version 对齐（避免人肉同步失误）
if (globalVersion) {
  const dataContent = readText(path.join(WORKSPACE_ROOT, "data.js"));
  const dataVersion = extractVersion(dataContent, /version:\s*"([^"]+)"/);
  if (!dataVersion) {
    errors.push(`[CACHE] data.js: 未找到 data.version（建议保留 version 字段用于发布与离线缓存）`);
  } else if (dataVersion !== globalVersion) {
    errors.push(
      `[CACHE] 版本不一致：HTML ?v=${globalVersion} 但 data.js version=${dataVersion}`
    );
  }
}

if (errors.length > 0) {
  console.error("❌ 站点检查未通过：");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`✅ 站点检查通过：扫描 HTML=${htmlFiles.length}（断链/资源/缓存穿透）`);
