export const sanitizeTelemetryMeta = (meta, { maxStr = 96, maxKey = 48 } = {}) => {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const out = {};

  Object.entries(meta).forEach(([k, v]) => {
    const key = String(k || "")
      .trim()
      .slice(0, maxKey);
    if (!key) return;

    if (typeof v === "string") out[key] = v.slice(0, maxStr);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else if (Array.isArray(v)) out[key] = v.length;
  });

  return Object.keys(out).length > 0 ? out : undefined;
};

export const createTelemetry = ({
  storage,
  storageKeys,
  getPage,
  now = () => Date.now(),
  maxEvents = 420,
  maxStr = 96,
  maxKey = 48,
} = {}) => {
  const enabledKey = storageKeys?.telemetryEnabled;
  const eventsKey = storageKeys?.telemetryEvents;

  const isEnabled = () => storage.get(enabledKey) !== "0";

  const read = () => {
    const raw = storage.get(eventsKey);
    const list = (() => {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return [];
      }
    })();
    if (!Array.isArray(list)) return [];
    return list
      .filter((x) => x && typeof x === "object" && !Array.isArray(x))
      .slice(Math.max(0, list.length - maxEvents));
  };

  const write = (events) => {
    const list = Array.isArray(events) ? events : [];
    const trimmed = list.slice(Math.max(0, list.length - maxEvents));
    return storage.set(eventsKey, JSON.stringify(trimmed));
  };

  const log = (name, meta) => {
    if (!isEnabled()) return false;
    const n = String(name || "").trim();
    if (!n) return false;

    const ev = { ts: now(), name: n };

    try {
      const page = String(getPage?.() || "").trim();
      if (page) ev.page = page;
    } catch (_) {}

    const m = sanitizeTelemetryMeta(meta, { maxStr, maxKey });
    if (m) ev.meta = m;

    try {
      const list = read();
      list.push(ev);
      return write(list);
    } catch (_) {
      return false;
    }
  };

  const clear = () => storage.remove(eventsKey);

  const setEnabled = (on) => storage.set(enabledKey, on ? "1" : "0");

  return { isEnabled, log, read, clear, setEnabled };
};

