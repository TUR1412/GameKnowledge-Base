import fs from "node:fs";
import path from "node:path";

import {
  baseFromSitemapUrl,
  buildUrl,
  escapeXml,
  loadDataFromDataJs,
  normalizeBase,
  parseSitemapUrlFromRobots,
  readText,
  writeText,
} from "./lib/site.mjs";

const WORKSPACE_ROOT = process.cwd();

const inferBase = () => {
  const robotsPath = path.join(WORKSPACE_ROOT, "robots.txt");
  if (!fs.existsSync(robotsPath)) return "";
  const robots = readText(robotsPath);
  const sitemapUrl = parseSitemapUrlFromRobots(robots);
  return baseFromSitemapUrl(sitemapUrl);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { dryRun: false, check: false, base: "", limit: 50 };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--check") out.check = true;
    else if (a === "--base") out.base = args[i + 1] || "";
    else if (a === "--limit") out.limit = Number(args[i + 1] || 0) || out.limit;
  }

  out.limit = Math.max(1, Math.min(200, Math.floor(out.limit)));
  return out;
};

const toIsoDateTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00Z`;

  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 8) {
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00Z`;
  }

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
};

const dateKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 8) return Number(digits.slice(0, 8)) || 0;
  return 0;
};

const versionDateIso = (dataVersion) => {
  const raw = String(dataVersion || "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8) return "1970-01-01";
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "1970-01-01";
  return date;
};

const buildFeedXml = ({ base, data, limit }) => {
  const items = [];
  const fallbackIso = `${versionDateIso(data?.version)}T00:00:00Z`;

  const push = (kind, id, item, linkPath) => {
    const title = String(item?.title || id || "").trim() || String(id || "—");
    const updatedRaw = String(item?.updated || "").trim();
    const updatedIso = toIsoDateTime(updatedRaw) || fallbackIso;
    const summary =
      String(item?.summary || item?.description || item?.subtitle || "").trim() ||
      (kind === "games" ? "游戏条目更新" : kind === "guides" ? "攻略条目更新" : "话题条目更新");

    items.push({
      kind,
      id: String(id || ""),
      title,
      summary,
      updatedIso,
      updatedKey: dateKey(updatedRaw) || Number(updatedIso.slice(0, 10).replaceAll("-", "")) || 0,
      link: buildUrl(base, linkPath),
    });
  };

  Object.entries(data?.games || {}).forEach(([id, item]) => push("games", id, item, `game.html?id=${encodeURIComponent(id)}`));
  Object.entries(data?.guides || {}).forEach(([id, item]) =>
    push("guides", id, item, `guide-detail.html?id=${encodeURIComponent(id)}`)
  );
  Object.entries(data?.topics || {}).forEach(([id, item]) =>
    push("topics", id, item, `forum-topic.html?id=${encodeURIComponent(id)}`)
  );

  items.sort((a, b) => (b.updatedKey || 0) - (a.updatedKey || 0));
  const entries = items.slice(0, limit);

  const feedUpdated = entries[0]?.updatedIso || fallbackIso;
  const feedId = buildUrl(base, "feed.xml");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
    `  <title>${escapeXml("游戏攻略网 · 更新订阅")}</title>\n` +
    `  <subtitle>${escapeXml("GameKnowledge-Base：NEW / UPDATED 聚合订阅（本地数据驱动）")}</subtitle>\n` +
    `  <id>${escapeXml(feedId)}</id>\n` +
    `  <updated>${escapeXml(feedUpdated)}</updated>\n` +
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(feedId)}"/>\n` +
    `  <link rel="alternate" type="text/html" href="${escapeXml(buildUrl(base, "updates.html"))}"/>\n` +
    `  <generator>${escapeXml("tools/generate-feed.mjs")}</generator>\n` +
    entries
      .map((e) => {
        const badge = e.kind === "guides" ? "攻略" : e.kind === "topics" ? "话题" : "游戏";
        const title = `【${badge}】${e.title}`;
        return (
          `  <entry>\n` +
          `    <title>${escapeXml(title)}</title>\n` +
          `    <id>${escapeXml(e.link)}</id>\n` +
          `    <link rel="alternate" type="text/html" href="${escapeXml(e.link)}"/>\n` +
          `    <updated>${escapeXml(e.updatedIso)}</updated>\n` +
          `    <summary>${escapeXml(e.summary)}</summary>\n` +
          `  </entry>`
        );
      })
      .join("\n") +
    `\n</feed>\n`;

  return { xml, counts: { total: items.length, emitted: entries.length } };
};

const main = () => {
  const { dryRun, check, base, limit } = parseArgs();
  const inferredBase = inferBase() || "https://tur1412.github.io/GameKnowledge-Base/";
  const finalBase = normalizeBase(base || inferredBase);

  if (!finalBase.startsWith("http://") && !finalBase.startsWith("https://")) {
    console.error("❌ base 必须是以 http(s):// 开头的绝对地址（可通过 --base 指定）");
    process.exit(1);
  }

  const data = loadDataFromDataJs({ workspaceRoot: WORKSPACE_ROOT });
  if (!data) {
    console.error("❌ 无法从 data.js 读取站点数据");
    process.exit(1);
  }

  const { xml, counts } = buildFeedXml({ base: finalBase, data, limit });
  const feedPath = path.join(WORKSPACE_ROOT, "feed.xml");

  if (check) {
    if (!fs.existsSync(feedPath)) {
      console.error("❌ feed.xml 不存在：请先运行 node tools/generate-feed.mjs 生成");
      process.exit(1);
    }
    const existing = readText(feedPath);
    if (existing !== xml) {
      console.error("❌ feed.xml 与生成结果不一致：请运行 node tools/generate-feed.mjs 更新");
      process.exit(1);
    }
    console.log(`✅ generate-feed CHECK: ok（entries=${counts.emitted}, base=${finalBase}）`);
    return;
  }

  if (!dryRun) writeText(feedPath, xml);
  const mode = dryRun ? "DRY RUN" : "写入完成";
  console.log(`✅ generate-feed ${mode}: entries=${counts.emitted}/${counts.total}, base=${finalBase}`);
};

main();
