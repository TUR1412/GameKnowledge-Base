import { safeJsonParse } from "./storage.mjs";

export const createDiagnostics = ({
  storage,
  storageKeys,
  getPage,
  getData,
  getUrl,
  getUserAgent,
  telemetry,
  logger,
  healthMonitor,
  now = () => Date.now(),
  toIso = (t) => new Date(t).toISOString(),
  maxErrors = 80,
  maxStr = 240,
  maxStack = 1600,
  maxMetaKeys = 12,
  maxMetaStr = 120,
} = {}) => {
  const errorsKey = storageKeys?.diagnosticsErrors;

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

  const readErrors = () => {
    const raw = storage.get(errorsKey);
    const list = safeJsonParse(raw, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((x) => x && typeof x === "object" && !Array.isArray(x))
      .slice(Math.max(0, list.length - maxErrors));
  };

  const writeErrors = (events) => {
    const list = Array.isArray(events) ? events : [];
    const trimmed = list.slice(Math.max(0, list.length - maxErrors));
    return storage.set(errorsKey, JSON.stringify(trimmed));
  };

  const captureError = (error, { kind = "error", source = "", meta } = {}) => {
    const message = truncate(safeToString(error).trim(), maxStr);
    if (!message) return false;

    const entry = {
      ts: now(),
      kind: truncate(kind, 32),
      page: truncate(getPage?.() || "", 32),
      source: truncate(source, 48),
      message,
    };

    try {
      const stack = error instanceof Error ? error.stack : "";
      const s = truncate(String(stack || "").trim(), maxStack);
      if (s) entry.stack = s;
    } catch (_) {}

    const m = sanitizeMeta(meta);
    if (m) entry.meta = m;

    try {
      const list = readErrors();
      list.push(entry);
      writeErrors(list);
    } catch (_) {
      // ignore
    }

    try {
      telemetry?.log?.("runtime_error", {
        kind: entry.kind,
        source: entry.source,
        msg: entry.message,
      });
    } catch (_) {
      // ignore
    }

    return true;
  };

  const clearErrors = () => storage.remove(errorsKey);

  const buildBundle = ({ includeTelemetry = true, includeHealth = true } = {}) => {
    const data = getData?.() || null;
    const version = String(data?.version || "");
    const exportedAt = toIso(now());
    const page = String(getPage?.() || "");

    const bundle = {
      schema: "gkb-diagnostics",
      version,
      exportedAt,
      page,
      url: String(getUrl?.() || ""),
      userAgent: String(getUserAgent?.() || ""),
      errors: readErrors(),
      logs: logger?.read?.()?.slice?.(-240) || [],
    };

    if (includeTelemetry) {
      try {
        bundle.telemetry = telemetry?.read?.()?.slice?.(-240) || [];
        bundle.telemetryEnabled = Boolean(telemetry?.isEnabled?.());
      } catch (_) {}
    }

    if (includeHealth) {
      try {
        bundle.health = healthMonitor?.snapshot?.({ log: false });
      } catch (_) {}
    }

    return bundle;
  };

  const getSummary = () => {
    const errors = readErrors();
    const last = errors.length > 0 ? errors[errors.length - 1] : null;
    return {
      errorCount: errors.length,
      lastErrorAt: Number(last?.ts || 0) || 0,
    };
  };

  return {
    captureError,
    readErrors,
    clearErrors,
    buildBundle,
    getSummary,
  };
};

