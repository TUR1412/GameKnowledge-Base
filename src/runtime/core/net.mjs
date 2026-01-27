export const NET_CONSTANTS = {
  requestTimeoutMs: 6500,
  retryMax: 1,
  retryBaseDelayMs: 240,
  retryMaxDelayMs: 1200,
  memoryCacheTtlMs: 90 * 1000,
  prefetchHoverDelayMs: 80,
  prefetchMax: 24,
};

/**
 * @template T
 * @param {T} initialState
 */
export const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  const setState = (updater, meta = {}) => {
    const next =
      typeof updater === "function"
        ? updater(state)
        : { ...(state && typeof state === "object" ? state : {}), ...(updater || {}) };
    if (next === state) return state;
    state = next;
    listeners.forEach((fn) => {
      try {
        fn(state, meta);
      } catch (_) {}
    });
    return state;
  };

  const subscribe = (fn) => {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { getState, setState, subscribe };
};

export const readConnectionInfo = (navigatorLike = globalThis.navigator) => {
  const empty = { effectiveType: "", rtt: 0, downlink: 0, saveData: false };
  try {
    const c =
      navigatorLike?.connection ||
      navigatorLike?.mozConnection ||
      navigatorLike?.webkitConnection;
    if (!c) return empty;
    return {
      effectiveType: String(c.effectiveType || ""),
      rtt: Number(c.rtt || 0) || 0,
      downlink: Number(c.downlink || 0) || 0,
      saveData: Boolean(c.saveData),
    };
  } catch (_) {
    return empty;
  }
};

export const normalizeSameOriginUrl = (
  value,
  { baseHref = globalThis.location?.href, origin = globalThis.location?.origin } = {}
) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return null;

  try {
    const u = new URL(raw, String(baseHref || ""));
    if (origin && u.origin !== origin) return null;
    return u.href;
  } catch (_) {
    return null;
  }
};

export const withTimeout = async (
  promiseFactory,
  timeoutMs,
  {
    AbortController: AbortControllerImpl = globalThis.AbortController,
    setTimeout: setTimeoutFn = globalThis.setTimeout,
    clearTimeout: clearTimeoutFn = globalThis.clearTimeout,
  } = {}
) => {
  const ms = Math.max(0, Number(timeoutMs || 0) || 0);
  if (!ms) return promiseFactory({ signal: null });

  let controller = null;
  try {
    controller = typeof AbortControllerImpl === "function" ? new AbortControllerImpl() : null;
  } catch (_) {
    controller = null;
  }

  const signal = controller?.signal || null;
  let id = 0;
  const timeout = new Promise((_, reject) => {
    id = setTimeoutFn(() => {
      try {
        controller?.abort?.();
      } catch (_) {}
      reject(new Error("timeout"));
    }, ms);
  });

  try {
    return await Promise.race([promiseFactory({ signal }), timeout]);
  } finally {
    if (id) clearTimeoutFn(id);
  }
};

export const sleep = (ms, { setTimeout: setTimeoutFn = globalThis.setTimeout } = {}) =>
  new Promise((resolve) => setTimeoutFn(resolve, Math.max(0, Number(ms || 0) || 0)));

export const jitter = (baseMs, maxMs, { random = Math.random } = {}) => {
  const base = Math.max(0, Number(baseMs || 0) || 0);
  const max = Math.max(base, Number(maxMs || 0) || base);
  const span = Math.max(0, max - base);
  return base + Math.round(Number(random?.() || 0) * span);
};

export const createMemoryCache = ({ now = () => Date.now() } = {}) => {
  const map = new Map();
  const get = (key) => {
    const k = String(key || "");
    if (!k) return null;
    const hit = map.get(k);
    if (!hit) return null;
    if (now() > hit.expiresAt) {
      map.delete(k);
      return null;
    }
    return hit.value;
  };
  const set = (key, value, ttlMs) => {
    const k = String(key || "");
    if (!k) return false;
    const ttl = Math.max(0, Number(ttlMs || 0) || 0);
    map.set(k, { value, expiresAt: now() + ttl });
    return true;
  };
  return { get, set };
};

export const createRequestClient = ({
  store,
  constants = NET_CONSTANTS,
  fetch: fetchFn = globalThis.fetch,
  baseHref = globalThis.location?.href,
  origin = globalThis.location?.origin,
  now = () => Date.now(),
  random = Math.random,
  AbortController: AbortControllerImpl = globalThis.AbortController,
  setTimeout: setTimeoutFn = globalThis.setTimeout,
  clearTimeout: clearTimeoutFn = globalThis.clearTimeout,
} = {}) => {
  const inflight = new Map();
  const cache = createMemoryCache({ now });

  const bumpInflight = (delta) => {
    if (!store) return;
    store.setState((s) => ({
      ...s,
      requestsInFlight: Math.max(0, Number(s.requestsInFlight || 0) + Number(delta || 0)),
    }));
  };

  const onError = () => {
    if (!store) return;
    store.setState((s) => ({ ...s, lastErrorAt: now() }));
  };

  const fetchTextOnce = async (href, { timeoutMs } = {}) =>
    withTimeout(
      async ({ signal }) => {
        const res = await fetchFn(href, {
          method: "GET",
          credentials: "same-origin",
          cache: "force-cache",
          signal,
        });
        if (!res || !res.ok) throw new Error(`http ${res?.status || 0}`);
        return await res.text();
      },
      timeoutMs,
      { AbortController: AbortControllerImpl, setTimeout: setTimeoutFn, clearTimeout: clearTimeoutFn }
    );

  const requestText = async (
    url,
    { timeoutMs = constants.requestTimeoutMs, retry = true } = {}
  ) => {
    const href = normalizeSameOriginUrl(url, { baseHref, origin });
    if (!href) throw new Error("blocked url");

    const key = `text:${href}`;
    const cached = cache.get(key);
    if (typeof cached === "string") {
      // 背景刷新：避免高延迟网络下重复卡顿
      if (!inflight.has(key)) {
        inflight.set(
          key,
          (async () => {
            try {
              const fresh = await fetchTextOnce(href, { timeoutMs });
              cache.set(key, fresh, constants.memoryCacheTtlMs);
            } catch (_) {
              // ignore
            } finally {
              inflight.delete(key);
            }
          })()
        );
      }
      return cached;
    }

    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
      bumpInflight(1);
      try {
        const runOnce = async () => fetchTextOnce(href, { timeoutMs });

        try {
          const text = await runOnce();
          cache.set(key, text, constants.memoryCacheTtlMs);
          return text;
        } catch (err) {
          if (!retry) throw err;
          const retries = Math.max(0, Number(constants.retryMax || 0) || 0);
          for (let i = 0; i < retries; i += 1) {
            await sleep(jitter(constants.retryBaseDelayMs, constants.retryMaxDelayMs, { random }), {
              setTimeout: setTimeoutFn,
            });
            try {
              const text = await runOnce();
              cache.set(key, text, constants.memoryCacheTtlMs);
              return text;
            } catch (_) {
              // continue
            }
          }
          throw err;
        }
      } catch (err) {
        onError();
        throw err;
      } finally {
        bumpInflight(-1);
        inflight.delete(key);
      }
    })();

    inflight.set(key, task);
    return task;
  };

  const prefetch = async (url) => {
    const href = normalizeSameOriginUrl(url, { baseHref, origin });
    if (!href) return false;
    try {
      // 预取只为“热缓存”（SW / HTTP cache），无需读取 body
      await withTimeout(
        async ({ signal }) => {
          const res = await fetchFn(href, {
            method: "GET",
            credentials: "same-origin",
            cache: "force-cache",
            signal,
          });
          void res;
          return true;
        },
        Math.min(2500, constants.requestTimeoutMs),
        { AbortController: AbortControllerImpl, setTimeout: setTimeoutFn, clearTimeout: clearTimeoutFn }
      );
      return true;
    } catch (_) {
      return false;
    }
  };

  return { requestText, prefetch };
};
