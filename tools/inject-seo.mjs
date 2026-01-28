import fs from "node:fs";
import path from "node:path";

import { baseFromSitemapUrl, buildUrl, listRootHtml, parseSitemapUrlFromRobots, readText, writeText } from "./lib/site.mjs";

const WORKSPACE_ROOT = process.cwd();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { dryRun: false, check: false, base: "" };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--check") out.check = true;
    else if (a === "--base") out.base = args[i + 1] || "";
  }
  return out;
};

const escapeAttr = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const inferBase = () => {
  const robotsPath = path.join(WORKSPACE_ROOT, "robots.txt");
  if (!fs.existsSync(robotsPath)) return "";
  const sitemapUrl = parseSitemapUrlFromRobots(readText(robotsPath));
  return baseFromSitemapUrl(sitemapUrl);
};

const extractTitle = (html) => {
  const m = String(html || "").match(/<title>([^<]+)<\/title>/i);
  return m ? String(m[1] || "").trim() : "";
};

const extractDescription = (html) => {
  const m = String(html || "").match(/<meta\s+name="description"\s+content="([^"]*)"\s*>/i);
  return m ? String(m[1] || "").trim() : "";
};

const hasSeo = (html) => /property\s*=\s*"og:title"/i.test(String(html || ""));
const hasJsonLd = (html) => /type\s*=\s*"application\/ld\+json"/i.test(String(html || ""));

const buildSeoBlock = ({ title, description, url, image }) => {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(url);
  const img = escapeAttr(image);

  return (
    `    <!-- SEO: Open Graph / Twitter -->\n` +
    `    <meta property="og:title" content="${t}">\n` +
    `    <meta property="og:description" content="${d}">\n` +
    `    <meta property="og:type" content="website">\n` +
    `    <meta property="og:site_name" content="游戏攻略网">\n` +
    `    <meta property="og:locale" content="zh_CN">\n` +
    `    <meta property="og:url" content="${u}">\n` +
    `    <meta property="og:image" content="${img}">\n` +
    `    <meta name="twitter:card" content="summary_large_image">\n` +
    `    <meta name="twitter:title" content="${t}">\n` +
    `    <meta name="twitter:description" content="${d}">\n` +
    `    <meta name="twitter:image" content="${img}">\n`
  );
};

const buildJsonLdBlock = ({ base, pageUrl, title, description }) => {
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}#website`,
        name: "游戏攻略网",
        url: base,
        inLanguage: "zh-CN",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "zh-CN",
        isPartOf: { "@id": `${base}#website` },
      },
    ],
  };

  return `    <script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n")}\n    </script>\n`;
};

const injectIntoHtml = ({ fileName, html, base }) => {
  const title = extractTitle(html);
  const description = extractDescription(html);
  if (!title || !description) {
    return { ok: false, next: html, error: `[SEO] ${fileName}: 缺少 title 或 meta description，无法注入` };
  }

  const pageUrl = buildUrl(base, fileName);
  const ogImage = buildUrl(base, "images/demos/demo-view-transition.svg");

  const seo = hasSeo(html) ? "" : buildSeoBlock({ title, description, url: pageUrl, image: ogImage });
  const jsonld = hasJsonLd(html) ? "" : buildJsonLdBlock({ base, pageUrl, title, description });

  if (!seo && !jsonld) return { ok: true, next: html, changed: false };

  const marker = /(\n\s*<meta\s+name="description"\s+content="[^"]*"\s*>\s*)/i;
  const m = String(html).match(marker);
  if (!m) {
    return { ok: false, next: html, error: `[SEO] ${fileName}: 未找到 meta description 注入点` };
  }

  const next = String(html).replace(marker, `$1${seo}${jsonld}`);
  return { ok: true, next, changed: next !== html };
};

const main = () => {
  const { dryRun, check, base } = parseArgs();
  const inferred = inferBase() || "https://tur1412.github.io/GameKnowledge-Base/";
  const finalBase = (base || inferred).trim();
  if (!finalBase.startsWith("http://") && !finalBase.startsWith("https://")) {
    console.error("❌ --base 必须是以 http(s):// 开头的绝对地址");
    process.exit(1);
  }

  const htmlFiles = listRootHtml({ workspaceRoot: WORKSPACE_ROOT });
  const errors = [];
  let changed = 0;

  for (const file of htmlFiles) {
    const filePath = path.join(WORKSPACE_ROOT, file);
    const raw = readText(filePath);
    const r = injectIntoHtml({ fileName: file, html: raw, base: finalBase.endsWith("/") ? finalBase : `${finalBase}/` });
    if (!r.ok) {
      errors.push(r.error || `[SEO] ${file}: failed`);
      continue;
    }

    if (check) {
      if (!hasSeo(r.next) || !hasJsonLd(r.next)) errors.push(`[SEO] ${file}: 缺少 OG 或 JSON-LD`);
      continue;
    }

    if (r.changed) {
      changed += 1;
      if (!dryRun) writeText(filePath, r.next);
    }
  }

  if (errors.length > 0) {
    console.error("❌ inject-seo 未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  if (check) {
    console.log(`✅ inject-seo CHECK: ok（html=${htmlFiles.length}）`);
    return;
  }

  const mode = dryRun ? "DRY RUN" : "写入完成";
  console.log(`✅ inject-seo ${mode}: updated=${changed}/${htmlFiles.length}`);
};

main();

