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

const requireCacheBusting = (fileName, content) => {
  const required = [
    { label: "styles", regex: /href="styles\.css\?v=[^"]+"/ },
    { label: "data", regex: /src="data\.js\?v=[^"]+"/ },
    { label: "scripts", regex: /src="scripts\.js\?v=[^"]+"/ },
  ];

  for (const item of required) {
    if (!item.regex.test(content)) {
      errors.push(`[CACHE] ${fileName}: 缺少 ${item.label} 的 ?v= 版本号（缓存穿透）`);
    }
  }
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

for (const html of htmlFiles) {
  const content = readText(path.join(WORKSPACE_ROOT, html));
  requireCacheBusting(html, content);
  checkLocalHtmlLinks(html, content);
  checkImages(html, content);
}

if (errors.length > 0) {
  console.error("❌ 站点检查未通过：");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`✅ 站点检查通过：扫描 HTML=${htmlFiles.length}（断链/资源/缓存穿透）`);
