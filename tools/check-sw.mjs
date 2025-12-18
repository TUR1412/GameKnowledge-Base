import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const listRootHtml = () =>
  fs
    .readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const extractPrecacheBody = (swContent) => {
  const m = String(swContent || "").match(/const\s+PRECACHE_URLS\s*=\s*\[\s*([\s\S]*?)\s*\];/);
  return m ? m[1] : "";
};

const parseDoubleQuotedStrings = (s) => {
  const items = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let m;
  while ((m = re.exec(String(s || "")))) {
    // 数组里以纯字符串为主；若未来出现转义，这里仍尽量正确解析
    try {
      items.push(JSON.parse(`"${m[1]}"`));
    } catch (_) {
      items.push(m[1]);
    }
  }
  return items;
};

const parseTemplateStrings = (s) => {
  const items = [];
  const re = /`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(String(s || "")))) {
    items.push(m[1]);
  }
  return items;
};

const errors = [];

const main = () => {
  const swPath = path.join(WORKSPACE_ROOT, "sw.js");
  if (!fs.existsSync(swPath)) {
    console.error("❌ SW 检查未通过：缺少 sw.js");
    process.exit(1);
  }

  const sw = readText(swPath);
  const precacheBody = extractPrecacheBody(sw);
  if (!precacheBody) {
    console.error("❌ SW 检查未通过：未找到 PRECACHE_URLS 数组（const PRECACHE_URLS = [...]）");
    process.exit(1);
  }

  const literalItems = parseDoubleQuotedStrings(precacheBody);
  const templateItems = parseTemplateStrings(precacheBody);

  const literalSet = new Set(literalItems);
  const templateSet = new Set(templateItems);

  // 1) 版本机制基线（避免缓存不更新）
  if (!sw.includes('searchParams.get("v")')) {
    errors.push('[SW] VERSION 未从 sw.js?v=... 读取（缺少 searchParams.get("v")）');
  }
  if (!sw.includes("gkb-cache-${VERSION}")) {
    errors.push("[SW] CACHE_NAME 未绑定版本号（缺少 gkb-cache-${VERSION}）");
  }

  // 2) HTML 预缓存覆盖：离线可打开任意入口页
  const rootHtml = listRootHtml();
  rootHtml.forEach((file) => {
    if (!literalSet.has(file)) {
      errors.push(`[SW] PRECACHE_URLS 缺少 HTML：${file}`);
    }
  });

  // 3) 关键资源必须带 ?v=VERSION（避免“缓存幽灵”）
  const requiredTemplates = [
    "styles.css?v=${VERSION}",
    "data.js?v=${VERSION}",
    "scripts.js?v=${VERSION}",
    "boot.js?v=${VERSION}",
    "manifest.webmanifest?v=${VERSION}",
  ];
  requiredTemplates.forEach((t) => {
    if (!templateSet.has(t)) {
      errors.push(`[SW] PRECACHE_URLS 缺少版本化资源：\`${t}\``);
    }
  });

  // 4) 禁止预缓存外链（离线/可移植性）
  [...literalItems, ...templateItems].forEach((item) => {
    const s = String(item || "");
    if (/^https?:\/\//i.test(s)) {
      errors.push(`[SW] PRECACHE_URLS 存在外链资源（禁止）：${s}`);
    }
  });

  // 5) 禁止预缓存不带版本的 JS/CSS/manifest
  literalItems.forEach((item) => {
    const s = String(item || "");
    const lower = s.toLowerCase();
    if (lower.endsWith(".js") || lower.endsWith(".css") || lower.endsWith(".webmanifest")) {
      errors.push(`[SW] PRECACHE_URLS 存在未版本化的静态资源（应改为 ?v=VERSION）：${s}`);
    }
  });

  if (errors.length > 0) {
    console.error("❌ SW 检查未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log(
    `✅ SW 检查通过：html=${rootHtml.length}, precache(literal)=${literalItems.length}, precache(template)=${templateItems.length}`
  );
};

main();

