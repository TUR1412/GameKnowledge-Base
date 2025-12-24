import path from "node:path";

import { buildUrl, escapeXml, listRootHtml, loadDataFromDataJs, normalizeBase, writeText } from "./lib/site.mjs";

const WORKSPACE_ROOT = process.cwd();

const pad2 = (n) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { base: "", dryRun: false };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--base") out.base = args[i + 1] || "";
  }

  return out;
};

const main = () => {
  const { base, dryRun } = parseArgs();
  const inferredBase = "https://tur1412.github.io/GameKnowledge-Base/";
  const finalBase = normalizeBase(base || inferredBase);

  if (!finalBase.startsWith("http://") && !finalBase.startsWith("https://")) {
    console.error("❌ --base 必须是以 http(s):// 开头的绝对地址（例如 GitHub Pages 或自定义域名）");
    process.exit(1);
  }

  const data = loadDataFromDataJs({ workspaceRoot: WORKSPACE_ROOT });
  if (!data) {
    console.error("❌ 无法从 data.js 读取站点数据");
    process.exit(1);
  }

  const html = listRootHtml({ workspaceRoot: WORKSPACE_ROOT })
    .filter((f) => f !== "404.html")
    .filter((f) => f !== "offline.html");

  const lastmod = todayIso();
  const urls = [];

  // 静态入口页面
  for (const file of html) {
    urls.push({ loc: buildUrl(finalBase, file), lastmod });
  }

  // 数据驱动页面（通过 query 参数承载）
  const games = Object.keys(data.games || {});
  const guides = Object.keys(data.guides || {});
  const topics = Object.keys(data.topics || {});

  games.forEach((id) => {
    urls.push({
      loc: buildUrl(finalBase, `game.html?id=${encodeURIComponent(id)}`),
      lastmod,
    });
  });
  guides.forEach((id) => {
    urls.push({
      loc: buildUrl(finalBase, `guide-detail.html?id=${encodeURIComponent(id)}`),
      lastmod,
    });
  });
  topics.forEach((id) => {
    urls.push({
      loc: buildUrl(finalBase, `forum-topic.html?id=${encodeURIComponent(id)}`),
      lastmod,
    });
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => {
        return (
          `  <url>\n` +
          `    <loc>${escapeXml(u.loc)}</loc>\n` +
          `    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n` +
          `  </url>`
        );
      })
      .join("\n") +
    `\n</urlset>\n`;

  const sitemapPath = path.join(WORKSPACE_ROOT, "sitemap.xml");
  const robotsPath = path.join(WORKSPACE_ROOT, "robots.txt");

  const robots =
    `User-agent: *\n` +
    `Allow: /\n` +
    `\n` +
    `Sitemap: ${buildUrl(finalBase, "sitemap.xml")}\n`;

  if (!dryRun) {
    writeText(sitemapPath, xml);
    writeText(robotsPath, robots);
  }

  const mode = dryRun ? "DRY RUN" : "写入完成";
  console.log(`✅ generate-sitemap ${mode}: url=${urls.length}, base=${finalBase}`);
};

main();
