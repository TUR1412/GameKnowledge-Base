/* 游戏攻略网 - Search Worker（CmdK 全站搜索）
 *
 * 目标：
 * - 将“搜索评分/排序”从主线程移到 Worker，避免数据规模增长后输入卡顿
 * - 仅做同源、纯静态、无依赖实现，兼容严格 CSP（worker-src 'self'）
 *
 * 协议：
 * - 主线程发送：
 *   - { type: "GKB_SEARCH_INIT", version, pool: { games:[{id,blob}], guides:[...], topics:[...] } }
 *   - { type: "GKB_SEARCH_QUERY", requestId, query, limits?: { games, guides, topics } }
 * - Worker 返回：
 *   - { type: "GKB_SEARCH_READY", version }
 *   - { type: "GKB_SEARCH_RESULT", requestId, games:[id], guides:[id], topics:[id] }
 */

const DEFAULT_LIMITS = { games: 6, guides: 6, topics: 6 };

/** @type {{ version: string, pool: { games: any[], guides: any[], topics: any[] } }} */
let state = { version: "", pool: { games: [], guides: [], topics: [] } };

const clampLimit = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(50, Math.floor(n)));
};

const normalizeQuery = (q) => String(q || "").trim().toLowerCase();

const fuzzyScore = (text, q) => {
  const hay = String(text || "").toLowerCase();
  const needle = String(q || "").toLowerCase().trim();
  if (!needle) return 0;
  if (!hay) return null;

  // 直接子串：最高优先
  const direct = hay.indexOf(needle);
  if (direct >= 0) {
    return 1200 + needle.length * 12 - direct;
  }

  // 顺序匹配：允许跳跃，连续命中加权
  let h = 0;
  let score = 0;
  let streak = 0;
  for (const ch of needle) {
    const idx = hay.indexOf(ch, h);
    if (idx < 0) return null;
    streak = idx === h ? streak + 1 : 1;
    score += 3 + streak * 2;
    h = idx + 1;
  }
  return score;
};

const pickTopIds = (items, query, limit) => {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const q = normalizeQuery(query);
  const scored = [];

  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const id = String(it.id || "").trim();
    const blob = String(it.blob || "");
    if (!id || !blob) continue;
    const score = fuzzyScore(blob, q);
    if (score == null) continue;
    scored.push({ id, score });
  }

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scored.slice(0, limit).map((x) => x.id);
};

self.addEventListener("message", (event) => {
  const data = event?.data;
  if (!data || typeof data !== "object") return;

  const type = String(data.type || "");

  if (type === "GKB_SEARCH_INIT") {
    const version = String(data.version || "").trim();
    const pool = data.pool && typeof data.pool === "object" ? data.pool : null;
    const games = Array.isArray(pool?.games) ? pool.games : [];
    const guides = Array.isArray(pool?.guides) ? pool.guides : [];
    const topics = Array.isArray(pool?.topics) ? pool.topics : [];

    state = { version, pool: { games, guides, topics } };
    try {
      self.postMessage({ type: "GKB_SEARCH_READY", version: state.version });
    } catch (_) {}
    return;
  }

  if (type === "GKB_SEARCH_QUERY") {
    const requestId = Number(data.requestId || 0) || 0;
    const query = String(data.query || "");
    const limits = data.limits && typeof data.limits === "object" ? data.limits : null;

    const gamesLimit = clampLimit(limits?.games, DEFAULT_LIMITS.games);
    const guidesLimit = clampLimit(limits?.guides, DEFAULT_LIMITS.guides);
    const topicsLimit = clampLimit(limits?.topics, DEFAULT_LIMITS.topics);

    const pool = state.pool || { games: [], guides: [], topics: [] };

    const result = {
      type: "GKB_SEARCH_RESULT",
      requestId,
      games: pickTopIds(pool.games, query, gamesLimit),
      guides: pickTopIds(pool.guides, query, guidesLimit),
      topics: pickTopIds(pool.topics, query, topicsLimit),
    };

    try {
      self.postMessage(result);
    } catch (_) {}
  }
});

