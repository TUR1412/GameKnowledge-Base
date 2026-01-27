import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEYS,
  createStorage,
  readStringList,
  safeJsonParse,
  writeStringList,
} from "../src/runtime/core/storage.mjs";
import { createTelemetry, sanitizeTelemetryMeta } from "../src/runtime/core/telemetry.mjs";

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
    _dump() {
      return Object.fromEntries(map.entries());
    },
  };
};

test("safeJsonParse：成功与失败分支", () => {
  assert.deepEqual(safeJsonParse("[1,2]", []), [1, 2]);
  assert.deepEqual(safeJsonParse("{", { ok: true }), { ok: true });
});

test("createStorage：get/set/remove 正常与异常分支", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);
  assert.equal(storage.get("k"), null);
  assert.equal(storage.set("k", "v"), true);
  assert.equal(storage.get("k"), "v");
  assert.deepEqual(backend._dump(), { k: "v" });
  assert.equal(storage.remove("k"), true);
  assert.equal(storage.get("k"), null);

  const throwing = {
    getItem() {
      throw new Error("boom");
    },
    setItem() {
      throw new Error("boom");
    },
    removeItem() {
      throw new Error("boom");
    },
  };
  const bad = createStorage(throwing);
  assert.equal(bad.get("k"), null);
  assert.equal(bad.set("k", "v"), false);
  assert.equal(bad.remove("k"), false);
});

test("readStringList / writeStringList：应去重、trim、过滤空值", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  // 非数组 JSON：读应返回空数组
  storage.set("list", JSON.stringify({ x: 1 }));
  assert.deepEqual(readStringList(storage, "list"), []);

  const next = writeStringList(storage, "list", ["  a ", "", "b", "a", null, undefined, " b "]);
  assert.deepEqual(next, ["a", "b"]);

  const stored = storage.get("list");
  assert.equal(stored, JSON.stringify(["a", "b"]));
  assert.deepEqual(readStringList(storage, "list"), ["a", "b"]);
});

test("sanitizeTelemetryMeta：应过滤非法 meta，并截断 key/value", () => {
  assert.equal(sanitizeTelemetryMeta(null), undefined);
  assert.equal(sanitizeTelemetryMeta([]), undefined);

  const m = sanitizeTelemetryMeta(
    {
      "  ok  ": "x".repeat(200),
      num: 1.5,
      nan: NaN,
      bool: true,
      arr: [1, 2, 3],
      obj: { nested: true },
      fn: () => {},
      "": "x",
    },
    { maxStr: 5, maxKey: 3 }
  );

  assert.deepEqual(m, {
    ok: "xxxxx",
    num: 1.5,
    boo: true,
    arr: 3,
  });

  // 全部被过滤后应返回 undefined
  assert.equal(sanitizeTelemetryMeta({ a: { x: 1 } }), undefined);
});

test("createTelemetry：默认启用、写入/读取/清空、裁剪 maxEvents", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  const telemetry = createTelemetry({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => "home",
    now: () => 123,
    maxEvents: 2,
  });

  assert.equal(telemetry.isEnabled(), true);

  assert.equal(telemetry.log("a", { x: "1" }), true);
  assert.equal(telemetry.log("b", { y: true }), true);
  assert.equal(telemetry.log("c", { z: [1, 2] }), true);

  const list = telemetry.read();
  assert.equal(list.length, 2);
  assert.equal(list[0].name, "b");
  assert.equal(list[1].name, "c");
  assert.equal(list[1].page, "home");
  assert.deepEqual(list[1].meta, { z: 2 });
  assert.equal(list[1].ts, 123);

  assert.equal(telemetry.clear(), true);
  assert.deepEqual(telemetry.read(), []);
});

test("createTelemetry：禁用后 log 应返回 false", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);
  storage.set(STORAGE_KEYS.telemetryEnabled, "0");

  const telemetry = createTelemetry({ storage, storageKeys: STORAGE_KEYS, now: () => 1 });
  assert.equal(telemetry.isEnabled(), false);
  assert.equal(telemetry.log("x", { a: 1 }), false);

  telemetry.setEnabled(true);
  assert.equal(telemetry.isEnabled(), true);
  assert.equal(telemetry.log("x", { a: 1 }), true);
});

test("createTelemetry：健壮性分支（bad JSON / 非法 entries / getPage 抛错）", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);

  // bad JSON -> read() 返回 []
  storage.set(STORAGE_KEYS.telemetryEvents, "{");
  const telemetry = createTelemetry({
    storage,
    storageKeys: STORAGE_KEYS,
    getPage: () => {
      throw new Error("boom");
    },
    now: () => 9,
  });

  assert.deepEqual(telemetry.read(), []);

  // 写入混合 entries -> read() 只保留对象且排除数组
  storage.set(
    STORAGE_KEYS.telemetryEvents,
    JSON.stringify([null, [], "x", { ts: 1, name: "ok" }, { any: true }, ["bad"]])
  );
  const mixed = telemetry.read();
  assert.deepEqual(
    mixed.map((x) => x.name || ""),
    ["ok", ""]
  );

  // getPage 抛错不影响写入
  assert.equal(telemetry.log(" hello ", { nested: { x: 1 } }), true);
  const after = telemetry.read();
  assert.equal(after[after.length - 1].name, "hello");
  assert.equal(after[after.length - 1].page, undefined);
  assert.equal(after[after.length - 1].meta, undefined);
});

test("createTelemetry：当 storage.get(eventsKey) 抛错时 log 应返回 false（覆盖 catch 分支）", () => {
  const storageKeys = { telemetryEnabled: "en", telemetryEvents: "ev" };
  const storage = {
    get(key) {
      if (key === "en") return "1";
      if (key === "ev") throw new Error("boom");
      return null;
    },
    set() {
      throw new Error("boom");
    },
    remove() {
      return true;
    },
  };

  const telemetry = createTelemetry({ storage, storageKeys, now: () => 1 });
  assert.equal(telemetry.log("x", { a: 1 }), false);
  assert.equal(storage.get("other"), null);
  assert.equal(telemetry.clear(), true);
  assert.throws(() => telemetry.setEnabled(true), /boom/);
});
