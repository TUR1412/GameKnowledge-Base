import test from "node:test";
import assert from "node:assert/strict";

import { STORAGE_KEYS, createStorage } from "../src/runtime/core/storage.mjs";
import { createLogger } from "../src/runtime/core/logger.mjs";
import { createDiagnostics } from "../src/runtime/core/diagnostics.mjs";

const createMemoryStorageBackend = () => {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
};

test("createLogger：debug 不持久化；info/warn/error 持久化并可清空", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const printed = [];
  const logger = createLogger({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => "home",
    now: () => 1,
    console: {
      log: (m) => printed.push(`log:${m}`),
      warn: (m) => printed.push(`warn:${m}`),
      error: (m) => printed.push(`error:${m}`),
      debug: (m) => printed.push(`debug:${m}`),
    },
    maxLogs: 2,
  });

  assert.equal(logger.debug("x"), true);
  assert.deepEqual(logger.read(), []);

  assert.equal(logger.info(" hi ", { a: "x", obj: { x: 1 }, bool: true }), true);
  assert.equal(logger.warn("w"), true);
  assert.equal(logger.error("e"), true);

  const logs = logger.read();
  assert.equal(logs.length, 2);
  assert.equal(logs[0].level, "warn");
  assert.equal(logs[1].level, "error");
  assert.equal(logs[1].page, "home");
  assert.equal(logger.getSummary().logCount, 2);

  assert.equal(logger.clear(), true);
  assert.deepEqual(logger.read(), []);
  assert.ok(printed.length > 0);
});

test("createDiagnostics：captureError/read/summary + buildBundle（含 telemetry/health）", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const events = [];
  const telemetry = {
    log: (name, meta) => events.push({ name, meta }),
    read: () => [{ ts: 1, name: "x" }],
    isEnabled: () => true,
  };

  const logger = createLogger({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => "dash",
    now: () => 2,
    console: { log() {} },
  });
  logger.info("a");

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => "dash",
    getData: () => ({ version: "9.9.9" }),
    getUrl: () => "https://example.com/dashboard",
    getUserAgent: () => "UA",
    telemetry,
    logger,
    healthMonitor: { snapshot: () => ({ ok: true }) },
    now: () => 3,
    toIso: () => "ISO",
    maxErrors: 2,
  });

  assert.equal(
    diagnostics.captureError(new Error("boom"), {
      kind: "handled",
      source: "t",
      meta: { a: "x", o: { x: 1 } },
    }),
    true
  );
  assert.equal(diagnostics.captureError("", { kind: "handled", source: "t" }), false);
  assert.equal(diagnostics.getSummary().errorCount, 1);
  assert.equal(diagnostics.getSummary().lastErrorAt, 3);

  const errs = diagnostics.readErrors();
  assert.equal(errs.length, 1);
  assert.equal(errs[0].page, "dash");
  assert.equal(errs[0].kind, "handled");
  assert.equal(errs[0].source, "t");
  assert.ok(String(errs[0].stack || "").length > 0);
  assert.deepEqual(events[0].name, "runtime_error");

  const bundle = diagnostics.buildBundle({ includeTelemetry: true, includeHealth: true });
  assert.equal(bundle.schema, "gkb-diagnostics");
  assert.equal(bundle.version, "9.9.9");
  assert.equal(bundle.exportedAt, "ISO");
  assert.equal(bundle.page, "dash");
  assert.equal(bundle.url, "https://example.com/dashboard");
  assert.equal(bundle.userAgent, "UA");
  assert.ok(Array.isArray(bundle.errors));
  assert.ok(Array.isArray(bundle.logs));
  assert.deepEqual(bundle.telemetryEnabled, true);
  assert.deepEqual(bundle.health, { ok: true });

  assert.equal(diagnostics.clearErrors(), true);
  assert.deepEqual(diagnostics.readErrors(), []);
});

test("createLogger：truncate / Error / circular / storage 抛错分支", () => {
  const backend1 = createMemoryStorageBackend();
  const storage1 = createStorage(backend1);

  const loggerTrim = createLogger({
    storage: storage1,
    storageKeys: STORAGE_KEYS,
    getPage: () => "p",
    now: () => 1,
    console: { log() {} },
    maxStr: 5,
    maxLogs: 10,
  });

  // truncate 分支
  loggerTrim.info("123456");
  assert.equal(loggerTrim.read()[0].message, "1234…");

  const backend2 = createMemoryStorageBackend();
  const storage2 = createStorage(backend2);
  const loggerFull = createLogger({
    storage: storage2,
    storageKeys: STORAGE_KEYS,
    getPage: () => "p",
    now: () => 1,
    console: { log() {} },
    maxLogs: 10,
  });

  // Error -> safeToString 分支
  loggerFull.error(new Error("boom"));
  assert.equal(loggerFull.read()[0].message, "Error: boom");

  // circular -> JSON.stringify catch 分支
  const circular = {};
  circular.self = circular;
  loggerFull.warn(circular);
  assert.equal(loggerFull.read()[1].message, "[object Object]");

  // storage.get/set 抛错 -> log 内部 try/catch 分支
  const bad = createLogger({
    storage: {
      get() {
        return "[]";
      },
      set() {
        throw new Error("boom");
      },
    },
    storageKeys: STORAGE_KEYS,
    getPage: () => "p",
    console: { log() {} },
  });
  assert.equal(bad.info("x"), true);
});

test("createDiagnostics：telemetry 抛错不应影响 captureError", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    telemetry: {
      log: () => {
        throw new Error("boom");
      },
    },
    now: () => 1,
  });

  assert.equal(diagnostics.captureError(new Error("x")), true);
});

test("createDiagnostics：truncate/safeToString/存储异常分支 + buildBundle flags", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    getData: () => ({ version: "1" }),
    getPage: () => "p",
    getUrl: () => "u",
    getUserAgent: () => "ua",
    now: () => 1,
    toIso: () => "ISO",
    maxStr: 5,
  });

  const circular = {};
  circular.self = circular;
  assert.equal(diagnostics.captureError(circular, { kind: "k", source: "s" }), true);
  assert.equal(diagnostics.readErrors()[0].message, "[obj…");

  const b1 = diagnostics.buildBundle({ includeTelemetry: false, includeHealth: false });
  assert.ok(!("telemetry" in b1));
  assert.ok(!("health" in b1));

  // storage.get 抛错 -> captureError 内部 try/catch 分支
  const bad = createDiagnostics({
    storage: {
      get() {
        return "[]";
      },
      set() {
        throw new Error("boom");
      },
    },
    storageKeys: STORAGE_KEYS,
    now: () => 1,
  });
  assert.equal(bad.captureError(new Error("x")), true);
});

test("createDiagnostics：safeToString/meta/readErrors/buildBundle 的分支覆盖", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    getData: () => ({ version: "1" }),
    getPage: () => "p",
    getUrl: () => "u",
    getUserAgent: () => "ua",
    telemetry: {
      log() {},
      read() {
        throw new Error("boom");
      },
      isEnabled() {
        throw new Error("boom");
      },
    },
    healthMonitor: {
      snapshot() {
        throw new Error("boom");
      },
    },
    now: () => 1,
    toIso: () => "ISO",
  });

  // safeToString: string 分支 + sanitizeMeta: meta invalid 分支
  assert.equal(diagnostics.captureError(" hi ", { meta: null }), true);

  // safeToString: JSON.stringify success 分支 + sanitizeMeta: 过滤后为空 -> undefined 分支
  assert.equal(diagnostics.captureError({ x: 1 }, { meta: { obj: { x: 1 } } }), true);

  // readErrors: 非数组 JSON -> []
  storage.set(STORAGE_KEYS.diagnosticsErrors, JSON.stringify({ bad: true }));
  assert.deepEqual(diagnostics.readErrors(), []);

  // buildBundle: includeTelemetry/includeHealth 的 try/catch 分支（throw 后不应写入字段）
  const bundle = diagnostics.buildBundle({ includeTelemetry: true, includeHealth: true });
  assert.ok(!("telemetry" in bundle));
  assert.ok(!("telemetryEnabled" in bundle));
  assert.ok(!("health" in bundle));
});

test("createDiagnostics：maxStr=0 时 captureError 应返回 false（truncate m===0 分支）", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    maxStr: 0,
    now: () => 1,
  });

  assert.equal(diagnostics.captureError("x"), false);
});

test("createLogger：level fallback / empty msg / meta/read 分支", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const logger = createLogger({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => "p",
    now: () => 1,
    console: {
      log() {
        throw new Error("boom");
      },
    },
    maxLogs: 10,
  });

  // level fallback（无效 level -> info）
  assert.equal(logger.log("NOPE", "x"), true);
  assert.equal(logger.read()[0].level, "info");

  // empty msg 分支
  assert.equal(logger.info("   "), false);

  // sanitizeMeta：meta invalid / 过滤后为空
  assert.equal(logger.info("m1", null), true);
  assert.equal(logger.info("m2", { onlyObj: { x: 1 } }), true);

  // read：非数组 JSON -> []
  storage.set(STORAGE_KEYS.diagnosticsLogs, JSON.stringify({ bad: true }));
  assert.deepEqual(logger.read(), []);

  // truncate：m===0 分支
  const zero = createLogger({
    storage,
    storageKeys: STORAGE_KEYS,
    console: { log() {} },
    maxStr: 0,
  });
  assert.equal(zero.info("x"), false);
});

test("createDiagnostics：Error name/message fallback + meta/filters 分支", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const diagnostics = createDiagnostics({
    storage,
    storageKeys: STORAGE_KEYS,
    now: () => 1,
  });

  const err = new Error("");
  // 覆盖 name/message 的 fallback 分支
  err.name = "";

  assert.equal(
    diagnostics.captureError(err, {
      kind: "",
      source: "",
      meta: { n: 1.5, ok: true, txt: "x", "": "ignored", arr: [1, 2] },
    }),
    true
  );

  // sanitizeMeta：meta 非对象/数组分支
  assert.equal(diagnostics.captureError("x", { meta: [] }), true);

  // readErrors：过滤非对象/数组 entries 分支
  storage.set(STORAGE_KEYS.diagnosticsErrors, JSON.stringify([null, [], { ts: 1, message: "ok" }]));
  const list = diagnostics.readErrors();
  assert.equal(list.length, 1);
  assert.equal(list[0].message, "ok");
});
