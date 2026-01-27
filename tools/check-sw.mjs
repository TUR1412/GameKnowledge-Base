import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const toNumberOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

// 约定：kB 使用十进制（1000 bytes），与 Vite 构建输出一致。
// 为了避免浮点精度导致的 23.075 → 23.07，按 0.01kB = 10 bytes 做整数四舍五入。
const formatKb = (bytes) => {
  const kbTimes100 = Math.round(Number(bytes || 0) / 10);
  return (kbTimes100 / 100).toFixed(2);
};

export const listRootHtml = (workspaceRoot) =>
  fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

export const extractPrecacheBody = (swContent) => {
  const m = String(swContent || "").match(/const\s+PRECACHE_URLS\s*=\s*\[\s*([\s\S]*?)\s*\];/);
  return m ? m[1] : "";
};

export const parseDoubleQuotedStrings = (s) => {
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

export const parseTemplateStrings = (s) => {
  const items = [];
  const re = /`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(String(s || "")))) {
    items.push(m[1]);
  }
  return items;
};

const normalizePrecachePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return "";
  const noQuery = raw.split(/[?#]/, 1)[0];
  return String(noQuery || "").replace(/^[./\\]+/, "");
};

export const validateServiceWorker = ({ workspaceRoot, precacheBudgetKb } = {}) => {
  const readText = (filePath) => fs.readFileSync(filePath, "utf8");
  const errors = [];

  const swPath = path.join(workspaceRoot, "sw.js");
  if (!fs.existsSync(swPath)) {
    return { ok: false, errors: ["缺少 sw.js"], counts: null };
  }

  const sw = readText(swPath);
  const precacheBody = extractPrecacheBody(sw);
  if (!precacheBody) {
    return {
      ok: false,
      errors: ["未找到 PRECACHE_URLS 数组（const PRECACHE_URLS = [...]）"],
      counts: null,
    };
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
  const rootHtml = listRootHtml(workspaceRoot);
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

  // 6) 预缓存资源必须存在，且体积要可预算（避免“离线壳”无限膨胀）
  const allItems = [...literalItems, ...templateItems];
  const uniquePaths = new Set(allItems.map(normalizePrecachePath).filter(Boolean));
  let precacheTotalBytes = 0;

  uniquePaths.forEach((rel) => {
    const filePath = path.join(workspaceRoot, rel);
    if (!fs.existsSync(filePath)) {
      errors.push(`[SW] PRECACHE_URLS 引用不存在资源：${rel}`);
      return;
    }
    const st = fs.statSync(filePath);
    if (!st.isFile()) {
      errors.push(`[SW] PRECACHE_URLS 引用的资源不是文件：${rel}`);
      return;
    }
    precacheTotalBytes += st.size;
  });

  const budgetKb =
    toNumberOrNull(precacheBudgetKb) ?? toNumberOrNull(process.env.GKB_BUDGET_SW_PRECACHE_KB) ?? 1200;
  const budgetBytes = Math.round(budgetKb * 1000);
  if (precacheTotalBytes > budgetBytes) {
    errors.push(
      `[SW] PRECACHE_URLS 预缓存体积超过预算：${formatKb(precacheTotalBytes)}kB > ${budgetKb.toFixed(2)}kB`
    );
  }

  if (errors.length > 0) return { ok: false, errors, counts: null };
  return {
    ok: true,
    errors: [],
    counts: {
      html: rootHtml.length,
      precacheLiteral: literalItems.length,
      precacheTemplate: templateItems.length,
      precacheFiles: uniquePaths.size,
      precacheTotalBytes,
      precacheBudgetKb: budgetKb,
    },
  };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const result = validateServiceWorker({ workspaceRoot });
  if (!result.ok) {
    stderr("❌ SW 检查未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout(
    `✅ SW 检查通过：html=${result.counts.html}, precache(literal)=${result.counts.precacheLiteral}, precache(template)=${result.counts.precacheTemplate}, precache(files)=${result.counts.precacheFiles}, precache(size)=${formatKb(result.counts.precacheTotalBytes)}kB <= ${result.counts.precacheBudgetKb.toFixed(2)}kB`
  );
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
