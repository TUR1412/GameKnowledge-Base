import test from "node:test";
import assert from "node:assert/strict";

import { qs, qsa } from "../src/runtime/core/dom.mjs";
import { on, once } from "../src/runtime/core/events.mjs";
import { createStorage } from "../src/runtime/core/storage.mjs";
import {
  applyChoice,
  getUiPref,
  isMotionReduced,
  normalizeChoice,
  readChoice,
  setUiPref,
  systemPrefersReducedMotion,
  UI_PREFS,
} from "../src/runtime/core/motion.mjs";

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

test("dom：qs/qsa 在异常或缺失方法时应降级", () => {
  const root = {
    querySelector: (sel) => (sel === "#a" ? { id: "a" } : null),
    querySelectorAll: (sel) => (sel === ".x" ? [{ id: 1 }, { id: 2 }] : []),
  };

  assert.deepEqual(qs("#a", root), { id: "a" });
  assert.deepEqual(qsa(".x", root).map((x) => x.id), [1, 2]);
  assert.equal(qs("#nope", root), null);
  assert.deepEqual(qsa(".nope", root), []);

  assert.equal(qs("#a", null), null);
  assert.deepEqual(qsa(".x", null), []);

  // querySelector/querySelectorAll 抛错：应走 catch 分支
  const throwing = {
    querySelector() {
      throw new Error("boom");
    },
    querySelectorAll() {
      throw new Error("boom");
    },
  };
  assert.equal(qs("#a", throwing), null);
  assert.deepEqual(qsa(".x", throwing), []);
});

test("events：on/once 应返回可取消函数", () => {
  const calls = [];
  const target = {
    addEventListener: (t, h, o) => calls.push(["add", t, h, o]),
    removeEventListener: (t, h, o) => calls.push(["rm", t, h, o]),
  };

  const handler = () => {};
  handler();
  const off = on(target, "click", handler, { passive: true });
  off();
  assert.equal(calls[0][0], "add");
  assert.equal(calls[1][0], "rm");

  const handler2 = () => {};
  handler2();
  const off2 = once(target, "keydown", handler2);
  off2();
  assert.equal(calls[2][0], "add");
  assert.equal(calls[3][0], "rm");

  // addEventListener 抛错：on 应降级为 noop
  const badTarget = {
    addEventListener() {
      throw new Error("boom");
    },
  };
  const h3 = () => {};
  h3();
  const off3 = on(badTarget, "click", h3);
  off3();

  // removeEventListener 抛错：off 调用不应再抛
  const badRemove = {
    addEventListener() {},
    removeEventListener() {
      throw new Error("boom");
    },
  };
  const h4 = () => {};
  h4();
  const off4 = on(badRemove, "click", h4);
  off4();
});

test("motion：优先 storage，其次 dataset；isMotionReduced 应跟随系统/显式 reduce", () => {
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);
  const documentElement = { dataset: {} };

  // dataset 提供默认值
  documentElement.dataset[UI_PREFS.motion.datasetKey] = "reduce";
  assert.equal(getUiPref("motion", { storage, documentElement }), "reduce");

  // storage 覆盖 dataset
  storage.set(UI_PREFS.motion.storageKey, "auto");
  assert.equal(getUiPref("motion", { storage, documentElement }), "auto");

  // setUiPref 应写入 storage + dataset
  setUiPref("motion", "reduce", { storage, documentElement });
  assert.equal(storage.get(UI_PREFS.motion.storageKey), "reduce");
  assert.equal(documentElement.dataset.motion, "reduce");

  // 覆盖 backend.removeItem（函数覆盖）
  storage.remove(UI_PREFS.motion.storageKey);
  assert.equal(storage.get(UI_PREFS.motion.storageKey), null);

  // isMotionReduced：reduce -> true
  assert.equal(isMotionReduced({ storage, documentElement, matchMedia: () => ({ matches: false }) }), true);

  // auto + 系统 reduce -> true
  setUiPref("motion", "auto", { storage, documentElement });
  assert.equal(isMotionReduced({ storage, documentElement, matchMedia: () => ({ matches: true }) }), true);

  // auto + 系统 no -> false
  assert.equal(isMotionReduced({ storage, documentElement, matchMedia: () => ({ matches: false }) }), false);

  // 未设置时回退 fallback + matchMedia 抛错分支
  const backend2 = createMemoryStorageBackend();
  const storage2 = createStorage(backend2);
  assert.equal(getUiPref("motion", { storage: storage2, documentElement: { dataset: {} } }), "auto");
  assert.equal(
    isMotionReduced({
      storage: storage2,
      documentElement: { dataset: {} },
      matchMedia: () => {
        throw new Error("boom");
      },
    }),
    false
  );
});

test("motion：normalizeChoice/readChoice/applyChoice 的边界分支", () => {
  assert.equal(normalizeChoice("", ["a"], "x"), "x");
  assert.equal(normalizeChoice("bad", ["a"], "x"), "x");
  assert.equal(normalizeChoice("a", ["a"], "x"), "a");

  assert.equal(readChoice(null), "");
  assert.equal(applyChoice(null, "x"), "");

  // applyChoice：dataset getter 抛错应被吞掉
  const backend = createMemoryStorageBackend();
  const storage = createStorage(backend);
  const throwingEl = {
    get dataset() {
      throw new Error("boom");
    },
  };
  assert.equal(applyChoice(UI_PREFS.motion, "reduce", { storage, documentElement: throwingEl, persist: true }), "reduce");

  // readChoice：dataset getter 抛错应走 catch 并回退 fallback
  const backend2 = createMemoryStorageBackend();
  const storage2 = createStorage(backend2);
  assert.equal(readChoice(UI_PREFS.motion, { storage: storage2, documentElement: throwingEl }), "auto");

  // systemPrefersReducedMotion：matchMedia 缺失/非函数应返回 false
  assert.equal(systemPrefersReducedMotion({ matchMedia: null }), false);
});
