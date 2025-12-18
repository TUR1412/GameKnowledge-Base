import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const normalizeBase = (base) => {
  const raw = String(base || "").trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw : `${raw}/`;
};

const buildUrl = (base, pathAndQuery) => {
  const b = normalizeBase(base);
  const url = `${b}${String(pathAndQuery || "").replace(/^\//, "")}`;
  return url;
};

const parseSitemapUrlFromRobots = (robots) => {
  const m = String(robots || "").match(/^Sitemap:\s*(\S+)\s*$/im);
  return m ? m[1] : "";
};

const baseFromSitemapUrl = (sitemapUrl) => {
  try {
    const u = new URL(String(sitemapUrl || ""));
    if (!u.pathname.endsWith("sitemap.xml")) return "";
    const basePath = u.pathname.replace(/sitemap\.xml$/i, "");
    return normalizeBase(`${u.origin}${basePath}`);
  } catch (_) {
    return "";
  }
};

const parseSitemapLocs = (xml) => {
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = re.exec(String(xml || "")))) {
    locs.push(m[1].trim());
  }
  return locs;
};

const parseSitemapLastmods = (xml) => {
  const lastmods = [];
  const re = /<lastmod>([^<]+)<\/lastmod>/gi;
  let m;
  while ((m = re.exec(String(xml || "")))) {
    lastmods.push(m[1].trim());
  }
  return lastmods;
};

const isValidIsoDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
};

const listRootHtml = () =>
  fs
    .readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const loadDataFromDataJs = () => {
  const dataPath = path.join(WORKSPACE_ROOT, "data.js");
  if (!fs.existsSync(dataPath)) return null;

  const code = readText(dataPath);
  const context = { window: { GKB: {} } };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "data.js" });
  return context.window?.GKB?.data || null;
};

const errors = [];

const main = () => {
  const robotsPath = path.join(WORKSPACE_ROOT, "robots.txt");
  const sitemapPath = path.join(WORKSPACE_ROOT, "sitemap.xml");

  if (!fs.existsSync(robotsPath)) {
    errors.push("[SITEMAP] 缺少 robots.txt");
  }
  if (!fs.existsSync(sitemapPath)) {
    errors.push("[SITEMAP] 缺少 sitemap.xml");
  }
  if (errors.length > 0) {
    console.error("❌ Sitemap 检查未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  const robots = readText(robotsPath);
  const sitemapUrl = parseSitemapUrlFromRobots(robots);
  if (!sitemapUrl) {
    errors.push("[SITEMAP] robots.txt 未声明 Sitemap: ...");
  }

  const base = baseFromSitemapUrl(sitemapUrl);
  if (!base) {
    errors.push(`[SITEMAP] 无法从 robots.txt 的 Sitemap 推断 base（Sitemap=${sitemapUrl || "?"}）`);
  }

  const xml = readText(sitemapPath);
  const locs = parseSitemapLocs(xml);
  const lastmods = parseSitemapLastmods(xml);

  if (locs.length === 0) errors.push("[SITEMAP] sitemap.xml 未发现任何 <loc>");
  if (lastmods.length !== locs.length) {
    errors.push(`[SITEMAP] sitemap.xml <lastmod> 数量不一致（loc=${locs.length}, lastmod=${lastmods.length}）`);
  }

  for (const lm of lastmods) {
    if (!isValidIsoDate(lm)) {
      errors.push(`[SITEMAP] lastmod 不是合法的 YYYY-MM-DD：${lm}`);
    }
  }

  const counts = new Map();
  for (const loc of locs) {
    counts.set(loc, (counts.get(loc) || 0) + 1);
  }
  for (const [loc, c] of counts.entries()) {
    if (c > 1) errors.push(`[SITEMAP] loc 重复：${loc}（x${c}）`);
  }

  if (base) {
    for (const loc of locs) {
      try {
        // 必须是绝对 URL
        new URL(loc);
      } catch (_) {
        errors.push(`[SITEMAP] loc 不是合法的绝对 URL：${loc}`);
        continue;
      }
      if (!loc.startsWith(base)) {
        errors.push(`[SITEMAP] loc 不在统一 base 下（base=${base}）：${loc}`);
      }
    }
  }

  const data = loadDataFromDataJs();
  if (!data) errors.push("[SITEMAP] 无法从 data.js 读取站点数据");

  if (data && base) {
    const staticHtml = listRootHtml().filter((f) => f !== "404.html").filter((f) => f !== "offline.html");

    const games = Object.keys(data.games || {});
    const guides = Object.keys(data.guides || {});
    const topics = Object.keys(data.topics || {});

    const expected = [];
    for (const file of staticHtml) expected.push(buildUrl(base, file));
    games.forEach((id) => expected.push(buildUrl(base, `game.html?id=${encodeURIComponent(id)}`)));
    guides.forEach((id) => expected.push(buildUrl(base, `guide-detail.html?id=${encodeURIComponent(id)}`)));
    topics.forEach((id) => expected.push(buildUrl(base, `forum-topic.html?id=${encodeURIComponent(id)}`)));

    const expectedSet = new Set(expected);
    const actualSet = new Set(locs);

    const missing = expected.filter((u) => !actualSet.has(u));
    const extra = locs.filter((u) => !expectedSet.has(u));

    missing.forEach((u) => errors.push(`[SITEMAP] 缺少 URL：${u}`));
    extra.forEach((u) => errors.push(`[SITEMAP] 存在多余 URL（建议用 tools/generate-sitemap.mjs 重建）：${u}`));

    if (errors.length > 0) {
      console.error("❌ Sitemap 检查未通过：");
      errors.forEach((e) => console.error(`- ${e}`));
      process.exit(1);
    }

    console.log(
      `✅ Sitemap 检查通过：static=${staticHtml.length}, games=${games.length}, guides=${guides.length}, topics=${topics.length}, url=${locs.length}, base=${base}`
    );
    return;
  }

  if (errors.length > 0) {
    console.error("❌ Sitemap 检查未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log(`✅ Sitemap 检查通过：url=${locs.length}`);
};

main();

