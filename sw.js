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
          const cached = await cache.match(request);
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
