import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryCache,
  createRequestClient,
  createStore,
  jitter,
  normalizeSameOriginUrl,
  readConnectionInfo,
  withTimeout,
} from "../src/runtime/core/net.mjs";

const defer = () => {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test("defer：reject 分支应可被捕获", async () => {
  const d = defer();
  d.reject(new Error("boom"));
  await assert.rejects(d.promise, /boom/);
});

test("normalizeSameOriginUrl：同源/跨域/特殊前缀", () => {
  const baseHref = "https://example.com/a/b";
  const origin = "https://example.com";

  assert.equal(normalizeSameOriginUrl("", { baseHref, origin }), null);
  assert.equal(normalizeSameOriginUrl("//evil.com/x", { baseHref, origin }), null);
  assert.equal(normalizeSameOriginUrl("https://evil.com/x", { baseHref, origin }), null);
  assert.equal(normalizeSameOriginUrl("/x", { baseHref, origin }), "https://example.com/x");
  assert.equal(
    normalizeSameOriginUrl("https://example.com/ok", { baseHref, origin }),
    "https://example.com/ok"
  );

  // raw/base 无法构造 URL：应走 catch 分支
  assert.equal(normalizeSameOriginUrl("http://", { baseHref, origin }), null);

  // origin 为空：应允许任意 origin（用于某些无 location 场景）
  assert.equal(
    normalizeSameOriginUrl("https://evil.com/x", { baseHref, origin: "" }),
    "https://evil.com/x"
  );
});

test("readConnectionInfo：缺失/存在/抛错分支", () => {
  const empty = readConnectionInfo(null);
  assert.deepEqual(empty, { effectiveType: "", rtt: 0, downlink: 0, saveData: false });

  const nav = {
    connection: { effectiveType: "4g", rtt: 50, downlink: 10, saveData: true },
  };
  assert.deepEqual(readConnectionInfo(nav), {
    effectiveType: "4g",
    rtt: 50,
    downlink: 10,
    saveData: true,
  });

  const throwing = {
    get connection() {
      throw new Error("boom");
    },
  };
  assert.deepEqual(readConnectionInfo(throwing), empty);

  // mozConnection 分支
  assert.deepEqual(
    readConnectionInfo({ mozConnection: { effectiveType: "3g", rtt: 10, downlink: 1.2, saveData: false } }),
    { effectiveType: "3g", rtt: 10, downlink: 1.2, saveData: false }
  );
});

test("createStore：setState 合并/函数、subscribe/unsubscribe", () => {
  const store = createStore({ a: 1, b: 2 });
  assert.deepEqual(store.getState(), { a: 1, b: 2 });

  const seen = [];
  const unsub = store.subscribe((s, meta) => seen.push({ s, meta }));

  store.setState({ b: 3 }, { why: "merge" });
  store.setState((s) => ({ ...s, c: 4 }), { why: "fn" });
  unsub();
  store.setState({ d: 5 }, { why: "ignored" });

  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].s, { a: 1, b: 3 });
  assert.deepEqual(seen[0].meta, { why: "merge" });
  assert.deepEqual(seen[1].s, { a: 1, b: 3, c: 4 });

  // subscribe 非函数：应返回 noop
  assert.doesNotThrow(() => store.subscribe(null)());
});

test("createRequestClient：并发去重 + 缓存命中背景刷新 + inflight 保护", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";

  const refreshText = defer();

  const calls = [];
  const fetch = async (href) => {
    calls.push(href);
    if (calls.length === 1) {
      return { ok: true, status: 200, text: async () => "v1" };
    }
    if (calls.length === 2) {
      return { ok: true, status: 200, text: async () => await refreshText.promise };
    }
    throw new Error("unexpected fetch call");
  };

  const store = createStore({ requestsInFlight: 0, lastErrorAt: 0 });
  const client = createRequestClient({
    store,
    fetch,
    baseHref,
    origin,
    now: () => 123,
    constants: {
      requestTimeoutMs: 0,
      retryMax: 0,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 999999,
    },
  });

  // 并发去重：同一 url 同时调用只发一次 fetch
  const p1 = client.requestText("/x.html");
  const p2 = client.requestText("/x.html");
  assert.equal(calls.length, 1);

  assert.equal(await p1, "v1");
  assert.equal(await p2, "v1");
  assert.equal(store.getState().requestsInFlight, 0);

  // 缓存命中：应返回 v1，但会启动背景刷新（第 2 次 fetch），且不会新增第 3 次 fetch
  const p3 = client.requestText("/x.html");
  assert.equal(await p3, "v1");
  assert.equal(calls.length, 2);

  const p4 = client.requestText("/x.html");
  assert.equal(await p4, "v1");
  assert.equal(calls.length, 2);

  // 完成刷新后应更新缓存为 v2
  refreshText.resolve("v2");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await client.requestText("/x.html"), "v2");

  // 触发 fetch stub 的 throw 分支（提升测试文件覆盖率）
  await assert.rejects(() => client.requestText("/y.html"), /unexpected fetch call/);
  assert.equal(store.getState().lastErrorAt, 123);
});

test("createRequestClient：blocked url / error path 应写 lastErrorAt", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";
  const store = createStore({ requestsInFlight: 0, lastErrorAt: 0 });

  const client = createRequestClient({
    store,
    baseHref,
    origin,
    now: () => 999,
    fetch: async () => ({ ok: false, status: 500 }),
    constants: {
      requestTimeoutMs: 0,
      retryMax: 0,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 1,
    },
  });

  await assert.rejects(() => client.requestText("https://evil.com/x"), /blocked url/);
  await assert.rejects(() => client.requestText("/boom"), /http 500/);
  await assert.rejects(() => client.requestText("/boom", { retry: false }), /http 500/);
  assert.equal(store.getState().lastErrorAt, 999);
  assert.equal(store.getState().requestsInFlight, 0);
});

test("createRequestClient：retry=1 时应在第二次成功", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";
  const store = createStore({ requestsInFlight: 0, lastErrorAt: 0 });

  let n = 0;
  const client = createRequestClient({
    store,
    baseHref,
    origin,
    now: () => 1,
    fetch: async () => {
      n += 1;
      if (n === 1) return { ok: false, status: 503 };
      return { ok: true, status: 200, text: async () => "ok" };
    },
    constants: {
      requestTimeoutMs: 0,
      retryMax: 1,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 1,
    },
  });

  assert.equal(await client.requestText("/retry"), "ok");
  assert.equal(n, 2);
  assert.equal(store.getState().lastErrorAt, 0);
});

test("createRequestClient：retry loop 的 continue 分支（失败后继续重试）", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";
  const store = createStore({ requestsInFlight: 0, lastErrorAt: 0 });

  let n = 0;
  const client = createRequestClient({
    store,
    baseHref,
    origin,
    now: () => 1,
    random: () => 0,
    fetch: async () => {
      n += 1;
      if (n <= 2) return { ok: false, status: 503 };
      return { ok: true, status: 200, text: async () => "ok" };
    },
    constants: {
      requestTimeoutMs: 0,
      retryMax: 2,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 1,
    },
  });

  assert.equal(await client.requestText("/retry2"), "ok");
  assert.equal(n, 3);
  assert.equal(store.getState().lastErrorAt, 0);
});

test("createRequestClient：prefetch 成功/blocked/异常分支", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";
  let n = 0;
  const client = createRequestClient({
    fetch: async () => {
      n += 1;
      return { ok: true, status: 200 };
    },
    baseHref,
    origin,
    constants: { requestTimeoutMs: 0 },
  });

  assert.equal(await client.prefetch("/p"), true);
  assert.equal(n, 1);
  assert.equal(await client.prefetch("https://evil.com/p"), false);
  assert.equal(await client.prefetch("mailto:x@example.com"), false);

  const client2 = createRequestClient({
    fetch: async () => {
      throw new Error("boom");
    },
    baseHref,
    origin,
    constants: { requestTimeoutMs: 0 },
  });
  assert.equal(await client2.prefetch("/p"), false);
});

test("createRequestClient：cached 分支应启动背景刷新（覆盖 net.mjs 205-222）", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";

  let seenTextCalls = 0;
  const values = ["v1", "v2", "v3"];

  const fetch = async () => {
    const value = values.shift() || "v?";
    return {
      ok: true,
      status: 200,
      text: async () => {
        seenTextCalls += 1;
        return value;
      },
    };
  };

  const client = createRequestClient({
    fetch,
    baseHref,
    origin,
    now: () => 1,
    constants: {
      requestTimeoutMs: 0,
      retryMax: 0,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 999999,
    },
  });

  assert.equal(await client.requestText("/a"), "v1");
  assert.equal(seenTextCalls, 1);

  // 第二次命中缓存，应该返回 v1，同时后台刷新会拿到 v2（异步）
  assert.equal(await client.requestText("/a"), "v1");

  // 等待后台刷新完成（seenTextCalls 将变为 2）
  for (let i = 0; i < 50 && seenTextCalls < 2; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.equal(seenTextCalls >= 2, true);
  await new Promise((r) => setTimeout(r, 0));

  // 刷新完成后，再次读取应返回 v2（缓存已更新）
  assert.equal(await client.requestText("/a"), "v2");
});

test("createRequestClient：背景刷新失败应被忽略（覆盖 net.mjs cached catch 分支）", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";

  let n = 0;
  const fetch = async () => {
    n += 1;
    if (n === 1) return { ok: true, status: 200, text: async () => "v1" };
    return { ok: false, status: 500 };
  };

  const client = createRequestClient({
    fetch,
    baseHref,
    origin,
    now: () => 1,
    constants: {
      requestTimeoutMs: 0,
      retryMax: 0,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 999999,
    },
  });

  assert.equal(await client.requestText("/b"), "v1");
  assert.equal(await client.requestText("/b"), "v1");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await client.requestText("/b"), "v1");
});

test("createMemoryCache：miss/hit/expired + set 空 key", () => {
  let t = 0;
  const now = () => t;
  const cache = createMemoryCache({ now });
  assert.equal(cache.get("x"), null);
  assert.equal(cache.get(""), null);
  assert.equal(cache.set("", "v", 10), false);
  assert.equal(cache.set("x", "v", 5), true);
  assert.equal(cache.get("x"), "v");
  t = 10;
  assert.equal(cache.get("x"), null);
});

test("withTimeout：timeout=0 直接执行；timeout>0 超时应 reject 并 abort", async () => {
  const ok = await withTimeout(async () => 1, 0);
  assert.equal(ok, 1);

  // AbortController 不是函数：应降级为 signal=null
  assert.equal(
    await withTimeout(async ({ signal }) => (signal ? 2 : 1), 10, { AbortController: null }),
    1
  );

  class BadAC {
    constructor() {
      throw new Error("boom");
    }
  }
  assert.equal(
    await withTimeout(async ({ signal }) => (signal ? 2 : 1), 10, { AbortController: BadAC }),
    1
  );

  const state = { aborted: false };
  class AC {
    constructor() {
      this.signal = {};
    }
    abort() {
      state.aborted = true;
      throw new Error("abort-failed");
    }
  }

  await assert.rejects(
    () => withTimeout(() => new Promise(() => {}), 10, { AbortController: AC }),
    /timeout/
  );
  assert.equal(state.aborted, true);
});

test("net：jitter random 为空应回退到 base", () => {
  assert.equal(jitter(100, 200, { random: null }), 100);
});

test("createRequestClient：store 缺失分支不应影响 requestText/prefetch", async () => {
  const baseHref = "https://example.com/";
  const origin = "https://example.com";

  const calls = [];
  const fetch = async (href, opts) => {
    calls.push({ href, opts });
    return { ok: true, status: 200, text: async () => "ok" };
  };

  const client = createRequestClient({
    fetch,
    baseHref,
    origin,
    constants: {
      requestTimeoutMs: 50,
      retryMax: 0,
      retryBaseDelayMs: 0,
      retryMaxDelayMs: 0,
      memoryCacheTtlMs: 999999,
    },
  });

  assert.equal(await client.requestText("/nostore"), "ok");
  assert.equal(await client.prefetch("/nostore"), true);
  assert.ok(typeof calls[0].opts?.signal === "object" || calls[0].opts?.signal === null);
});
