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
const CACHE_NAME = `gkb-cache-${VERSION}`;

const PRECACHE_URLS = [
  "index.html",
  "dashboard.html",
  "discover.html",
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

  `styles.css?v=${VERSION}`,
  `data.js?v=${VERSION}`,
  `scripts.js?v=${VERSION}`,
  `vendor/motion.js?v=${VERSION}`,
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

const safePut = async (cache, request, response) => {
  try {
    if (!response || !response.ok) return;
    await cache.put(request, response);
  } catch (_) {}
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
          .filter((k) => k.startsWith("gkb-cache-") && k !== CACHE_NAME)
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
        try {
          const fresh = await fetch(request);
          await safePut(cache, request, fresh.clone());
          return fresh;
        } catch (_) {
          // 对 data-page 类型的动态渲染页（game.html?id=... / guide-detail.html?id=... 等）
          // 离线时应优先回退到同路径的模板页，因此对导航请求允许忽略 search 匹配。
          const cached = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
          if (cached) return cached;
          return (await cache.match("offline.html")) || Response.error();
        }
      }

      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const fresh = await fetch(request);
        await safePut(cache, request, fresh.clone());
        return fresh;
      } catch (_) {
        return Response.error();
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event?.data;
  if (!data || typeof data !== "object") return;
  if (data.type !== "GKB_PRECACHE") return;

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
      }

      try {
        client?.postMessage?.({ type: "GKB_PRECACHE_DONE", requestId, ok, fail, total: urls.length });
      } catch (_) {}
    })()
  );
});
