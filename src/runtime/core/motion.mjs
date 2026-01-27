import { STORAGE_KEYS } from "./storage.mjs";

export const UI_PREFS = {
  motion: {
    storageKey: STORAGE_KEYS.motion,
    datasetKey: "motion",
    allowed: ["auto", "reduce"],
    fallback: "auto",
  },
  transparency: {
    storageKey: STORAGE_KEYS.transparency,
    datasetKey: "transparency",
    allowed: ["auto", "reduce"],
    fallback: "auto",
  },
  particles: {
    storageKey: STORAGE_KEYS.particles,
    datasetKey: "particles",
    allowed: ["on", "off"],
    fallback: "on",
  },
};

export const normalizeChoice = (value, allowed, fallback) => {
  const v = String(value ?? "").trim();
  if (!v) return fallback;
  const list = Array.isArray(allowed) ? allowed : [];
  return list.includes(v) ? v : fallback;
};

export const readChoice = (pref, { storage, documentElement } = {}) => {
  if (!pref) return "";

  // 1) localStorage（用户显式设置）
  const stored = storage?.get?.(pref.storageKey);
  if (stored != null) return normalizeChoice(stored, pref.allowed, pref.fallback);

  // 2) dataset（boot.js 首帧注入）
  try {
    const ds = documentElement?.dataset?.[pref.datasetKey];
    if (ds != null) return normalizeChoice(ds, pref.allowed, pref.fallback);
  } catch (_) {}

  return pref.fallback;
};

export const applyChoice = (pref, value, { storage, documentElement, persist = false } = {}) => {
  if (!pref) return "";
  const next = normalizeChoice(value, pref.allowed, pref.fallback);

  try {
    if (documentElement?.dataset) documentElement.dataset[pref.datasetKey] = next;
  } catch (_) {}

  if (persist) storage?.set?.(pref.storageKey, next);
  return next;
};

export const getUiPref = (name, deps) => readChoice(UI_PREFS[name], deps);

export const setUiPref = (name, value, deps) =>
  applyChoice(UI_PREFS[name], value, { ...(deps || {}), persist: true });

export const systemPrefersReducedMotion = ({ matchMedia = globalThis.matchMedia } = {}) => {
  try {
    return Boolean(matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch (_) {
    return false;
  }
};

export const isMotionReduced = ({ storage, documentElement, matchMedia } = {}) => {
  const pref = getUiPref("motion", { storage, documentElement });
  if (pref === "reduce") return true;
  return systemPrefersReducedMotion({ matchMedia });
};

