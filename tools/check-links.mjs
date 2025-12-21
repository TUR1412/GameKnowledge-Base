import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const stripQueryAndHash = (value) => String(value || "").split(/[?#]/, 1)[0];

export const normalizeRelative = (value) => {
  const raw = stripQueryAndHash(value).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "";
  if (raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";
  if (raw.startsWith("#")) return "";
  return raw.replace(/^[./\\]+/, "");
};

export const listRootHtmlFiles = (workspaceRoot) =>
  fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

export const extractVersion = (content, re) => {
  const m = String(content || "").match(re);
  return m ? String(m[1] || "").trim() : "";
};

export const scanSite = ({ workspaceRoot }) => {
  const readText = (filePath) => fs.readFileSync(filePath, "utf8");
  const existsRel = (relativePath) => fs.existsSync(path.join(workspaceRoot, relativePath));

  const htmlFiles = listRootHtmlFiles(workspaceRoot);
  const htmlSet = new Set(htmlFiles);
  const errors = [];

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
      if (!existsRel(rel)) {
        errors.push(`[ASSET] ${fileName}: 引用不存在资源 -> ${ref}`);
      }
    }
  };

  // 资源稳定交付：禁止引入外链“可执行/可渲染”资源（脚本/样式/图片等）
  // 说明：普通 <a href="https://..."> 外链跳转不在此范围内
  const checkExternalAssets = (fileName, content) => {
    const patterns = [
      { kind: "script", re: /<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi },
      { kind: "style", re: /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="(https?:\/\/[^"]+)"/gi },
      { kind: "style", re: /<link\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*\brel="stylesheet"/gi },
      { kind: "image", re: /<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi },
      { kind: "media", re: /<source\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi },
      { kind: "media", re: /<source\b[^>]*\bsrcset="(https?:\/\/[^"\s]+)[^"]*"/gi },
      { kind: "media", re: /<video\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi },
      { kind: "media", re: /<audio\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi },
    ];

    for (const p of patterns) {
      for (const m of content.matchAll(p.re)) {
        const url = m[1] || "";
        errors.push(`[EXT] ${fileName}: 禁止外链资源（${p.kind}）-> ${url}`);
      }
    }
  };

  let globalVersion = "";
  for (const html of htmlFiles) {
    const content = readText(path.join(workspaceRoot, html));
    const v = requireCacheBusting(html, content);
    if (!globalVersion && v) globalVersion = v;
    else if (globalVersion && v && v !== globalVersion) {
      errors.push(`[CACHE] ${html}: 版本号与全站不一致（期望 ${globalVersion}，实际 ${v}）`);
    }
    checkLocalHtmlLinks(html, content);
    checkImages(html, content);
    checkExternalAssets(html, content);
  }

  // 全站版本一致性：HTML ?v= 必须与 data.js 的 data.version 对齐（避免人肉同步失误）
  if (globalVersion) {
    const dataContent = readText(path.join(workspaceRoot, "data.js"));
    const dataVersion = extractVersion(dataContent, /version:\s*"([^"]+)"/);
    if (!dataVersion) {
      errors.push(`[CACHE] data.js: 未找到 data.version（建议保留 version 字段用于发布与离线缓存）`);
    } else if (dataVersion !== globalVersion) {
      errors.push(`[CACHE] 版本不一致：HTML ?v=${globalVersion} 但 data.js version=${dataVersion}`);
    }
  }

  return { errors, htmlFiles, globalVersion };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const { errors, htmlFiles } = scanSite({ workspaceRoot });

  if (errors.length > 0) {
    stderr("❌ 站点检查未通过：");
    errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  stdout(`✅ 站点检查通过：扫描 HTML=${htmlFiles.length}（断链/资源/缓存穿透）`);
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
