import { safeJsonParse } from "./storage.mjs";

export const createLogger = ({
  storage,
  storageKeys,
  getPage,
  now = () => Date.now(),
  console: consoleLike = globalThis.console,
  maxLogs = 180,
  maxStr = 260,
  maxMetaKeys = 12,
  maxMetaStr = 120,
} = {}) => {
  const logsKey = storageKeys?.diagnosticsLogs;

  const truncate = (value, maxLen) => {
    const s = String(value ?? "");
    const m = Math.max(0, Number(maxLen || 0) || 0);
    if (m === 0) return "";
    if (s.length <= m) return s;
    return `${s.slice(0, Math.max(0, m - 1))}…`;
  };

  const safeToString = (value) => {
    if (value instanceof Error) {
      const name = String(value.name || "Error");
      const msg = String(value.message || "");
      return msg ? `${name}: ${msg}` : name;
    }
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  };

  const sanitizeMeta = (meta) => {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
    const out = {};
    const entries = Object.entries(meta).slice(0, maxMetaKeys);
    entries.forEach(([k, v]) => {
      const key = truncate(String(k || "").trim(), 48);
      if (!key) return;
      if (typeof v === "string") out[key] = truncate(v, maxMetaStr);
      else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
      else if (typeof v === "boolean") out[key] = v;
    });
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const read = () => {
    const raw = storage.get(logsKey);
    const list = safeJsonParse(raw, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((x) => x && typeof x === "object" && !Array.isArray(x))
      .slice(Math.max(0, list.length - maxLogs));
  };

  const write = (events) => {
    const list = Array.isArray(events) ? events : [];
    const trimmed = list.slice(Math.max(0, list.length - maxLogs));
    return storage.set(logsKey, JSON.stringify(trimmed));
  };

  const persistLevel = (level) => level === "info" || level === "warn" || level === "error";

  const log = (level, message, meta) => {
    const lvl = String(level || "").trim().toLowerCase();
    const okLevel = lvl === "debug" || lvl === "info" || lvl === "warn" || lvl === "error";
    const l = okLevel ? lvl : "info";

    const msg = truncate(safeToString(message).trim(), maxStr);
    if (!msg) return false;

    // 控制台输出（不影响主流程）
    try {
      const fn =
        l === "error"
          ? consoleLike?.error
          : l === "warn"
            ? consoleLike?.warn
            : l === "debug"
              ? consoleLike?.debug
              : consoleLike?.log;
      fn?.call?.(consoleLike, `[GKB] ${msg}`);
    } catch (_) {}

    if (!persistLevel(l)) return true;

    const entry = {
      ts: now(),
      level: l,
      page: truncate(getPage?.() || "", 32),
      message: msg,
    };

    const m = sanitizeMeta(meta);
    if (m) entry.meta = m;

    try {
      const list = read();
      list.push(entry);
      write(list);
    } catch (_) {
      // ignore
    }

    return true;
  };

  const clear = () => storage.remove(logsKey);

  const getSummary = () => {
    const logs = read();
    const last = logs.length > 0 ? logs[logs.length - 1] : null;
    return {
      logCount: logs.length,
      lastLogAt: Number(last?.ts || 0) || 0,
    };
  };

  return {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    log,
    read,
    clear,
    getSummary,
  };
};

