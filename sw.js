/* 游戏攻略网 - Service Worker（离线缓存 & 秒开体验）
 *
 * 策略：
 * - HTML：网络优先，离线回退缓存 / offline.html
 * - 静态资源：缓存优先，缺失时拉取并写入缓存
 *
 * 注意：
 * - 版本号与页面资源的 ?v= 同步（见 data.js / docs/STYLE_GUIDE.md）
 */

const VERSION = (() => {
  try {
    return new URL(self.location.href).searchParams.get("v") || "dev";
  } catch (_) {
    return "dev";
  }
})();

const CACHE_PREFIX = "gkb-cache-";
const CACHE_NAME = `gkb-cache-${VERSION}`;

// 高延迟网络下的“丝滑体验”核心：缓存优先返回 + 后台刷新（SWR）
// - 导航：网络优先，但超时回退缓存（避免卡白屏）；同时后台尝试刷新
// - 资源：命中缓存立即返回；后台刷新以保持更新
const NAV_NETWORK_TIMEOUT_MS = 4500;
const NAV_PREFER_CACHE_AFTER_MS = 1200;
const ASSET_NETWORK_TIMEOUT_MS = 6000;

const PRECACHE_MESSAGE_TYPE = "GKB_PRECACHE";
const PRECACHE_PROGRESS_TYPE = "GKB_PRECACHE_PROGRESS";
const PRECACHE_DONE_TYPE = "GKB_PRECACHE_DONE";
const PRECACHE_PROGRESS_EVERY = 8;
const PRECACHE_PROGRESS_MIN_INTERVAL_MS = 1200;

const PRECACHE_URLS = [
  "index.html",
  "dashboard.html",
  "discover.html",
  "docs.html",
  "planner.html",
  "updates.html",
  "all-games.html",
  "all-guides.html",
  "game.html",
  "guide-detail.html",
  "forum-topic.html",
  "community.html",
  "action.html",
  "adventure.html",
  "rpg.html",
  "strategy.html",
  "simulation.html",
  "starlight-miracle.html",
  "404.html",
  "offline.html",
  "opensearch.xml",
  "feed.xml",
  `docs/STYLE_GUIDE.md?v=${VERSION}`,
  `docs/DATA_MODEL.md?v=${VERSION}`,
  `docs/CONTRIBUTING.md?v=${VERSION}`,
  `docs/SECURITY.md?v=${VERSION}`,
  `docs/CODE_OF_CONDUCT.md?v=${VERSION}`,
  `docs/DEPLOYMENT.md?v=${VERSION}`,

  `styles.css?v=${VERSION}`,
  `data.js?v=${VERSION}`,
  `scripts.js?v=${VERSION}`,
  `boot.js?v=${VERSION}`,
  `manifest.webmanifest?v=${VERSION}`,

  "images/icons/favicon.svg",
  "images/placeholders/cover-starlight.svg",
  "images/placeholders/screenshot-ui.svg",
  "images/placeholders/avatar-class.svg"
];

const isSameOrigin = (requestUrl) => {
  try {
    return new URL(requestUrl).origin === self.location.origin;
  } catch (_) {
    return false;
  }
};

const isNavigation = (request) => request.mode === "navigate";

const fetchWithTimeout = async (request, timeoutMs) => {
  const ms = Math.max(0, Number(timeoutMs || 0) || 0);
  if (ms === 0) return fetch(request);

  try {
    if (!("AbortController" in self)) return fetch(request);
  } catch (_) {
    return fetch(request);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const safePut = async (cache, request, response) => {
  try {
    if (!response || !response.ok) return;
    await cache.put(request, response);
  } catch (_) {}
};

const fetchAndCache = async ({ cache, request, timeoutMs }) => {
  const res = await fetchWithTimeout(request, timeoutMs);
  await safePut(cache, request, res.clone());
  return res;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (!isSameOrigin(request.url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (isNavigation(request)) {
        const cached =
          (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));

        if (cached) {
          const networkPromise = fetchAndCache({
            cache,
            request,
            timeoutMs: NAV_NETWORK_TIMEOUT_MS,
          }).catch(() => null);

          // 缓存秒回：如果网络在短窗口内没回来，就直接用缓存避免白屏；同时后台刷新
          const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve(null), NAV_PREFER_CACHE_AFTER_MS)
          );

          const maybeFresh = await Promise.race([networkPromise, timeoutPromise]);
          if (maybeFresh) return maybeFresh;
          event.waitUntil(networkPromise);
          return cached;
        }

        try {
          return await fetchAndCache({ cache, request, timeoutMs: NAV_NETWORK_TIMEOUT_MS });
        } catch (_) {
          return (await cache.match("offline.html")) || Response.error();
        }
      }

      try {
        // 资源走 SWR：命中缓存立即返回，后台刷新以提高高延迟网络下的“体感流畅”
        const cached = await cache.match(request);
        if (cached) {
          event.waitUntil(
            fetchAndCache({ cache, request, timeoutMs: ASSET_NETWORK_TIMEOUT_MS }).catch(() => null)
          );
          return cached;
        }

        return await fetchAndCache({ cache, request, timeoutMs: ASSET_NETWORK_TIMEOUT_MS });
      } catch (_) {
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        return Response.error();
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event?.data;
  if (!data || typeof data !== "object") return;
  if (data.type !== PRECACHE_MESSAGE_TYPE) return;

  const requestId = Number(data.requestId || 0) || 0;
  const rawUrls = Array.isArray(data.urls) ? data.urls : [];
  const client = event.source;

  const normalize = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw.startsWith("//")) return null;
    if (raw.includes("..")) return null;

    try {
      const u = new URL(raw, self.location.origin);
      if (u.origin !== self.location.origin) return null;
      return u.href;
    } catch (_) {
      return null;
    }
  };

  const urls = Array.from(new Set(rawUrls.map(normalize).filter(Boolean)));
  if (urls.length === 0) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let ok = 0;
      let fail = 0;
      let lastProgressAt = 0;

      for (const url of urls) {
        try {
          const req = new Request(url, { method: "GET" });
          const hit = await cache.match(req);
          if (hit) {
            ok += 1;
            continue;
          }
          const res = await fetch(req);
          if (!res || !res.ok) {
            fail += 1;
            continue;
          }
          await safePut(cache, req, res.clone());
          ok += 1;
        } catch (_) {
          fail += 1;
        }

        const done = ok + fail;
        const now = Date.now();
        const shouldReport =
          done === urls.length ||
          done % PRECACHE_PROGRESS_EVERY === 0 ||
          now - lastProgressAt >= PRECACHE_PROGRESS_MIN_INTERVAL_MS;
        if (shouldReport) {
          lastProgressAt = now;
          try {
            client?.postMessage?.({
              type: PRECACHE_PROGRESS_TYPE,
              requestId,
              ok,
              fail,
              total: urls.length,
              done,
            });
          } catch (_) {}
        }
      }

      try {
        client?.postMessage?.({ type: PRECACHE_DONE_TYPE, requestId, ok, fail, total: urls.length });
      } catch (_) {}
    })()
  );
});
