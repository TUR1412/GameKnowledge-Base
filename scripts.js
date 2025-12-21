/* 游戏攻略网 - 前端交互脚本（无框架 / 静态站点）
 *
 * 核心原则：
 * 1) 性能优先：粒子无 setInterval 轮询；hover/动效尽量 CSS 化。
 * 2) 断链兜底：缺失 id 也能渲染“建设中”，避免 404。
 * 3) 对象恒常性：主题/筛选/回复内容持久化到 localStorage。
 */

(() => {
  "use strict";

  const STORAGE_KEYS = {
    theme: "gkb-theme",
    contrast: "gkb-contrast",
    allGamesState: "gkb-all-games-state",
    allGuidesState: "gkb-all-guides-state",
    savedGuides: "gkb-saved-guides",
    savedGames: "gkb-saved-games",
    savedTopics: "gkb-saved-topics",
    compareGames: "gkb-compare-games",
    communityTopicsState: "gkb-community-topics-state",
    forumRepliesPrefix: "gkb-forum-replies:",
    recentGames: "gkb-recent-games",
    recentGuides: "gkb-recent-guides",
    swSeenPrefix: "gkb-sw-seen:",
    pwaInstallTipPrefix: "gkb-pwa-install-tip:",
    offlinePackPrefix: "gkb-offline-pack:",
    gameNotesPrefix: "gkb-game-notes:",
    guideNotesPrefix: "gkb-guide-notes:",
    guideChecklistPrefix: "gkb-guide-checklist:",
    guideReadingMode: "gkb-guide-reading-mode",
    guideFontSize: "gkb-guide-font-size",
    guideLineHeight: "gkb-guide-line-height",
    guideLastSectionPrefix: "gkb-guide-last-section:",
    forumSortPrefix: "gkb-forum-sort:",
    updateRadar: "gkb-update-radar",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const safeJsonParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  };

  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (_) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (_) {
        return false;
      }
    },
  };

  const readStringList = (key) => {
    const list = safeJsonParse(storage.get(key), []);
    if (!Array.isArray(list)) return [];
    return list.map((x) => String(x || "").trim()).filter(Boolean);
  };

  const writeStringList = (key, list) => {
    const next = Array.from(
      new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter(Boolean))
    );
    storage.set(key, JSON.stringify(next));
    return next;
  };

  const parseDateKey = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length >= 8) return Number(digits.slice(0, 8)) || 0;
    return 0;
  };

  const formatDate = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "—";
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length >= 8) {
      const year = digits.slice(0, 4);
      const month = digits.slice(4, 6);
      const day = digits.slice(6, 8);
      return `${year}-${month}-${day}`;
    }
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    return dt.toLocaleDateString("zh-CN");
  };

  // -------------------------
  // Update Radar（NEW / UPDATED）
  // -------------------------

  const normalizeRadarMap = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return;
      const next = Math.max(0, Math.floor(num));
      if (next > 0) out[String(k)] = next;
    });
    return out;
  };

  const readUpdateRadar = () => {
    const parsed = safeJsonParse(storage.get(STORAGE_KEYS.updateRadar), null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      version: String(parsed.version || ""),
      seededAt: Number(parsed.seededAt || 0) || 0,
      games: normalizeRadarMap(parsed.games),
      guides: normalizeRadarMap(parsed.guides),
      topics: normalizeRadarMap(parsed.topics),
    };
  };

  const writeUpdateRadar = (radar) => {
    if (!radar || typeof radar !== "object") return false;
    return storage.set(STORAGE_KEYS.updateRadar, JSON.stringify(radar));
  };

  const seedUpdateRadarIfNeeded = () => {
    const existing = readUpdateRadar();
    if (existing) return existing;

    const data = getData();
    if (!data) return null;

    const radar = {
      version: String(data.version || ""),
      seededAt: Date.now(),
      games: {},
      guides: {},
      topics: {},
    };

    const seed = (source, target) => {
      if (!source || typeof source !== "object") return;
      Object.entries(source).forEach(([id, item]) => {
        const updatedKey = parseDateKey(item?.updated);
        if (updatedKey) target[String(id)] = updatedKey;
      });
    };

    seed(data.games, radar.games);
    seed(data.guides, radar.guides);
    seed(data.topics, radar.topics);

    writeUpdateRadar(radar);
    return radar;
  };

  const getUpdateStatus = (type, id, updatedValue) => {
    const radar = seedUpdateRadarIfNeeded();
    if (!radar) return null;

    const t = String(type || "");
    if (t !== "games" && t !== "guides" && t !== "topics") return null;

    const itemId = String(id || "").trim();
    const updatedKey = parseDateKey(updatedValue);
    if (!itemId || !updatedKey) return null;

    const map = radar[t] || {};
    if (!Object.prototype.hasOwnProperty.call(map, itemId)) return "new";
    const seenKey = Number(map[itemId] || 0) || 0;
    return updatedKey > seenKey ? "updated" : null;
  };

  const markItemSeen = (type, id, updatedValue) => {
    const radar = seedUpdateRadarIfNeeded();
    if (!radar) return false;

    const t = String(type || "");
    if (t !== "games" && t !== "guides" && t !== "topics") return false;

    const itemId = String(id || "").trim();
    const updatedKey = parseDateKey(updatedValue);
    if (!itemId || !updatedKey) return false;

    const current = radar[t] || {};
    if (Number(current[itemId] || 0) === updatedKey) return true;
    radar[t] = { ...current, [itemId]: updatedKey };
    return writeUpdateRadar(radar);
  };

  const renderUpdateBadge = (status) => {
    if (status === "new") {
      return '<span class="update-badge update-badge-new" title="新内容">NEW</span>';
    }
    if (status === "updated") {
      return '<span class="update-badge update-badge-updated" title="最近更新">UPDATED</span>';
    }
    return "";
  };

  const difficultyRank = (value) => {
    const label = String(value || "").trim();
    const map = {
      入门: 1,
      新手: 1,
      简单: 1,
      中等: 2,
      中等偏高: 3,
      进阶: 3,
      策略向: 3,
      高: 4,
      高阶: 4,
      极高: 5,
      硬核: 5,
    };
    return map[label] || 3;
  };

  const pushRecent = (key, id, limit = 10) => {
    if (!id) return [];
    const current = readStringList(key).filter((x) => x !== id);
    current.unshift(id);
    return writeStringList(key, current.slice(0, Math.max(1, Number(limit) || 10)));
  };

  const escapeHtml = (input) => {
    const str = String(input ?? "");
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, (m) => map[m] || m);
  };

  const getPage = () => document.body?.dataset?.page || "";
  const getData = () => (window.GKB && window.GKB.data ? window.GKB.data : null);

  const getParam = (key) => {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch (_) {
      return null;
    }
  };

  const prefersReducedMotion = () => {
    try {
      return (
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_) {
      return false;
    }
  };

  const withViewTransition = (fn) => {
    const start = document.startViewTransition;
    if (prefersReducedMotion() || typeof start !== "function") {
      fn();
      return;
    }
    try {
      start.call(document, fn);
    } catch (_) {
      fn();
    }
  };

  const setGuideReadingMode = (on) => {
    document.body.classList.toggle("reading-mode", on);
    storage.set(STORAGE_KEYS.guideReadingMode, on ? "1" : "0");
    const toggle = $("#guide-reading-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      toggle.textContent = on ? "退出专注" : "专注阅读";
    }
  };

  const setGuideFont = (value) => {
    const next = value || "md";
    document.body.dataset.guideFont = next;
    storage.set(STORAGE_KEYS.guideFontSize, next);
    $$("[data-guide-font]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.guideFont === next ? "true" : "false");
    });
  };

  const setGuideLine = (value) => {
    const next = value || "normal";
    document.body.dataset.guideLine = next;
    storage.set(STORAGE_KEYS.guideLineHeight, next);
    $$("[data-guide-line]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.guideLine === next ? "true" : "false");
    });
  };

  const formatTime = () => {
    try {
      return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return new Date().toISOString().slice(11, 16);
    }
  };

  const initNotesPanel = ({ id, textarea, saveBtn, clearBtn, statusEl, storageKey }) => {
    if (!id || !textarea || !storageKey) return;
    const key = `${storageKey}${id}`;

    const setStatus = (text) => {
      if (statusEl) statusEl.textContent = text;
    };

    const load = () => {
      const saved = storage.get(key) || "";
      textarea.value = saved;
      setStatus(saved ? `已载入 · ${formatTime()}` : "自动保存已开启");
    };

    const persist = (value, { toastOnSave = false } = {}) => {
      storage.set(key, String(value || ""));
      if (toastOnSave) {
        toast({ title: "已保存", message: "笔记已写入本地浏览器。", tone: "success" });
      }
      setStatus(`已保存 · ${formatTime()}`);
    };

    load();

    let t = 0;
    textarea.addEventListener("input", () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => persist(textarea.value), 240);
    });

    saveBtn?.addEventListener("click", () => persist(textarea.value, { toastOnSave: true }));

    clearBtn?.addEventListener("click", () => {
      const ok = window.confirm("确认清空这条笔记吗？");
      if (!ok) return;
      textarea.value = "";
      storage.remove(key);
      setStatus("已清空");
    });
  };

  // -------------------------
  // Toast
  // -------------------------

  const toast = (() => {
    let root = null;

    const ensureRoot = () => {
      if (root) return root;
      root = document.createElement("div");
      root.className = "toast-root";
      root.setAttribute("aria-live", "polite");
      document.body.appendChild(root);
      return root;
    };

    return ({ title, message, tone = "info", timeout = 2600 } = {}) => {
      const host = ensureRoot();
      const item = document.createElement("div");
      item.className = `toast toast-${tone}`;
      item.innerHTML = `
        <div class="toast-title">${escapeHtml(title || "")}</div>
        <div class="toast-message">${escapeHtml(message || "")}</div>
      `;
      host.appendChild(item);

      const remove = () => {
        item.classList.add("toast-hide");
        window.setTimeout(() => item.remove(), 240);
      };

      const timer = window.setTimeout(remove, timeout);
      item.addEventListener("click", () => {
        window.clearTimeout(timer);
        remove();
      });
    };
  })();

  // -------------------------
  // Local Data (Export / Import / Reset)
  // -------------------------

  const listLocalStorageKeys = () => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      return keys;
    } catch (_) {
      return [];
    }
  };

  const downloadTextFile = (filename, text, mime = "application/json") => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch (_) {
      return false;
    }
  };

  const exportLocalData = () => {
    const keys = listLocalStorageKeys().filter((k) => k.startsWith("gkb-"));
    const data = {};
    keys.forEach((k) => {
      const v = storage.get(k);
      if (typeof v === "string") data[k] = v;
    });

    const version = String(getData()?.version || "");
    const exportedAt = new Date().toISOString();
    const payload = {
      schema: "gkb-local-storage",
      version,
      exportedAt,
      data,
    };

    const date = exportedAt.slice(0, 10);
    const safeVersion = version || "unknown";
    const fileName = `gkb-backup-${safeVersion}-${date}.json`;

    const ok = downloadTextFile(fileName, JSON.stringify(payload, null, 2));
    toast({
      title: ok ? "已导出" : "导出失败",
      message: ok ? "已下载备份文件（JSON）。" : "浏览器不支持下载或权限受限。",
      tone: ok ? "success" : "warn",
    });
  };

  const importLocalData = () => {
    const proceed = window.confirm(
      "导入会覆盖你当前的本地数据（主题/筛选/收藏/话题回复等）。\n\n确定继续吗？"
    );
    if (!proceed) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);

    const cleanup = () => {
      try {
        input.value = "";
      } catch (_) {}
      input.remove();
    };

    input.addEventListener(
      "change",
      () => {
        const file = input.files && input.files[0] ? input.files[0] : null;
        if (!file) {
          cleanup();
          return;
        }

        file
          .text()
          .then((text) => {
            const parsed = safeJsonParse(text, null);
            const entries = parsed && typeof parsed === "object" ? parsed.data : null;
            if (!entries || typeof entries !== "object") {
              toast({ title: "导入失败", message: "备份文件格式不正确。", tone: "warn" });
              return;
            }

            const keys = Object.keys(entries).filter((k) => k.startsWith("gkb-"));
            let written = 0;
            keys.forEach((k) => {
              const v = entries[k];
              if (typeof v !== "string") return;
              if (storage.set(k, v)) written += 1;
            });

            toast({
              title: "导入完成",
              message: `已写入 ${written} 项本地数据，页面将自动刷新以生效。`,
              tone: "success",
              timeout: 3200,
            });
            window.setTimeout(() => window.location.reload(), 800);
          })
          .catch(() => {
            toast({ title: "导入失败", message: "无法读取文件内容。", tone: "warn" });
          })
          .finally(cleanup);
      },
      { once: true }
    );

    input.click();
  };

  const resetLocalData = () => {
    const proceed = window.confirm(
      "这会清空该站点在本地浏览器中保存的所有数据（gkb-*），包括收藏、筛选、话题回复等。\n\n确定要清空吗？"
    );
    if (!proceed) return;

    const keys = listLocalStorageKeys().filter((k) => k.startsWith("gkb-"));
    let removed = 0;
    keys.forEach((k) => {
      if (storage.remove(k)) removed += 1;
    });

    toast({
      title: "已清空",
      message: `已删除 ${removed} 项本地数据，页面将刷新以恢复默认状态。`,
      tone: "info",
      timeout: 3000,
    });
    window.setTimeout(() => window.location.reload(), 800);
  };

  // -------------------------
  // Share / Copy Link
  // -------------------------

  const copyTextToClipboard = async (text) => {
    const value = String(text || "");
    if (!value) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {
      // fallback below
    }

    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "readonly");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "0";
      document.body.appendChild(el);
      el.select();
      el.setSelectionRange(0, el.value.length);
      const ok = document.execCommand && document.execCommand("copy");
      el.remove();
      return Boolean(ok);
    } catch (_) {
      return false;
    }
  };

  const copyCurrentPageLink = () => {
    const url = String(window.location.href || "");
    copyTextToClipboard(url).then((ok) => {
      toast({
        title: ok ? "链接已复制" : "复制失败",
        message: ok ? "已复制到剪贴板，可直接粘贴分享。" : "当前环境不支持剪贴板访问。",
        tone: ok ? "success" : "warn",
      });
    });
  };

  const copySectionLink = (hash) => {
    let url = String(window.location.href || "");
    try {
      const next = new URL(window.location.href);
      next.hash = hash || "";
      url = next.toString();
    } catch (_) {
      const base = url.split("#")[0];
      url = hash ? `${base}${hash}` : base;
    }
    copyTextToClipboard(url).then((ok) => {
      toast({
        title: ok ? "小节链接已复制" : "复制失败",
        message: ok ? "已复制到剪贴板，可直接分享该段落。" : "当前环境不支持剪贴板访问。",
        tone: ok ? "success" : "warn",
      });
    });
  };

  const initCopyLinkButtons = () => {
    $$('[data-action="copy-link"]').forEach((btn) => {
      btn.addEventListener("click", copyCurrentPageLink);
    });
  };

  // -------------------------
  // Share Meta (OG / Twitter / Canonical)
  // -------------------------

  const upsertMeta = ({ name, property }, content) => {
    const value = String(content ?? "").trim();
    if (!value) return;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const selector = name ? `meta[name="${esc(name)}"]` : `meta[property="${esc(property)}"]`;
    let el = document.head ? document.head.querySelector(selector) : null;
    if (!el) {
      el = document.createElement("meta");
      if (name) el.setAttribute("name", String(name));
      if (property) el.setAttribute("property", String(property));
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  };

  const upsertLink = (rel, href) => {
    const relValue = String(rel || "").trim();
    const hrefValue = String(href || "").trim();
    if (!relValue || !hrefValue) return;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    let el = document.head ? document.head.querySelector(`link[rel="${esc(relValue)}"]`) : null;
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", relValue);
      document.head.appendChild(el);
    }
    el.setAttribute("href", hrefValue);
  };

  const syncShareMeta = ({ title, description, image } = {}) => {
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      const canonical = url.toString();

      upsertLink("canonical", canonical);
      upsertMeta({ name: "description" }, description || "");

      const siteName = String(getData()?.site?.name || "游戏攻略网");

      upsertMeta({ property: "og:site_name" }, siteName);
      upsertMeta({ property: "og:type" }, "website");
      upsertMeta({ property: "og:url" }, canonical);
      upsertMeta({ property: "og:title" }, title || siteName);
      upsertMeta({ property: "og:description" }, description || "");

      const imgAbs = image ? new URL(String(image), canonical).toString() : "";
      if (imgAbs) {
        upsertMeta({ property: "og:image" }, imgAbs);
        upsertMeta({ name: "twitter:card" }, "summary_large_image");
        upsertMeta({ name: "twitter:image" }, imgAbs);
      } else {
        upsertMeta({ name: "twitter:card" }, "summary");
      }
      upsertMeta({ name: "twitter:title" }, title || siteName);
      upsertMeta({ name: "twitter:description" }, description || "");
    } catch (_) {}
  };

  // -------------------------
  // Theme
  // -------------------------

  const syncThemeColor = (theme) => {
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) return;
      meta.setAttribute("content", theme === "dark" ? "#0b0f14" : "#f6f1ea");
    } catch (_) {}
  };

  const applyTheme = (theme, { persist = false } = {}) => {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    if (persist) storage.set(STORAGE_KEYS.theme, next);
    syncThemeColor(next);
    $$('[data-action="theme-toggle"]').forEach((btn) => {
      btn.setAttribute("aria-label", next === "dark" ? "切换到浅色主题" : "切换到深色主题");
      btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    });
  };

  const setTheme = (theme) => applyTheme(theme, { persist: true });

  const applyContrast = (contrast, { persist = false } = {}) => {
    const next = contrast === "high" ? "high" : "normal";
    if (next === "high") document.documentElement.dataset.contrast = "high";
    else delete document.documentElement.dataset.contrast;

    if (persist) storage.set(STORAGE_KEYS.contrast, next);
  };

  const setContrast = (contrast) => applyContrast(contrast, { persist: true });

  const getContrastLabel = () => {
    const active = document.documentElement.dataset.contrast === "high";
    return active ? "关闭高对比度" : "开启高对比度";
  };

  const checkServiceWorkerUpdate = () => {
    if (!("serviceWorker" in navigator)) {
      toast({ title: "当前环境不支持", message: "该浏览器不支持 Service Worker。", tone: "warn" });
      return;
    }

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) {
          toast({ title: "未启用离线缓存", message: "当前页面未注册 Service Worker。", tone: "warn" });
          return;
        }
        return reg.update().then(() => {
          toast({ title: "已检查更新", message: "如果有新版本会自动下载并在后台更新。", tone: "info" });
        });
      })
      .catch(() => {
        toast({ title: "检查失败", message: "无法检查离线缓存更新，请稍后重试。", tone: "warn" });
      });
  };

  const initThemeToggle = () => {
    const btns = $$('[data-action="theme-toggle"]');
    if (btns.length === 0) return;

    const saved = storage.get(STORAGE_KEYS.theme);
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }

    // 无论主题来自 localStorage 还是 boot.js 的系统偏好，都要同步按钮可访问性状态与 theme-color
    applyTheme(document.documentElement.dataset.theme || "light", { persist: false });

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.dataset.theme || "light";
        setTheme(current === "dark" ? "light" : "dark");
      });
    });
  };

  const initContrast = () => {
    const saved = storage.get(STORAGE_KEYS.contrast);
    applyContrast(saved === "high" ? "high" : "normal", { persist: false });
  };

  // -------------------------
  // Command Palette (Ctrl+K)
  // -------------------------

  const initCommandPalette = () => {
    const getFocusable = (root) =>
      $$(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        root
      );

    const ensureHeaderButton = (open) => {
      const host = $(".header-actions");
      if (!host) return;
      if ($(".cmdk-toggle", host)) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-button cmdk-toggle";
      btn.setAttribute("aria-label", "全站搜索（Ctrl+K）");
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M10 2a8 8 0 1 1 5.293 14.293l4.707 4.707a1 1 0 0 1-1.414 1.414l-4.707-4.707A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12z"/>
        </svg>
        <span class="icon-button-text">搜索</span>
      `;
      btn.addEventListener("click", open);
      host.insertBefore(btn, host.firstChild);
    };

    const root = document.createElement("div");
    root.className = "cmdk-root";
    root.hidden = true;
    root.dataset.state = "closed";
    root.innerHTML = `
      <div class="cmdk-backdrop" data-action="cmdk-close" aria-hidden="true"></div>
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="全站搜索">
        <div class="cmdk-bar">
          <input class="cmdk-input" type="search" placeholder="搜索游戏 / 攻略 / 话题（Ctrl+K）" autocomplete="off" spellcheck="false">
          <button class="cmdk-close" type="button" data-action="cmdk-close" aria-label="关闭">Esc</button>
        </div>
        <div class="cmdk-hint">↑ ↓ 选择，Enter 打开，Esc 关闭</div>
        <div class="cmdk-list" role="listbox" aria-label="搜索结果"></div>
      </div>
    `;
    document.body.appendChild(root);

    const input = $(".cmdk-input", root);
    const list = $(".cmdk-list", root);
    let lastActive = null;
    let selected = 0;
    let flatItems = [];

    const highlight = (text, q) => {
      const raw = String(text || "");
      const query = String(q || "").trim();
      if (!query) return escapeHtml(raw);
      const hay = raw.toLowerCase();
      const needle = query.toLowerCase();
      const idx = hay.indexOf(needle);
      if (idx < 0) return escapeHtml(raw);
      return (
        escapeHtml(raw.slice(0, idx)) +
        `<mark>${escapeHtml(raw.slice(idx, idx + query.length))}</mark>` +
        escapeHtml(raw.slice(idx + query.length))
      );
    };

    const fuzzyScore = (text, q) => {
      const hay = String(text || "").toLowerCase();
      const needle = String(q || "").toLowerCase().trim();
      if (!needle) return 0;
      if (!hay) return null;

      // 直接子串：最高优先
      const direct = hay.indexOf(needle);
      if (direct >= 0) {
        return 1200 + needle.length * 12 - direct;
      }

      // 顺序匹配：允许跳跃，连续命中加权
      let h = 0;
      let score = 0;
      let streak = 0;
      for (const ch of needle) {
        const idx = hay.indexOf(ch, h);
        if (idx < 0) return null;
        streak = idx === h ? streak + 1 : 1;
        score += 3 + streak * 2;
        h = idx + 1;
      }
      return score;
    };

    const getThemeLabel = () => {
      const current = document.documentElement.dataset.theme || "light";
      return current === "dark" ? "切换到浅色主题" : "切换到深色主题";
    };

    const getReadingLabel = () => {
      const active = document.body.classList.contains("reading-mode");
      return active ? "退出专注阅读" : "进入专注阅读";
    };

    // 搜索索引缓存：避免每次输入都重复构造全文字符串（性能压榨）
    let searchPool = null;
    let searchPoolVersion = "";

    const getSearchPool = () => {
      const data = getData();
      const version = String(data?.version || "");

      if (searchPool && version && searchPoolVersion === version) return searchPool;
      if (!data) return { games: [], guides: [], topics: [] };

      const next = {
        games: Object.entries(data.games || {}).map(([id, g]) => {
          const title = String(g?.title || id);
          const genre = String(g?.genre || "");
          const year = g?.year ? `${g.year}` : "";
          return { id, g, blob: `${id} ${title} ${genre} ${year}` };
        }),
        guides: Object.entries(data.guides || {}).map(([id, g]) => {
          const title = String(g?.title || id);
          const summary = String(g?.summary || "");
          const tags = Array.isArray(g?.tags) ? g.tags.map(String).join(" ") : "";
          return { id, g, blob: `${id} ${title} ${summary} ${tags}` };
        }),
        topics: Object.entries(data.topics || {}).map(([id, t]) => {
          const title = String(t?.title || id);
          const summary = String(t?.summary || "");
          return { id, t, blob: `${id} ${title} ${summary}` };
        }),
      };

      searchPool = next;
      searchPoolVersion = version || searchPoolVersion;
      return next;
    };

    const buildGroups = (query) => {
      const data = getData();
      const q = String(query || "").trim().toLowerCase();

      const guideId = getPage() === "guide" ? getParam("id") : "";
      const lastKey = guideId ? `${STORAGE_KEYS.guideLastSectionPrefix}${guideId}` : "";
      const lastSaved = lastKey ? safeJsonParse(storage.get(lastKey), null) : null;
      const lastHash = typeof lastSaved === "string" ? lastSaved : lastSaved?.hash;
      const lastTitle = lastSaved?.title;

      const guideActions = getPage() === "guide"
        ? [
            ...(lastHash
              ? [
                  {
                    kind: "action",
                    badge: "阅读",
                    title: lastTitle ? `继续阅读：${lastTitle}` : "继续阅读上一小节",
                    subtitle: "回到你上次阅读的位置",
                    run: () => {
                      const target = document.querySelector(lastHash);
                      if (target) {
                        target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
                      }
                    },
                  },
                ]
              : []),
            {
              kind: "action",
              badge: "阅读",
              title: getReadingLabel(),
              subtitle: "隐藏侧栏并提升阅读舒适度",
              run: () => setGuideReadingMode(!document.body.classList.contains("reading-mode")),
            },
            {
              kind: "action",
              badge: "阅读",
              title: "字号：小",
              subtitle: "更紧凑的字号",
              run: () => setGuideFont("sm"),
            },
            {
              kind: "action",
              badge: "阅读",
              title: "字号：大",
              subtitle: "更易阅读的字号",
              run: () => setGuideFont("lg"),
            },
            {
              kind: "action",
              badge: "阅读",
              title: "行距：舒适",
              subtitle: "提高段落呼吸感",
              run: () => setGuideLine("relaxed"),
            },
          ]
        : [];

      const actions = [
        {
          kind: "action",
          badge: "操作",
          title: getThemeLabel(),
          subtitle: "立即生效，并保存到本地",
          run: () => {
            const current = document.documentElement.dataset.theme || "light";
            setTheme(current === "dark" ? "light" : "dark");
            toast({ title: "主题已切换", message: "偏好已保存到本地。", tone: "success" });
          },
        },
        {
          kind: "action",
          badge: "无障碍",
          title: getContrastLabel(),
          subtitle: "提升对比度与边界（强光环境更清晰）",
          run: () => {
            const active = document.documentElement.dataset.contrast === "high";
            setContrast(active ? "normal" : "high");
            toast({
              title: "对比度已切换",
              message: active ? "已恢复默认对比度。" : "已开启高对比度模式。",
              tone: "info",
            });
          },
        },
        ...(readCompareGames().length > 0
          ? [
              {
                kind: "action",
                badge: "对比",
                title: `打开游戏对比（${readCompareGames().length}）`,
                subtitle: "查看已选择的游戏差异（最多 4 个）",
                run: () => openGameCompare(readCompareGames()),
              },
            ]
          : []),
        {
          kind: "action",
          badge: "操作",
          title: "回到顶部",
          subtitle: "快速回到页面顶部",
          run: () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }),
        },
        {
          kind: "action",
          badge: "操作",
          title: "复制当前页链接",
          subtitle: "复制到剪贴板，便于分享或收藏",
          run: copyCurrentPageLink,
        },
        {
          kind: "action",
          badge: "PWA",
          title: "检查离线缓存更新",
          subtitle: "手动触发 Service Worker 更新检查",
          run: checkServiceWorkerUpdate,
        },
        {
          kind: "action",
          badge: "PWA",
          title: "下载离线包（图标/封面/深度页）",
          subtitle: "让离线时也能显示大部分图标与封面资源",
          run: precacheOfflinePack,
        },
        ...(deferredPwaInstallPrompt
          ? [
              {
                kind: "action",
                badge: "PWA",
                title: "安装到桌面",
                subtitle: "将站点作为应用安装（支持离线）",
                run: runPwaInstallPrompt,
              },
            ]
          : []),
        {
          kind: "link",
          badge: "PWA",
          title: "打开离线说明页",
          subtitle: "查看 offline.html（离线兜底）",
          href: "offline.html",
        },
        {
          kind: "action",
          badge: "本地",
          title: "导出本地数据",
          subtitle: "下载 JSON 备份（收藏/筛选/回复等）",
          run: exportLocalData,
        },
        {
          kind: "action",
          badge: "本地",
          title: "导入本地数据",
          subtitle: "从 JSON 恢复（会覆盖当前本地数据）",
          run: importLocalData,
        },
        {
          kind: "action",
          badge: "本地",
          title: "清空本地数据",
          subtitle: "重置主题/筛选/收藏/回复（需确认）",
          run: resetLocalData,
        },
        { kind: "link", badge: "导航", title: "打开游戏库", subtitle: "筛选与排序全部游戏", href: "all-games.html" },
        { kind: "link", badge: "导航", title: "打开攻略库", subtitle: "搜索与标签筛选", href: "all-guides.html" },
        ...guideActions,
      ];

      const withHighlight = (groups) => {
        groups.forEach((g) => {
          g.items = (g.items || []).map((item) => ({
            ...item,
            __titleHtml: highlight(item.title, query),
            __subtitleHtml: highlight(item.subtitle, query),
          }));
        });
        return groups;
      };

      if (!q) {
        const recentGames = readStringList(STORAGE_KEYS.recentGames);
        const recentGuides = readStringList(STORAGE_KEYS.recentGuides);
        const savedGuides = readStringList(STORAGE_KEYS.savedGuides);
        const savedGames = readStringList(STORAGE_KEYS.savedGames);
        const savedTopics = readStringList(STORAGE_KEYS.savedTopics);

        const recent = [];
        recentGames.slice(0, 6).forEach((id) => {
          const g = data?.games?.[id] || null;
          recent.push({
            kind: "link",
            badge: "最近·游戏",
            title: g?.title || `游戏：${id}`,
            subtitle: g?.genre || "打开游戏详情",
            href: `game.html?id=${encodeURIComponent(id)}`,
          });
        });
        recentGuides.slice(0, 6).forEach((id) => {
          const g = data?.guides?.[id] || null;
          recent.push({
            kind: "link",
            badge: "最近·攻略",
            title: g?.title || `攻略：${id}`,
            subtitle: g?.summary || "打开攻略详情",
            href: `guide-detail.html?id=${encodeURIComponent(id)}`,
          });
        });

        const saved = savedGuides.slice(0, 8).map((id) => {
          const g = data?.guides?.[id] || null;
          return {
            kind: "link",
            badge: "收藏",
            title: g?.title || `攻略：${id}`,
            subtitle: g?.summary || "打开收藏的攻略",
            href: `guide-detail.html?id=${encodeURIComponent(id)}`,
          };
        });

        const savedGameItems = savedGames.slice(0, 6).map((id) => {
          const g = data?.games?.[id] || null;
          return {
            kind: "link",
            badge: "收藏·游戏",
            title: g?.title || `游戏：${id}`,
            subtitle: g?.genre || "打开游戏详情",
            href: `game.html?id=${encodeURIComponent(id)}`,
          };
        });

        const savedTopicItems = savedTopics.slice(0, 6).map((id) => {
          const t = data?.topics?.[id] || null;
          return {
            kind: "link",
            badge: "收藏·话题",
            title: t?.title || `话题：${id}`,
            subtitle: t?.summary || "进入话题讨论",
            href: `forum-topic.html?id=${encodeURIComponent(id)}`,
          };
        });

        const groups = [{ title: "快捷操作", items: actions }];
        if (recent.length > 0) groups.push({ title: "最近访问", items: recent });
        if (savedGameItems.length > 0) groups.push({ title: "本地收藏·游戏", items: savedGameItems });
        if (savedTopicItems.length > 0) groups.push({ title: "本地收藏·话题", items: savedTopicItems });
        if (saved.length > 0) groups.push({ title: "本地收藏·攻略", items: saved });
        return withHighlight(groups);
      }

      const pool = getSearchPool();

      const gameItems = pool.games
        .map(({ id, g, blob }) => {
          const score = fuzzyScore(blob, q);
          return { id, g, score };
        })
        .filter((x) => x.score != null)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 6)
        .map(({ id, g }) => ({
          kind: "link",
          badge: "游戏",
          title: g?.title || id,
          subtitle: [g?.genre, g?.year ? `${g.year}` : ""].filter(Boolean).join(" · ") || "打开游戏详情",
          href: `game.html?id=${encodeURIComponent(id)}`,
        }));

      const guideItems = pool.guides
        .map(({ id, g, blob }) => {
          const score = fuzzyScore(blob, q);
          return { id, g, score };
        })
        .filter((x) => x.score != null)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8)
        .map(({ id, g }) => ({
          kind: "link",
          badge: "攻略",
          title: g?.title || id,
          subtitle: g?.summary || "打开攻略详情",
          href: `guide-detail.html?id=${encodeURIComponent(id)}`,
        }));

      const topicItems = pool.topics
        .map(({ id, t, blob }) => {
          const score = fuzzyScore(blob, q);
          return { id, g: t, score };
        })
        .filter((x) => x.score != null)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 6)
        .map(({ id, g }) => ({
          kind: "link",
          badge: "话题",
          title: g?.title || id,
          subtitle: g?.summary || "进入讨论",
          href: `forum-topic.html?id=${encodeURIComponent(id)}`,
        }));

      const groups = [{ title: "快捷操作", items: actions }];
      if (gameItems.length > 0) groups.push({ title: "游戏", items: gameItems });
      if (guideItems.length > 0) groups.push({ title: "攻略", items: guideItems });
      if (topicItems.length > 0) groups.push({ title: "话题", items: topicItems });

      if (gameItems.length + guideItems.length + topicItems.length === 0) {
        groups.push({
          title: "未找到结果",
          items: [
            {
              kind: "link",
              badge: "建议",
              title: "打开游戏库",
              subtitle: "去“所有游戏”里用筛选器找内容",
              href: "all-games.html",
            },
            {
              kind: "link",
              badge: "建议",
              title: "打开攻略库",
              subtitle: "去“所有攻略”里按标签与关键词筛选",
              href: "all-guides.html",
            },
          ],
        });
      }

      return withHighlight(groups);
    };

    const render = (query) => {
      if (!list) return;
      const groups = buildGroups(query);

      flatItems = [];
      let idx = 0;

      list.innerHTML = groups
        .map((g) => {
          const itemsHtml = (g.items || [])
            .map((item) => {
              const id = idx;
              idx += 1;
              flatItems.push(item);

              const titleHtml = item.__titleHtml || escapeHtml(item.title);
              const subtitleHtml = item.__subtitleHtml || escapeHtml(item.subtitle || "");

              return `
                <button type="button" class="cmdk-item" role="option" aria-selected="false" data-idx="${id}">
                  <span class="cmdk-badge">${escapeHtml(item.badge || "")}</span>
                  <span class="cmdk-main">
                    <span class="cmdk-title">${titleHtml}</span>
                    <span class="cmdk-sub">${subtitleHtml}</span>
                  </span>
                </button>
              `;
            })
            .join("");
          return `
            <div class="cmdk-group">
              <div class="cmdk-group-title">${escapeHtml(g.title || "")}</div>
              <div class="cmdk-group-items">${itemsHtml}</div>
            </div>
          `;
        })
        .join("");

      const buttons = $$(".cmdk-item", list);
      selected = 0;
      if (buttons.length > 0) buttons[0].setAttribute("aria-selected", "true");
    };

    const syncSelection = (next) => {
      const buttons = $$(".cmdk-item", list);
      if (buttons.length === 0) return;
      selected = Math.max(0, Math.min(next, buttons.length - 1));
      buttons.forEach((b, i) => b.setAttribute("aria-selected", i === selected ? "true" : "false"));
      buttons[selected]?.scrollIntoView({ block: "nearest" });
    };

    const open = () => {
      if (!root.hidden) return;
      lastActive = document.activeElement;
      root.hidden = false;
      root.dataset.state = "opening";
      document.body.classList.add("cmdk-open");
      window.requestAnimationFrame(() => {
        root.dataset.state = "open";
      });
      if (input) {
        input.value = "";
        render("");
        window.setTimeout(() => input.focus(), 0);
      } else {
        render("");
      }
    };

    const close = () => {
      if (root.hidden) return;
      root.dataset.state = prefersReducedMotion() ? "closed" : "closing";
      document.body.classList.remove("cmdk-open");
      const finalize = () => {
        root.hidden = true;
        root.dataset.state = "closed";
        try {
          lastActive?.focus?.();
        } catch (_) {}
      };
      if (prefersReducedMotion()) finalize();
      else window.setTimeout(finalize, 160);
    };

    // 事件委托：避免每次 render 都给每个 item 重新绑定 click
    list?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".cmdk-item");
      if (!btn) return;
      const i = Number(btn.dataset.idx || 0);
      const item = flatItems[i];
      if (!item) return;
      if (item.kind === "action" && typeof item.run === "function") {
        item.run();
        close();
        return;
      }
      if (item.href) window.location.href = item.href;
    });

    root.addEventListener("click", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.dataset.action === "cmdk-close") close();
    });

    if (input) {
      let t = 0;
      input.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => render(input.value), 60);
      });
    }

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        syncSelection(selected + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        syncSelection(selected - 1);
        return;
      }
      if (e.key === "Enter") {
        const btn = $$(".cmdk-item", list)[selected];
        btn?.click();
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable(root);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      const tag = String(document.activeElement?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;
      if (isTyping) return;

      const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isCtrlK) {
        e.preventDefault();
        if (root.hidden) open();
        else close();
      }
      if (e.key === "/" && root.hidden) {
        e.preventDefault();
        open();
      }
    });

    ensureHeaderButton(open);
  };

  // -------------------------
  // Navigation / BackToTop
  // -------------------------

  const initNavigation = () => {
    const header = $("header");
    const toggle = $(".mobile-nav-toggle");
    const nav = $("header nav");

    if (header) {
      const onScroll = () => {
        header.classList.toggle("scrolled", window.scrollY > 50);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (toggle && nav) {
      const setToggleState = (isOpen) => {
        nav.classList.toggle("active", isOpen);
        toggle.classList.toggle("is-open", isOpen);
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        toggle.setAttribute("aria-label", isOpen ? "关闭导航菜单" : "打开导航菜单");
      };

      const close = () => setToggleState(false);
      const open = () => setToggleState(true);

      toggle.addEventListener("click", () => {
        if (nav.classList.contains("active")) close();
        else open();
      });

      // 初始化：统一可访问性状态（避免不同页面初始 aria 文案不一致）
      close();

      $$("a", nav).forEach((a) => a.addEventListener("click", close));
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) close();
      });
    }

    const currentPage = window.location.pathname.split("/").pop();
    $$("header nav a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const isActive = href === currentPage || (currentPage === "" && href === "index.html");
      a.classList.toggle("active", isActive);
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  // -------------------------
  // Soft Navigation（跨页淡入淡出：微交互增强，降级安全）
  // -------------------------

  const initSoftNavigation = () => {
    if (prefersReducedMotion()) return;

    let inFlight = false;

    const canIntercept = (e, a, url) => {
      if (!e || e.defaultPrevented) return false;
      if (!a || !(a instanceof HTMLAnchorElement)) return false;
      if (!url) return false;

      // 仅处理“同页签普通点击”
      if (e.button !== 0) return false;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
      if (a.target && a.target !== "_self") return false;
      if (a.hasAttribute("download")) return false;
      if (a.dataset.noTransition === "1") return false;

      // 仅同源（避免外链被劫持）
      if (url.origin !== window.location.origin) return false;

      // hash 变化（同页锚点）不拦截
      const sameDoc = url.pathname === window.location.pathname && url.search === window.location.search;
      if (sameDoc && url.hash && url.hash !== window.location.hash) return false;

      // 相同 URL 不拦截
      if (url.href === window.location.href) return false;

      return true;
    };

    document.addEventListener(
      "click",
      (e) => {
        if (inFlight) return;
        const a = e.target?.closest?.("a[href]");
        if (!a) return;

        let url = null;
        try {
          url = new URL(a.getAttribute("href") || "", window.location.href);
        } catch (_) {
          url = null;
        }

        if (!canIntercept(e, a, url)) return;

        inFlight = true;
        e.preventDefault();

        document.body.classList.add("is-navigating");
        window.setTimeout(() => {
          window.location.href = url.href;
        }, 140);
      },
      { capture: true }
    );

    // BFCache / 返回：确保不会卡在“离场态”
    window.addEventListener("pageshow", () => {
      inFlight = false;
      document.body.classList.remove("is-navigating");
    });
  };

  // -------------------------
  // Service Worker (PWA)
  // -------------------------

  let deferredPwaInstallPrompt = null;

  const detectAssetVersion = () => {
    const el = document.querySelector('script[src^="data.js"]');
    const src = el?.getAttribute("src") || "";
    const m = src.match(/[?&]v=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  };

  const runPwaInstallPrompt = () => {
    const promptEvent = deferredPwaInstallPrompt;
    if (!promptEvent || typeof promptEvent.prompt !== "function") {
      toast({
        title: "暂不可安装",
        message: "当前环境未触发安装提示（需要支持 PWA 的浏览器与 HTTPS）。",
        tone: "warn",
      });
      return;
    }

    try {
      promptEvent.prompt();
      const choice = promptEvent.userChoice;
      deferredPwaInstallPrompt = null; // prompt 只能触发一次

      if (choice && typeof choice.then === "function") {
        choice.then((result) => {
          const outcome = String(result?.outcome || "");
          if (outcome === "accepted") {
            toast({ title: "开始安装", message: "已触发安装流程。", tone: "success" });
          } else {
            toast({ title: "已取消安装", message: "你可以稍后再试。", tone: "info" });
          }
        });
      } else {
        toast({ title: "开始安装", message: "已触发安装流程。", tone: "success" });
      }
    } catch (_) {
      toast({ title: "安装失败", message: "无法触发安装流程。", tone: "warn" });
    }
  };

  const initPwaInstall = () => {
    window.addEventListener("beforeinstallprompt", (e) => {
      try {
        e.preventDefault();
      } catch (_) {}

      deferredPwaInstallPrompt = e;

      const v = detectAssetVersion();
      const key = `${STORAGE_KEYS.pwaInstallTipPrefix}${v || "unknown"}`;
      if (storage.get(key)) return;
      storage.set(key, "1");
      toast({
        title: "可安装到桌面",
        message: "打开全站搜索（Ctrl+K），选择“安装到桌面”。",
        tone: "success",
        timeout: 3600,
      });
    });

    window.addEventListener("appinstalled", () => {
      deferredPwaInstallPrompt = null;
      toast({ title: "安装完成", message: "已添加到你的设备。", tone: "success" });
    });
  };

  const initServiceWorker = () => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    const v = detectAssetVersion();
    const swUrl = v ? `sw.js?v=${encodeURIComponent(v)}` : "sw.js";

    navigator.serviceWorker
      .register(swUrl)
      .then(() => {
        if (!v) return;
        const key = `${STORAGE_KEYS.swSeenPrefix}${v}`;
        if (storage.get(key)) return;
        storage.set(key, "1");
        toast({
          title: "离线缓存已启用",
          message: "已为你缓存核心资源；断网时仍可打开模板页与已缓存资源。",
          tone: "success",
          timeout: 3400,
        });
      })
      .catch(() => {
        // 离线能力是增强项：注册失败不影响基本可用性
      });
  };

  let offlinePackInFlight = false;
  let offlinePackRequestId = 0;
  let offlinePackStorageKey = "";

  const normalizeRelativeAssetUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw.startsWith("//")) return null;

    try {
      // 允许传入绝对 URL（但必须同源）
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = new URL(raw);
        if (u.origin !== window.location.origin) return null;
        const path = u.pathname.replace(/^\/+/, "");
        if (!path || path.includes("..")) return null;
        return `${path}${u.search || ""}`;
      }
    } catch (_) {
      // ignore
    }

    const path = raw.replace(/^\/+/, "");
    if (!path || path.includes("..")) return null;
    return path;
  };

  const collectOfflinePackUrls = () => {
    const data = getData();
    if (!data) return [];

    const urls = [];
    const add = (u) => {
      const normalized = normalizeRelativeAssetUrl(u);
      if (!normalized) return;
      urls.push(normalized);
    };

    // 常用占位图（首屏/空状态/预览）
    add("images/placeholders/screenshot-ui.svg");
    add("images/placeholders/cover-starlight.svg");
    add("images/placeholders/avatar-class.svg");

    // 图标：游戏/攻略
    Object.values(data.games || {}).forEach((game) => add(game?.icon));
    Object.values(data.guides || {}).forEach((guide) => add(guide?.icon));

    // 深度攻略页（如存在）
    Object.values(data.games || {}).forEach((game) => {
      if (game?.hasDeepGuide && game?.deepGuideHref) add(game.deepGuideHref);
    });

    return Array.from(new Set(urls));
  };

  const requestSwPrecache = async (urls) => {
    if (!("serviceWorker" in navigator)) return false;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return false;

    const reg = await navigator.serviceWorker.getRegistration();
    const sw = reg?.active || reg?.waiting || reg?.installing;
    if (!sw) return false;

    sw.postMessage({
      type: "GKB_PRECACHE",
      requestId: offlinePackRequestId,
      urls,
    });

    return true;
  };

  const precacheOfflinePack = async () => {
    if (offlinePackInFlight) {
      toast({ title: "正在缓存中", message: "离线包正在准备，请稍候。", tone: "info" });
      return;
    }

    const v = detectAssetVersion() || String(getData()?.version || "") || "unknown";
    offlinePackStorageKey = `${STORAGE_KEYS.offlinePackPrefix}${v}`;
    if (storage.get(offlinePackStorageKey) === "1") {
      toast({ title: "离线包已就绪", message: "常用图标与页面已缓存。", tone: "success" });
      return;
    }

    const urls = collectOfflinePackUrls();
    if (urls.length === 0) {
      toast({ title: "无可缓存资源", message: "当前页面未加载数据，稍后再试。", tone: "warn" });
      return;
    }

    offlinePackInFlight = true;
    offlinePackRequestId = Date.now();
    toast({
      title: "开始缓存离线包",
      message: `正在准备 ${urls.length} 项资源（图标/封面/深度页）。`,
      tone: "info",
      timeout: 3200,
    });

    const ok = await requestSwPrecache(urls);
    if (!ok) {
      offlinePackInFlight = false;
      toast({ title: "缓存失败", message: "当前环境未启用 Service Worker（需要 HTTPS/localhost）。", tone: "warn" });
      return;
    }

    // 若 SW 未回消息，避免永远锁死
    window.setTimeout(() => {
      if (!offlinePackInFlight) return;
      offlinePackInFlight = false;
      toast({ title: "缓存进行中", message: "可能仍在后台缓存，稍后可再试。", tone: "info" });
    }, 12000);
  };

  const initServiceWorkerMessaging = () => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "GKB_PRECACHE_DONE") return;
      if (Number(data.requestId || 0) !== offlinePackRequestId) return;

      offlinePackInFlight = false;

      const ok = Number(data.ok || 0) || 0;
      const fail = Number(data.fail || 0) || 0;
      const total = Number(data.total || ok + fail) || ok + fail;

      if (offlinePackStorageKey) storage.set(offlinePackStorageKey, "1");

      toast({
        title: "离线包已缓存",
        message: fail > 0 ? `已缓存 ${ok}/${total} 项，${fail} 项失败（可稍后重试）。` : `已缓存 ${ok}/${total} 项资源。`,
        tone: fail > 0 ? "warn" : "success",
        timeout: 4200,
      });
    });
  };

  const initConnectivityToasts = () => {
    let online = true;
    try {
      online = Boolean(navigator.onLine);
    } catch (_) {
      online = true;
    }

    const notify = (next) => {
      const isOnline = Boolean(next);
      toast({
        title: isOnline ? "网络已恢复" : "当前离线",
        message: isOnline
          ? "已恢复联网，可正常更新与获取最新内容。"
          : "你仍可浏览已缓存页面；需要联网才能首次缓存新页面。",
        tone: isOnline ? "info" : "warn",
        timeout: 3200,
      });
    };

    // 首次加载即离线：提示一次
    if (!online) notify(false);

    window.addEventListener("online", () => {
      if (online) return;
      online = true;
      notify(true);
    });

    window.addEventListener("offline", () => {
      if (!online) return;
      online = false;
      notify(false);
    });
  };

  const initBackToTop = () => {
    const btn = $("#back-to-top");
    if (!btn) return;

    const onScroll = () => btn.classList.toggle("visible", window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    btn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })
    );
  };

  // -------------------------
  // Animations
  // -------------------------

  const initPageLoaded = () => {
    window.requestAnimationFrame(() => document.body.classList.add("page-loaded"));
  };

  const initScrollReveal = () => {
    const targets = $$(".animate-on-scroll, .fade-in-up");
    if (targets.length === 0) return;
    const showAll = () => targets.forEach((el) => el.classList.add("visible", "animated"));
    if (prefersReducedMotion()) {
      showAll();
      return;
    }
    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible", "animated");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((el) => observer.observe(el));
  };

  // -------------------------
  // Particles (no interval)
  // -------------------------

  const initParticles = () => {
    const container = $("#particles-background");
    if (!container) return;
    if (prefersReducedMotion()) return;

    $$(".particle", container).forEach((n) => n.remove());

    const count = window.innerWidth < 768 ? 14 : 24;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement("div");
      p.className = "particle";

      const size = Math.random() * 5 + 1;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${Math.random() * 100}%`;

      p.style.setProperty("--dx1", `${Math.round(Math.random() * 40 - 20)}px`);
      p.style.setProperty("--dy1", `${Math.round(Math.random() * 40 - 20)}px`);
      p.style.setProperty("--dx2", `${Math.round(Math.random() * 50 - 25)}px`);
      p.style.setProperty("--dy2", `${Math.round(Math.random() * 50 - 25)}px`);
      p.style.setProperty("--rot", `${Math.round(Math.random() * 18 - 9)}deg`);
      p.style.setProperty("--dur", `${Math.round(Math.random() * 18 + 12)}s`);
      p.style.setProperty("--delay", `${Math.round(Math.random() * 6)}s`);

      const hue = Math.round(Math.random() * 360);
      const alpha = Math.random() * 0.35 + 0.12;
      p.style.backgroundColor = `hsla(${hue}, 70%, 70%, ${alpha})`;

      container.appendChild(p);
    }
  };

  // -------------------------
  // Newsletter
  // -------------------------

  const initNewsletterForms = () => {
    $$("form.newsletter-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = $('input[type="email"]', form)?.value?.trim() || "";
        if (!email) {
          toast({ title: "还差一步", message: "请输入邮箱地址。", tone: "warn" });
          return;
        }
        toast({ title: "订阅成功", message: "已保存到本地（演示）。", tone: "success" });
        form.reset();
      });
    });
  };

  // -------------------------
  // Hero Stats (data-driven)
  // -------------------------

  const initHeroStats = () => {
    const data = getData();
    if (!data) return;

    const count = (obj) => (obj && typeof obj === "object" ? Object.keys(obj).length : 0);

    const stats = {
      games: count(data.games),
      guides: count(data.guides),
      topics: count(data.topics),
    };

    Object.entries(stats).forEach(([key, value]) => {
      $$(`[data-stat="${key}"]`).forEach((el) => {
        el.textContent = String(value);
      });
    });
  };

  // -------------------------
  // Home: Recently Viewed
  // -------------------------

  const initHomeRecent = () => {
    if (getPage() !== "home") return;
    const data = getData();
    if (!data) return;

    const gamesRoot = $("#recent-games");
    const guidesRoot = $("#recent-guides");
    if (!gamesRoot && !guidesRoot) return;

    const renderEmpty = (root, message) => {
      if (!root) return;
      root.innerHTML = `
        <div class="empty-state small">
          <p class="empty-title">暂无记录</p>
          <p class="empty-desc">${escapeHtml(message)}</p>
        </div>
      `;
    };

    const renderCards = (root, items, type) => {
      if (!root) return;
      if (!items || items.length === 0) {
        renderEmpty(root, "浏览内容后会自动出现在这里。");
        return;
      }
      root.innerHTML = items
        .map(({ id, title, desc, icon, href }) => {
          return `
            <a class="mini-card" href="${href}">
              <img src="${icon}" alt="${escapeHtml(title)}">
              <div class="mini-card-body">
                <div class="mini-card-title">${escapeHtml(title)}</div>
                <div class="mini-card-desc">${escapeHtml(desc || (type === "game" ? "打开游戏详情" : "打开攻略详情"))}</div>
              </div>
            </a>
          `;
        })
        .join("");
    };

    const recentGames = readStringList(STORAGE_KEYS.recentGames)
      .slice(0, 4)
      .map((id) => {
        const g = data.games?.[id] || null;
        return {
          id,
          title: g?.title || `游戏：${id}`,
          desc: g?.genre || "打开游戏详情",
          icon: g?.icon || "images/icons/game-cover.svg",
          href: `game.html?id=${encodeURIComponent(id)}`,
        };
      });

    const recentGuides = readStringList(STORAGE_KEYS.recentGuides)
      .slice(0, 4)
      .map((id) => {
        const g = data.guides?.[id] || null;
        return {
          id,
          title: g?.title || `攻略：${id}`,
          desc: g?.summary || "打开攻略详情",
          icon: g?.icon || "images/icons/guide-icon.svg",
          href: `guide-detail.html?id=${encodeURIComponent(id)}`,
        };
      });

    renderCards(gamesRoot, recentGames, "game");
    renderCards(guidesRoot, recentGuides, "guide");
  };

  // -------------------------
  // All Games Page
  // -------------------------

  // -------------------------
  // Game Compare（多选对比，localStorage 持久化）
  // -------------------------

  const COMPARE_LIMIT = 4;
  let compareDialogRoot = null;
  let compareDialogLastActive = null;

  const readCompareGames = () => readStringList(STORAGE_KEYS.compareGames).slice(0, COMPARE_LIMIT);

  const writeCompareGames = (list) => {
    return writeStringList(STORAGE_KEYS.compareGames, list).slice(0, COMPARE_LIMIT);
  };

  const clearCompareGames = () => writeCompareGames([]);

  const formatMaybe = (value, fallback = "—") => {
    const raw = String(value ?? "").trim();
    return raw ? raw : fallback;
  };

  const getCompareGame = (id) => {
    const data = getData();
    const game = data?.games?.[id] || null;
    const title = game?.title || id;

    return {
      id,
      title,
      icon: game?.icon || "images/icons/game-cover.svg",
      genre: game?.genre || "—",
      rating: typeof game?.rating === "number" ? String(game.rating) : "—",
      year: game?.year ? String(game.year) : "—",
      difficulty: game?.difficulty || "—",
      playtime: game?.playtime || "—",
      platforms: Array.isArray(game?.platforms) ? game.platforms.join(" / ") : "—",
      modes: Array.isArray(game?.modes) ? game.modes.join(" / ") : "—",
      updated: game?.updated ? formatDate(game.updated) : "—",
      tags: Array.isArray(game?.tags) ? game.tags.join("、") : "—",
      highlights: Array.isArray(game?.highlights) ? game.highlights.join("、") : "—",
      summary: game?.summary || "",
      deepGuideHref: game?.hasDeepGuide && game?.deepGuideHref ? String(game.deepGuideHref) : "",
    };
  };

  const ensureCompareDialog = () => {
    if (compareDialogRoot) return compareDialogRoot;

    const root = document.createElement("div");
    root.className = "compare-root";
    root.hidden = true;
    root.dataset.state = "closed";
    root.innerHTML = `
      <div class="compare-backdrop" data-action="compare-close" aria-hidden="true"></div>
      <div class="compare-panel" role="dialog" aria-modal="true" aria-label="游戏对比">
        <div class="compare-header">
          <div class="compare-header-title">
            <div class="compare-title">游戏对比</div>
            <div class="compare-subtitle">最多支持 ${COMPARE_LIMIT} 款游戏并排对照</div>
          </div>
          <div class="compare-header-actions">
            <button type="button" class="btn btn-small btn-secondary" data-action="compare-clear">清空对比</button>
            <button type="button" class="compare-close" data-action="compare-close" aria-label="关闭">Esc</button>
          </div>
        </div>
        <div class="compare-body"></div>
      </div>
    `;

    const close = () => {
      if (root.hidden) return;
      root.dataset.state = prefersReducedMotion() ? "closed" : "closing";
      document.body.classList.remove("compare-open");
      const finalize = () => {
        root.hidden = true;
        root.dataset.state = "closed";
        try {
          compareDialogLastActive?.focus?.();
        } catch (_) {}
      };
      if (prefersReducedMotion()) finalize();
      else window.setTimeout(finalize, 170);
    };

    root.addEventListener("click", (e) => {
      const action = e.target?.dataset?.action || "";
      if (action === "compare-close") close();
      if (action === "compare-clear") {
        clearCompareGames();
        close();
        toast({ title: "已清空", message: "对比列表已重置。", tone: "info" });
      }
    });

    window.addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") close();
    });

    // Focus trap（避免 Tab 跑到弹窗外）
    root.addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key !== "Tab") return;
      const focusable = $$(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        root
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.body.appendChild(root);
    compareDialogRoot = root;
    return root;
  };

  const renderCompareTable = (ids) => {
    const selected = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))).slice(
      0,
      COMPARE_LIMIT
    );

    if (selected.length < 2) {
      return `
        <div class="compare-empty">
          <div class="empty-title">至少选择 2 款游戏才能对比</div>
          <div class="empty-sub">去“所有游戏”页面勾选对比按钮即可。</div>
          <div class="empty-actions">
            <a class="btn btn-small" href="all-games.html">打开游戏库</a>
          </div>
        </div>
      `;
    }

    const games = selected.map(getCompareGame);

    const headCells = games
      .map((g) => {
        const detailHref = `game.html?id=${encodeURIComponent(g.id)}`;
        const primaryHref = g.deepGuideHref ? g.deepGuideHref : detailHref;
        const primaryLabel = g.deepGuideHref ? "完整攻略" : "详情页";

        return `
          <th class="compare-game">
            <div class="compare-game-head">
              <img class="compare-game-icon" src="${escapeHtml(g.icon)}" alt="${escapeHtml(g.title)}">
              <div class="compare-game-meta">
                <div class="compare-game-title">${escapeHtml(g.title)}</div>
                <div class="compare-game-links">
                  <a class="compare-link" href="${detailHref}">打开详情</a>
                  <span class="dot" aria-hidden="true">·</span>
                  <a class="compare-link" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a>
                </div>
              </div>
            </div>
          </th>
        `;
      })
      .join("");

    const row = (label, getter) => {
      const tds = games.map((g) => `<td>${escapeHtml(formatMaybe(getter(g)))}</td>`).join("");
      return `<tr><th class="compare-key">${escapeHtml(label)}</th>${tds}</tr>`;
    };

    return `
      <div class="compare-scroll">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-key">字段</th>
              ${headCells}
            </tr>
          </thead>
          <tbody>
            ${row("评分", (g) => g.rating)}
            ${row("类型", (g) => g.genre)}
            ${row("年份", (g) => g.year)}
            ${row("难度", (g) => g.difficulty)}
            ${row("通关时长", (g) => g.playtime)}
            ${row("平台", (g) => g.platforms)}
            ${row("模式", (g) => g.modes)}
            ${row("更新日期", (g) => g.updated)}
            ${row("标签", (g) => g.tags)}
            ${row("玩法重点", (g) => g.highlights)}
          </tbody>
        </table>
      </div>
    `;
  };

  const openGameCompare = (ids) => {
    const root = ensureCompareDialog();
    const body = $(".compare-body", root);
    if (!body) return false;

    compareDialogLastActive = document.activeElement;
    body.innerHTML = renderCompareTable(ids);
    root.hidden = false;
    root.dataset.state = "opening";
    document.body.classList.add("compare-open");
    window.requestAnimationFrame(() => {
      root.dataset.state = "open";
    });

    const closeBtn = $(".compare-close", root);
    closeBtn?.focus?.();
    return true;
  };

  const getCheckedValues = (name, root) =>
    $$(`input[name="${name}"]:checked`, root).map((el) => el.value);

  const matchesYear = (yearValue, selected) => {
    if (selected.length === 0) return true;
    const year = Number(yearValue);
    return selected.some((rule) => (rule === "older" ? year <= 2019 : String(year) === String(rule)));
  };

  const matchesRating = (ratingValue, selected) => {
    if (selected.length === 0) return true;
    const v = Number(ratingValue);
    return selected.some((rule) => {
      if (rule === "9+") return v >= 9;
      if (rule === "8-9") return v >= 8 && v < 9;
      if (rule === "7-8") return v >= 7 && v < 8;
      if (rule === "6-7") return v >= 6 && v < 7;
      if (rule === "<6") return v < 6;
      return true;
    });
  };

  const initAllGamesPage = () => {
    if (getPage() !== "all-games") return;

    const root = $(".games-container") || document;
    const listEl = $(".games-list", root);
    if (!listEl) return;

    const cards = $$(".game-card", listEl);
    const emptyEl = $("#games-empty", root);
    const countEl = $("#result-count", root);
    const activeFiltersEl = $("#active-filters", root);

    // NEW / UPDATED 标记（更新雷达）
    const applyUpdateBadges = () => {
      const data = getData();
      cards.forEach((card) => {
        const id = String(card.dataset.id || "").trim();
        const updatedValue = data?.games?.[id]?.updated || card.dataset.updated || "";
        const status = getUpdateStatus("games", id, updatedValue);

        const existing = $(".update-badge", card);
        if (existing) existing.remove();
        if (!status) return;

        const host = $(".game-image", card) || $(".game-overlay", card) || card;
        host.insertAdjacentHTML("beforeend", renderUpdateBadge(status));
      });
    };

    applyUpdateBadges();

    // 游戏对比（Compare Bar + 对比弹窗）
    let compareIds = readCompareGames();

    const getGameTitle = (id) => {
      const data = getData();
      const titleFromData = data?.games?.[id]?.title;
      if (titleFromData) return String(titleFromData);
      const card = cards.find((c) => String(c.dataset.id || "") === String(id));
      const titleFromCard = $("h3", card)?.textContent;
      return String(titleFromCard || id || "—");
    };

    const ensureCompareBar = () => {
      let bar = $("#compare-bar");
      if (bar) return bar;

      bar = document.createElement("div");
      bar.id = "compare-bar";
      bar.className = "compare-bar";
      bar.hidden = true;
      bar.dataset.state = "closed";
      bar.innerHTML = `
        <div class="compare-bar-inner">
          <div class="compare-bar-left">
            <div class="compare-bar-title">对比栏</div>
            <div class="compare-bar-count" aria-live="polite"></div>
            <div class="compare-bar-chips" aria-label="已选择的游戏"></div>
          </div>
          <div class="compare-bar-actions">
            <button type="button" class="btn btn-small" data-action="compare-open">开始对比</button>
            <button type="button" class="btn btn-small btn-secondary" data-action="compare-clear">清空</button>
          </div>
        </div>
      `;

      bar.addEventListener("click", (e) => {
        const action = e.target?.dataset?.action || e.target?.closest?.("[data-action]")?.dataset?.action || "";
        if (action === "compare-open") {
          const ids = readCompareGames();
          if (ids.length < 2) {
            toast({ title: "还差一点", message: "至少选择 2 款游戏才能对比。", tone: "warn" });
            return;
          }
          openGameCompare(ids);
          return;
        }

        if (action === "compare-clear") {
          clearCompareGames();
          syncCompareUi();
          toast({ title: "已清空", message: "对比列表已重置。", tone: "info" });
          return;
        }

        const removeBtn = e.target?.closest?.("[data-remove-id]");
        const removeId = removeBtn?.dataset?.removeId || "";
        if (removeId) {
          const next = readCompareGames().filter((x) => x !== removeId);
          writeCompareGames(next);
          syncCompareUi();
        }
      });

      document.body.appendChild(bar);
      return bar;
    };

    const ensureCompareButtons = () => {
      cards.forEach((card) => {
        const id = String(card.dataset.id || "").trim();
        if (!id) return;
        if ($(".compare-toggle", card)) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-small btn-outline compare-toggle";
        btn.dataset.compareId = id;
        btn.setAttribute("aria-pressed", "false");
        btn.textContent = "对比";

        const info = $(".game-info", card) || card;
        const anchor = $(".btn", info);
        if (anchor) anchor.insertAdjacentElement("beforebegin", btn);
        else info.appendChild(btn);
      });
    };

    const setCompareBarVisible = (bar, visible) => {
      if (!bar) return;

      if (visible) {
        if (!bar.hidden) return;
        bar.hidden = false;
        bar.dataset.state = "opening";
        window.requestAnimationFrame(() => {
          bar.dataset.state = "open";
        });
        return;
      }

      if (bar.hidden) return;
      bar.dataset.state = prefersReducedMotion() ? "closed" : "closing";
      const finalize = () => {
        bar.hidden = true;
        bar.dataset.state = "closed";
      };
      if (prefersReducedMotion()) finalize();
      else window.setTimeout(finalize, 190);
    };

    const syncCompareUi = () => {
      compareIds = readCompareGames();

      cards.forEach((card) => {
        const id = String(card.dataset.id || "").trim();
        if (!id) return;
        const btn = $(".compare-toggle", card);
        if (!btn) return;
        const active = compareIds.includes(id);
        btn.classList.toggle("btn-secondary", active);
        btn.classList.toggle("btn-outline", !active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.textContent = active ? "已选对比" : "对比";
      });

      const bar = ensureCompareBar();
      setCompareBarVisible(bar, compareIds.length > 0);

      const count = $(".compare-bar-count", bar);
      if (count) count.textContent = `已选 ${compareIds.length}/${COMPARE_LIMIT}`;

      const chips = $(".compare-bar-chips", bar);
      if (chips) {
        chips.innerHTML = compareIds
          .map((id) => {
            const title = getGameTitle(id);
            return `<button type="button" class="chip chip-btn compare-chip" data-remove-id="${escapeHtml(id)}" aria-label="移除 ${escapeHtml(title)}">${escapeHtml(title)}<span class="chip-x" aria-hidden="true">×</span></button>`;
          })
          .join("");
      }
    };

    ensureCompareButtons();
    syncCompareUi();

    // 事件委托：避免为每张卡片单独绑定 click listener（规模上来更稳）
    listEl.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".compare-toggle");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const id = String(btn.dataset.compareId || "").trim();
      if (!id) return;

      const current = readCompareGames();
      const set = new Set(current);

      if (set.has(id)) {
        set.delete(id);
        writeCompareGames(Array.from(set));
        toast({ title: "已移除", message: `已从对比栏移除「${getGameTitle(id)}」。`, tone: "info" });
      } else {
        if (current.length >= COMPARE_LIMIT) {
          toast({ title: "选择已达上限", message: `最多同时对比 ${COMPARE_LIMIT} 款游戏。`, tone: "warn" });
          return;
        }
        set.add(id);
        writeCompareGames(Array.from(set));
        toast({ title: "已加入对比", message: `已加入「${getGameTitle(id)}」。`, tone: "success" });
      }

      syncCompareUi();
    });

    const searchInput = $(".search-box input", root);
    const searchBtn = $(".search-btn", root);
    const applyBtn = $(".filter-apply-btn", root);
    const resetBtn = $(".filter-reset-btn", root);
    const sortSelect = $(".sort-options select", root);
    const gridBtn = $(".view-btn.grid-view", root);
    const listBtn = $(".view-btn.list-view", root);

    const readState = () => {
      const raw = storage.get(STORAGE_KEYS.allGamesState);
      return (
        safeJsonParse(raw, null) || {
          query: "",
          genres: [],
          platforms: [],
          years: [],
          ratings: [],
          savedOnly: false,
          sort: sortSelect?.value || "popular",
          view: "grid",
        }
      );
    };

    const writeState = (s) => storage.set(STORAGE_KEYS.allGamesState, JSON.stringify(s));

    const applyStateToUi = (s) => {
      if (searchInput) searchInput.value = s.query || "";
      const setChecked = (name, values) => {
        $$(`input[name="${name}"]`, root).forEach((el) => (el.checked = (values || []).includes(el.value)));
      };
      setChecked("genre", s.genres);
      setChecked("platform", s.platforms);
      setChecked("year", s.years);
      setChecked("rating", s.ratings);
      setChecked("saved", s.savedOnly ? ["saved"] : []);

      if (sortSelect) sortSelect.value = s.sort || "popular";

      const isList = (s.view || "grid") === "list";
      listEl.classList.toggle("list-view-active", isList);
      gridBtn?.classList.toggle("active", !isList);
      listBtn?.classList.toggle("active", isList);
    };

    const stateFromUi = () => ({
      query: searchInput?.value?.trim() || "",
      genres: getCheckedValues("genre", root),
      platforms: getCheckedValues("platform", root),
      years: getCheckedValues("year", root),
      ratings: getCheckedValues("rating", root),
      savedOnly: getCheckedValues("saved", root).includes("saved"),
      sort: sortSelect?.value || "popular",
      view: listEl.classList.contains("list-view-active") ? "list" : "grid",
    });

    const originalCards = cards.slice();
    let lastSortKey = "";

    const sort = (sortKey) => {
      const key = sortKey || "popular";
      if (key === lastSortKey) return;
      lastSortKey = key;

      if (key === "popular") {
        originalCards.forEach((c) => listEl.appendChild(c));
        return;
      }

      const comparator = (a, b) => {
        const ra = Number(a.dataset.rating || 0);
        const rb = Number(b.dataset.rating || 0);
        const ya = Number(a.dataset.year || 0);
        const yb = Number(b.dataset.year || 0);
        const ua = Number(a.dataset.updated || a.dataset.year || 0);
        const ub = Number(b.dataset.updated || b.dataset.year || 0);
        if (key === "latest") return ub - ua;
        if (key === "rating-desc") return rb - ra;
        if (key === "rating-asc") return ra - rb;
        if (key === "year-desc") return yb - ya;
        if (key === "year-asc") return ya - yb;
        return 0;
      };
      cards.sort(comparator).forEach((c) => listEl.appendChild(c));
    };

    let activeFilterChips = [];
    let activeFilterBound = false;

    const ensureActiveFilterDelegate = () => {
      if (activeFilterBound) return;
      if (!activeFiltersEl) return;
      activeFilterBound = true;

      activeFiltersEl.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("[data-chip]");
        if (!btn || !activeFiltersEl.contains(btn)) return;
        const idx = Number(btn.dataset.chip || 0);
        const chip = activeFilterChips[idx];
        if (!chip) return;
        chip.onClear?.();
        sync();
      });
    };

    const filter = (s) => {
      const q = (s.query || "").toLowerCase();
      const savedSet = new Set(readStringList(STORAGE_KEYS.savedGames));
      let shown = 0;

      cards.forEach((card) => {
        const title = ($("h3", card)?.textContent || "").toLowerCase();
        const desc = ($("p", card)?.textContent || "").toLowerCase();
        const blob = `${title} ${desc}`;

        const genre = card.dataset.genre || "";
        const gid = card.dataset.id || "";
        const platformTokens = (card.dataset.platform || "").split(/\s+/).filter(Boolean);
        const year = card.dataset.year || "";
        const rating = card.dataset.rating || "0";

        const okQuery = !q || blob.includes(q);
        const okGenre = s.genres.length === 0 || s.genres.includes(genre);
        const okPlatform =
          s.platforms.length === 0 || platformTokens.some((p) => s.platforms.includes(p));
        const okYear = matchesYear(year, s.years);
        const okRating = matchesRating(rating, s.ratings);

        const okSaved = !s.savedOnly || (gid && savedSet.has(gid));
        card.dataset.saved = gid && savedSet.has(gid) ? "true" : "false";
        const visible = okQuery && okGenre && okPlatform && okYear && okRating && okSaved;
        card.hidden = !visible;
        if (visible) shown += 1;
      });

      if (emptyEl) emptyEl.hidden = shown !== 0;
      if (countEl) countEl.textContent = `共 ${shown} 个结果`;
    };

    const renderActiveFilters = (s) => {
      if (!activeFiltersEl) return;
      ensureActiveFilterDelegate();
      const chips = [];

      const pushChip = (label, onClear) => {
        chips.push({ label, onClear });
      };

      if (s.query) {
        pushChip(`关键词：${s.query}`, () => {
          if (searchInput) searchInput.value = "";
        });
      }

      s.genres.forEach((g) =>
        pushChip(`类型：${g}`, () => {
          $$('input[name="genre"]', root).forEach((el) => {
            if (el.value === g) el.checked = false;
          });
        })
      );

      s.platforms.forEach((p) =>
        pushChip(`平台：${p}`, () => {
          $$('input[name="platform"]', root).forEach((el) => {
            if (el.value === p) el.checked = false;
          });
        })
      );

      s.years.forEach((y) =>
        pushChip(`年份：${y}`, () => {
          $$('input[name="year"]', root).forEach((el) => {
            if (el.value === y) el.checked = false;
          });
        })
      );

      s.ratings.forEach((r) =>
        pushChip(`评分：${r}`, () => {
          $$('input[name="rating"]', root).forEach((el) => {
            if (el.value === r) el.checked = false;
          });
        })
      );

      if (s.savedOnly) {
        pushChip("只看收藏", () => {
          $$('input[name="saved"]', root).forEach((el) => (el.checked = false));
        });
      }

      if (chips.length === 0) {
        activeFiltersEl.innerHTML = "";
        activeFilterChips = [];
        return;
      }

      activeFilterChips = chips;
      activeFiltersEl.innerHTML = chips
        .map((chip, idx) => {
          return `<button type="button" class="filter-chip" data-chip="${idx}">${escapeHtml(
            chip.label
          )}<span class="chip-x">×</span></button>`;
        })
        .join("");
    };

    const syncUrl = (s) => {
      try {
        const params = new URLSearchParams();
        if (s.query) params.set("q", s.query);
        if (s.genres.length > 0) params.set("genre", s.genres.join(","));
        if (s.platforms.length > 0) params.set("platform", s.platforms.join(","));
        if (s.years.length > 0) params.set("year", s.years.join(","));
        if (s.ratings.length > 0) params.set("rating", s.ratings.join(","));
        if (s.savedOnly) params.set("saved", "1");
        if (s.sort && s.sort !== "popular") params.set("sort", s.sort);
        if (s.view === "list") params.set("view", "list");
        const next = params.toString();
        const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState(null, "", url);
      } catch (_) {}
    };

    const sync = () => {
      const s = stateFromUi();
      sort(s.sort);
      filter(s);
      renderActiveFilters(s);
      writeState(s);
      syncUrl(s);
    };

    // 初始化状态：URL > localStorage > default
    let s = readState();

    const readUrlParams = () => {
      try {
        const params = new URLSearchParams(window.location.search);

        const readList = (key) => {
          const raw = params
            .getAll(key)
            .flatMap((v) => String(v || "").split(","))
            .map((v) => v.trim())
            .filter(Boolean);
          return Array.from(new Set(raw));
        };

        const q = String(params.get("q") || params.get("query") || "").trim();
        const reset = params.get("reset") === "1";
        const sortKey = String(params.get("sort") || "").trim();
        const savedOnly = params.get("saved") === "1";
        const view = String(params.get("view") || "").trim();

        return {
          reset,
          query: q,
          genres: readList("genre"),
          platforms: readList("platform"),
          years: readList("year"),
          ratings: readList("rating"),
          savedOnly,
          sort: sortKey,
          view,
        };
      } catch (_) {
        return {
          reset: false,
          query: "",
          genres: [],
          platforms: [],
          years: [],
          ratings: [],
          savedOnly: false,
          sort: "",
          view: "",
        };
      }
    };

    const url = readUrlParams();
    if (url.reset) {
      s = {
        query: "",
        genres: [],
        platforms: [],
        years: [],
        ratings: [],
        savedOnly: false,
        sort: sortSelect?.value || "popular",
        view: "grid",
      };
    }

    const filterKnown = (name, values) => {
      const known = new Set($$(`input[name="${name}"]`, root).map((el) => el.value));
      return (Array.isArray(values) ? values : []).filter((v) => known.has(v));
    };

    if (url.query) s.query = url.query;

    if (url.genres.length > 0) {
      const nextGenres = filterKnown("genre", url.genres);
      if (nextGenres.length > 0) s.genres = nextGenres;
    }
    if (url.platforms.length > 0) {
      const nextPlatforms = filterKnown("platform", url.platforms);
      if (nextPlatforms.length > 0) s.platforms = nextPlatforms;
    }
    if (url.years.length > 0) {
      const nextYears = filterKnown("year", url.years);
      if (nextYears.length > 0) s.years = nextYears;
    }
    if (url.ratings.length > 0) {
      const nextRatings = filterKnown("rating", url.ratings);
      if (nextRatings.length > 0) s.ratings = nextRatings;
    }

    if (url.savedOnly) s.savedOnly = true;

    if (sortSelect) {
      const sortOptions = new Set($$("option", sortSelect).map((opt) => opt.value).filter(Boolean));
      if (url.sort && sortOptions.has(url.sort)) s.sort = url.sort;
    }

    if (url.view === "grid" || url.view === "list") s.view = url.view;

    applyStateToUi(s);
    sync();

    const onSubmitLike = (e) => {
      e?.preventDefault?.();
      sync();
    };

    applyBtn?.addEventListener("click", onSubmitLike);
    searchBtn?.addEventListener("click", onSubmitLike);
    sortSelect?.addEventListener("change", onSubmitLike);

    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSubmitLike(e);
      });
      let t = 0;
      searchInput.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(sync, 180);
      });
    }

    resetBtn?.addEventListener("click", () => {
      s = { query: "", genres: [], platforms: [], years: [], ratings: [], sort: "popular", view: "grid" };
      applyStateToUi(s);
      sync();
    });

    gridBtn?.addEventListener("click", () => {
      listEl.classList.remove("list-view-active");
      gridBtn.classList.add("active");
      listBtn?.classList.remove("active");
      sync();
    });

    listBtn?.addEventListener("click", () => {
      listEl.classList.add("list-view-active");
      listBtn.classList.add("active");
      gridBtn?.classList.remove("active");
      sync();
    });
  };

  // -------------------------
  // All Guides Page
  // -------------------------

  const initAllGuidesPage = () => {
    if (getPage() !== "all-guides") return;

    const data = getData();
    const guides = data?.guides;
    const grid = $("#guides-grid");
    if (!guides || !grid) return;

    const empty = $("#guides-empty");
    const clearBtn = $("#guides-clear");
    const tagRoot = $("#guide-tags");
    const searchInput = $("#guide-search");
    const searchBtn = $("#guide-search-btn");
    const sortSelect = $("#guide-sort");
    const countEl = $("#guides-count");

    const items = Object.entries(guides).map(([id, guide]) => ({ id, guide }));
    const allTags = Array.from(
      new Set(items.flatMap((x) => (Array.isArray(x.guide.tags) ? x.guide.tags : [])).map(String))
    )
      .slice(0, 16)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    const readState = () => {
      const raw = storage.get(STORAGE_KEYS.allGuidesState);
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object") return { query: "", tags: [], savedOnly: false, sort: "default" };
      return {
        query: String(parsed.query || ""),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        savedOnly: Boolean(parsed.savedOnly),
        sort: String(parsed.sort || "default"),
      };
    };
    const writeState = (s) => storage.set(STORAGE_KEYS.allGuidesState, JSON.stringify(s));

    let state = readState();
    let saved = new Set(readStringList(STORAGE_KEYS.savedGuides));

    // 初始化状态：URL > localStorage > default（便于分享“筛选后的链接”）
    const readUrlParams = () => {
      try {
        const params = new URLSearchParams(window.location.search);

        const readList = (key) => {
          const raw = params
            .getAll(key)
            .flatMap((v) => String(v || "").split(","))
            .map((v) => v.trim())
            .filter(Boolean);
          return Array.from(new Set(raw));
        };

        const q = String(params.get("q") || params.get("query") || "").trim();
        const tags = [...readList("tag"), ...readList("tags")];
        const reset = params.get("reset") === "1";
        const savedOnlyRaw = String(params.get("saved") || params.get("savedOnly") || "").trim().toLowerCase();
        const savedOnly = savedOnlyRaw === "1" || savedOnlyRaw === "true";
        const sort = String(params.get("sort") || "").trim();

        return { reset, query: q, tags, savedOnly, sort };
      } catch (_) {
        return { reset: false, query: "", tags: [], savedOnly: false, sort: "" };
      }
    };

    const url = readUrlParams();
    if (url.reset) state = { query: "", tags: [], savedOnly: false, sort: "default" };

    if (url.query) state = { ...state, query: url.query };
    if (url.tags.length > 0) {
      const known = new Set(allTags);
      const nextTags = url.tags.filter((t) => known.has(t));
      if (nextTags.length > 0) state = { ...state, tags: nextTags };
    }
    if (url.savedOnly) state = { ...state, savedOnly: true };
    if (url.sort) state = { ...state, sort: url.sort };

    const renderTags = () => {
      if (!tagRoot) return;
      const savedActive = state.savedOnly ? "active" : "";
      const savedChip = `<button type="button" class="chip chip-btn chip-saved ${savedActive}" data-action="saved-only">只看收藏</button>`;
      tagRoot.innerHTML =
        savedChip +
        allTags
          .map((t) => {
            const active = state.tags.includes(t);
            return `<button type="button" class="chip chip-btn ${active ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
          })
          .join("");
    };

    // 事件委托：避免每次 renderTags 都为每个 chip 绑定 click
    tagRoot?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".chip-btn");
      if (!btn || !tagRoot.contains(btn)) return;

      const action = btn.dataset.action || "";
      if (action === "saved-only") {
        state.savedOnly = !state.savedOnly;
        writeState(state);
        renderTags();
        apply();
        return;
      }

      const t = btn.dataset.tag || "";
      if (!t) return;
      state.tags = state.tags.includes(t) ? state.tags.filter((x) => x !== t) : [...state.tags, t];
      writeState(state);
      renderTags();
      apply();
    });

    const syncUrl = () => {
      try {
        const params = new URLSearchParams();
        if (state.query) params.set("q", state.query);
        if (state.tags.length > 0) params.set("tag", state.tags.join(","));
        if (state.savedOnly) params.set("saved", "1");
        if (state.sort && state.sort !== "default") params.set("sort", state.sort);
        const next = params.toString();
        const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState(null, "", url);
      } catch (_) {}
    };

    const renderCard = (id, guide) => {
      const icon = guide.icon || "images/icons/guide-icon.svg";
      const title = guide.title || id;
      const summary = guide.summary || "该攻略正在整理中。";
      const tags = Array.isArray(guide.tags) ? guide.tags : [];
      const status = getUpdateStatus("guides", id, guide.updated);
      const updated = guide.updated ? `更新 ${formatDate(guide.updated)}` : "更新待补";
      const difficulty = guide.difficulty ? `难度 ${guide.difficulty}` : "难度 待补";
      const readingTime =
        typeof guide.readingTime === "number" && Number.isFinite(guide.readingTime)
          ? `${guide.readingTime} 分钟`
          : `${Math.max(3, Math.round(String(summary).length / 18))} 分钟`;
      const isSaved = saved.has(id);
      const saveLabel = isSaved ? "取消收藏" : "收藏";
      const saveStar = isSaved ? "★" : "☆";
      const chips =
        tags.length > 0
          ? `<div class="chips-inline">${tags.slice(0, 4).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>`
          : "";
      const meta = `
        <div class="meta-pills">
          <span class="meta-pill small">${escapeHtml(updated)}</span>
          <span class="meta-pill small">${escapeHtml(difficulty)}</span>
          <span class="meta-pill small">阅读 ${escapeHtml(readingTime)}</span>
        </div>
      `;

      return `
        <div class="game-card guide-card fade-in-up ${isSaved ? "is-saved" : ""}">
          <div class="game-card-image">
            <img src="${icon}" alt="${escapeHtml(title)}">
          </div>
          <div class="game-card-content">
            <h3 class="game-card-title">${escapeHtml(title)} ${renderUpdateBadge(status)}</h3>
            <p class="game-card-description">${escapeHtml(summary)}</p>
            ${chips}
            ${meta}
            <div class="card-actions">
              <a href="guide-detail.html?id=${encodeURIComponent(id)}" class="btn btn-small">阅读全文</a>
              <button type="button" class="save-pill ${isSaved ? "active" : ""}" data-guide-id="${escapeHtml(id)}" aria-pressed="${isSaved ? "true" : "false"}" aria-label="${escapeHtml(saveLabel)}">
                <span class="save-star" aria-hidden="true">${saveStar}</span>
                <span class="save-text">${escapeHtml(saveLabel)}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    };

    const getGuideReading = (guide) => {
      if (typeof guide?.readingTime === "number" && Number.isFinite(guide.readingTime)) {
        return guide.readingTime;
      }
      const summary = String(guide?.summary || "");
      return Math.max(3, Math.round(summary.length / 18));
    };

    const getGuideUpdated = (guide) => parseDateKey(guide?.updated);

    const syncGuideSaveUi = (btn, isSaved) => {
      if (!btn) return;
      btn.classList.toggle("active", Boolean(isSaved));
      btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
      btn.setAttribute("aria-label", isSaved ? "取消收藏" : "收藏");

      const star = $(".save-star", btn);
      if (star) star.textContent = isSaved ? "★" : "☆";
      const text = $(".save-text", btn);
      if (text) text.textContent = isSaved ? "取消收藏" : "收藏";
    };

    // 事件委托：避免每次 apply 重新绑定 N 个按钮监听器
    grid.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".save-pill");
      if (!btn || !grid.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();

      const gid = btn.dataset.guideId || "";
      if (!gid) return;

      const had = saved.has(gid);
      if (had) saved.delete(gid);
      else saved.add(gid);
      writeStringList(STORAGE_KEYS.savedGuides, Array.from(saved));

      toast({
        title: had ? "已取消收藏" : "已收藏",
        message: "偏好已保存到本地浏览器。",
        tone: had ? "info" : "success",
      });

      // 只看收藏：取消收藏会导致当前卡片需要被移除（直接重算列表）
      if (state.savedOnly && had) {
        apply();
        return;
      }

      syncGuideSaveUi(btn, !had);
      btn.closest?.(".guide-card")?.classList.toggle("is-saved", !had);
    });

    const apply = () => {
      saved = new Set(readStringList(STORAGE_KEYS.savedGuides));
      const q = (state.query || "").trim().toLowerCase();
      const tagSet = new Set(state.tags);

      const filtered = items.filter(({ id, guide }) => {
        const title = String(guide.title || id).toLowerCase();
        const summary = String(guide.summary || "").toLowerCase();
        const tags = Array.isArray(guide.tags) ? guide.tags.map(String) : [];
        const okQuery = !q || `${title} ${summary}`.includes(q);
        const okTags = tagSet.size === 0 || tags.some((t) => tagSet.has(t));
        const okSaved = !state.savedOnly || saved.has(id);
        return okQuery && okTags && okSaved;
      });

      const sorted = [...filtered];
      const sortKey = state.sort || "default";
      if (sortKey !== "default") {
        sorted.sort((a, b) => {
          if (sortKey === "updated-desc") return getGuideUpdated(b.guide) - getGuideUpdated(a.guide);
          if (sortKey === "reading-asc") return getGuideReading(a.guide) - getGuideReading(b.guide);
          if (sortKey === "reading-desc") return getGuideReading(b.guide) - getGuideReading(a.guide);
          if (sortKey === "difficulty-asc") return difficultyRank(a.guide?.difficulty) - difficultyRank(b.guide?.difficulty);
          if (sortKey === "difficulty-desc") return difficultyRank(b.guide?.difficulty) - difficultyRank(a.guide?.difficulty);
          return 0;
        });
      }

      withViewTransition(() => {
        grid.innerHTML = sorted.length > 0 ? sorted.map(({ id, guide }) => renderCard(id, guide)).join("") : "";
        if (countEl) countEl.textContent = `共 ${sorted.length} 条攻略`;
        if (empty) empty.hidden = sorted.length !== 0;
      });
      syncUrl();
    };

    if (searchInput) searchInput.value = state.query || "";
    if (sortSelect) {
      const options = new Set($$("option", sortSelect).map((opt) => opt.value).filter(Boolean));
      if (!options.has(state.sort)) state.sort = "default";
      sortSelect.value = state.sort || "default";
    }
    renderTags();
    apply();

    const syncFromInput = () => {
      state = { ...state, query: searchInput?.value?.trim() || "" };
      writeState(state);
      apply();
    };

    searchBtn?.addEventListener("click", syncFromInput);
    sortSelect?.addEventListener("change", () => {
      state = { ...state, sort: String(sortSelect.value || "default") };
      writeState(state);
      apply();
    });
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          syncFromInput();
        }
      });
      let t = 0;
      searchInput.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(syncFromInput, 180);
      });
    }

    clearBtn?.addEventListener("click", () => {
      state = { query: "", tags: [], savedOnly: false, sort: "default" };
      writeState(state);
      if (searchInput) searchInput.value = "";
      if (sortSelect) sortSelect.value = "default";
      renderTags();
      apply();
    });
  };

  // -------------------------
  // Guide Detail Page
  // -------------------------

  const initGuideDetailPage = () => {
    if (getPage() !== "guide") return;

    const id = getParam("id") || "";
    const guide = getData()?.guides?.[id] || null;

    const titleEl = $("#guide-title");
    const summaryEl = $("#guide-summary");
    const iconEl = $("#guide-icon");
    const tagEl = $("#guide-tag");
    const contentEl = $("#guide-content");
    const tocEl = $("#guide-toc");
    const saveBtn = $("#guide-save");
    const updatedEl = $("#guide-updated");
    const difficultyEl = $("#guide-difficulty");
    const readingTimeEl = $("#guide-reading-time");
    const readingToggle = $("#guide-reading-toggle");
    const progressPill = $("#guide-progress-pill");
    const continueBtn = $("#guide-continue");
    const outlineEl = $("#guide-outline");
    const fontButtons = $$("[data-guide-font]");
    const lineButtons = $$("[data-guide-line]");
    const checklistEl = $("#guide-checklist");
    const progressBar = $("#guide-progress-bar");
    const progressMeta = $("#guide-progress-meta");
    const notesTextarea = $("#guide-notes");
    const notesSaveBtn = $("#guide-notes-save");
    const notesClearBtn = $("#guide-notes-clear");
    const notesStatus = $("#guide-notes-status");

    const title = guide?.title || (id ? `攻略：${id}` : "攻略详情");
    const summary =
      guide?.summary || "该攻略正在整理中。你依然可以先收藏到本地，后续再回来看更新。";

    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary;
    if (iconEl) iconEl.src = guide?.icon || "images/icons/guide-icon.svg";
    if (tagEl) tagEl.textContent = (guide?.tags && guide.tags[0]) || "攻略";
    if (updatedEl) updatedEl.textContent = `更新：${formatDate(guide?.updated)}`;
    if (difficultyEl) difficultyEl.textContent = `难度：${guide?.difficulty || "通用"}`;
    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({
      title: document.title,
      description: summary,
      image: guide?.icon || "images/icons/guide-icon.svg",
    });
    if (id) pushRecent(STORAGE_KEYS.recentGuides, id, 12);
    if (id) markItemSeen("guides", id, guide?.updated);

    if (contentEl) {
      const tags = Array.isArray(guide?.tags) ? guide.tags : [];
      const tagLine =
        tags.length > 0
          ? `<p class="article-tags">${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</p>`
          : "";

      contentEl.innerHTML = `
        <h2>这篇攻略能帮你解决什么？</h2>
        <p>${escapeHtml(summary)}</p>
        ${tagLine}

        <h2>执行步骤（建议按顺序）</h2>
        <ol class="step-list">
          <li>先明确目标：通关 / 收集 / 提升效率 / 挑战难度。</li>
          <li>列出限制：平台、版本、当前进度、可用资源（装备/等级/队伍）。</li>
          <li>拆成三段：准备 → 执行 → 校验（复盘最常犯的错误点）。</li>
          <li>遇到卡点：优先“读机制”，再考虑数值与操作练习。</li>
        </ol>

        <h2>常见误区</h2>
        <ul class="bullet-list">
          <li>只看结论不看前置条件：不同 Build 的答案可能完全相反。</li>
          <li>路线走错后硬顶：效率来自“正确顺序”，不是无脑堆时间。</li>
          <li>把运气当机制：先确认触发条件与掉落/刷新规则。</li>
        </ul>

        <h2>延伸阅读</h2>
        <div class="empty-actions">
          <a class="btn btn-small" href="all-guides.html">查看所有攻略</a>
          <a class="btn btn-small btn-secondary" href="all-games.html">回到游戏库</a>
        </div>
      `;
    }

    if (readingTimeEl && contentEl) {
      const fallbackText = contentEl.textContent || "";
      const words = fallbackText.replace(/\s+/g, "").length;
      const fallbackMinutes = Math.max(1, Math.round(words / 320));
      const minutes =
        typeof guide?.readingTime === "number" && Number.isFinite(guide.readingTime)
          ? Math.max(1, Math.round(guide.readingTime))
          : fallbackMinutes;
      readingTimeEl.textContent = `阅读时长：约 ${minutes} 分钟`;
    }

    if (tocEl && contentEl) {
      const headings = $$("h2, h3", contentEl);
      if (headings.length === 0) {
        tocEl.innerHTML = '<p class="toc-empty">暂无目录</p>';
      } else {
        headings.forEach((h, idx) => {
          if (!h.id) h.id = `sec-${idx + 1}`;
        });
        tocEl.innerHTML = headings
          .map((h) => {
            const level = h.tagName.toLowerCase();
            return `<a class="toc-link ${level}" href="#${h.id}">${escapeHtml(h.textContent || "")}</a>`;
          })
          .join("");
      }
    }

    if (outlineEl && contentEl) {
      const headings = $$("h2", contentEl);
      if (headings.length === 0) {
        outlineEl.innerHTML = "";
      } else {
        outlineEl.innerHTML = headings
          .slice(0, 6)
          .map((h, idx) => {
            if (!h.id) h.id = `sec-${idx + 1}`;
            return `<a class="outline-chip" href="#${h.id}">${escapeHtml(h.textContent || "")}</a>`;
          })
          .join("");
      }
    }

    const lastSectionKey = id ? `${STORAGE_KEYS.guideLastSectionPrefix}${id}` : "";

    if (continueBtn && lastSectionKey) {
      const savedRaw = storage.get(lastSectionKey);
      const saved = safeJsonParse(savedRaw, null);
      const savedHash = typeof saved === "string" ? saved : saved?.hash;
      const savedTitle = saved?.title;
      if (savedHash) {
        continueBtn.hidden = false;
        if (savedTitle) continueBtn.textContent = `继续阅读：${savedTitle}`;
        continueBtn.addEventListener("click", () => {
          const target = document.querySelector(savedHash);
          if (target) {
            target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
          }
        });
      }
    }

    const initHeadingAnchors = () => {
      if (!contentEl) return;
      const headings = $$("h2, h3", contentEl);
      headings.forEach((h, idx) => {
        if (!h.id) h.id = `sec-${idx + 1}`;
        if ($(".heading-anchor", h)) return;
        h.classList.add("heading-with-anchor");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "heading-anchor";
        btn.setAttribute("aria-label", "复制小节链接");
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.86a5 5 0 0 0-1.46 3.54h2a3 3 0 0 1 .88-2.12l1.83-1.83a3 3 0 1 1 4.24 4.24l-2.83 2.83a3 3 0 0 1-4.24 0l-1-1-1.41 1.41 1 1zM14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07l1.83-1.83A5 5 0 0 0 14.82 15h-2a3 3 0 0 1-.88 2.12l-1.83 1.83a3 3 0 1 1-4.24-4.24l2.83-2.83a3 3 0 0 1 4.24 0l1 1 1.41-1.41-1-1z"/>
          </svg>
        `;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          copySectionLink(`#${h.id}`);
        });
        h.appendChild(btn);
      });
    };

    initHeadingAnchors();

    const initTocHighlight = () => {
      if (!tocEl) return;
      const links = $$(".toc-link", tocEl);
      if (links.length === 0) return;
      const outlineLinks = outlineEl ? $$("a", outlineEl) : [];
      const sections = links
        .map((link) => {
          const id = link.getAttribute("href") || "";
          const target = id ? document.querySelector(id) : null;
          return target ? { link, target } : null;
        })
        .filter(Boolean);
      if (sections.length === 0) return;

      const update = () => {
        const offset = window.scrollY + 160;
        let active = sections[0];
        sections.forEach((item) => {
          if (item.target.offsetTop <= offset) active = item;
        });
        sections.forEach((item) => item.link.classList.toggle("active", item === active));
        if (outlineLinks.length > 0 && active?.target?.id) {
          const hash = `#${active.target.id}`;
          outlineLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === hash);
          });
        }
        if (lastSectionKey && active?.target?.id) {
          const payload = { hash: `#${active.target.id}`, title: active.target.textContent || "" };
          storage.set(lastSectionKey, JSON.stringify(payload));
          if (continueBtn) {
            continueBtn.hidden = false;
            if (payload.title) continueBtn.textContent = `继续阅读：${payload.title}`;
          }
        }
      };

      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
    };

    initTocHighlight();

    const initChecklist = () => {
      if (!checklistEl || !progressBar || !progressMeta) return;
      if (!id) {
        checklistEl.innerHTML = '<p class="toc-empty">缺少攻略 id，无法记录进度。</p>';
        progressMeta.textContent = "已完成 0/0";
        progressBar.style.width = "0%";
        if (progressPill) progressPill.textContent = "完成度：—";
        return;
      }

      const fallbackSteps = [
        "明确目标与限制条件",
        "标记关键机制与触发条件",
        "准备核心资源与配置",
        "执行路线并记录卡点",
        "复盘并写下下一步行动",
      ];
      const steps = Array.isArray(guide?.steps) && guide.steps.length > 0 ? guide.steps : fallbackSteps;
      const key = `${STORAGE_KEYS.guideChecklistPrefix}${id}`;
      let saved = new Set(readStringList(key));

      const stepIdFor = (idx) => `step-${idx + 1}`;

      const syncProgress = () => {
        const total = steps.length;
        const done = steps.reduce((acc, _step, idx) => acc + (saved.has(stepIdFor(idx)) ? 1 : 0), 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        progressMeta.textContent = `已完成 ${done}/${total} · ${pct}%`;
        progressBar.style.width = `${pct}%`;
        if (progressPill) progressPill.textContent = `完成度：${pct}%`;
      };

      const render = () => {
        checklistEl.innerHTML = steps
          .map((step, idx) => {
            const stepId = stepIdFor(idx);
            const checked = saved.has(stepId);
            return `
              <label class="checklist-item">
                <input type="checkbox" data-step="${stepId}" ${checked ? "checked" : ""}>
                <span>${escapeHtml(step)}</span>
              </label>
            `;
          })
          .join("");
        $$('input[type="checkbox"]', checklistEl).forEach((input) => {
          input.addEventListener("change", () => {
            const stepId = input.dataset.step || "";
            if (!stepId) return;
            if (input.checked) saved.add(stepId);
            else saved.delete(stepId);
            writeStringList(key, Array.from(saved));
            syncProgress();
          });
        });
        syncProgress();
      };

      render();
    };

    initChecklist();

    const initReadingProgress = () => {
      const bar = $("#guide-reading-progress");
      if (!bar || !contentEl) return;

      const update = () => {
        const rect = contentEl.getBoundingClientRect();
        const start = window.scrollY + rect.top - 140;
        const height = contentEl.scrollHeight;
        const viewport = window.innerHeight || 0;
        const max = Math.max(1, height - viewport * 0.35);
        const progress = (window.scrollY - start) / max;
        const pct = Math.min(1, Math.max(0, progress));
        bar.style.width = `${Math.round(pct * 100)}%`;
      };

      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
    };

    initReadingProgress();

    const initReadingMode = () => {
      if (!readingToggle) return;
      const saved = storage.get(STORAGE_KEYS.guideReadingMode);
      setGuideReadingMode(saved === "1");

      readingToggle.addEventListener("click", () => {
        const next = !document.body.classList.contains("reading-mode");
        setGuideReadingMode(next);
      });
    };

    initReadingMode();

    const initReadingControls = () => {
      const savedFont = storage.get(STORAGE_KEYS.guideFontSize) || "md";
      const savedLine = storage.get(STORAGE_KEYS.guideLineHeight) || "normal";

      setGuideFont(savedFont);
      setGuideLine(savedLine);

      fontButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.guideFont || "md";
          setGuideFont(value);
        });
      });

      lineButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.guideLine || "normal";
          setGuideLine(value);
        });
      });

      window.addEventListener("keydown", (e) => {
        const tag = String(document.activeElement?.tagName || "").toLowerCase();
        const isTyping = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;
        if (isTyping) return;
        if (getPage() !== "guide") return;
        if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          setGuideReadingMode(!document.body.classList.contains("reading-mode"));
        }
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setGuideFont("lg");
        }
        if (e.key === "-") {
          e.preventDefault();
          setGuideFont("sm");
        }
        if (e.key.toLowerCase() === "l") {
          e.preventDefault();
          const current = storage.get(STORAGE_KEYS.guideLineHeight) || "normal";
          setGuideLine(current === "normal" ? "relaxed" : "normal");
        }
      });
    };

    initReadingControls();

    const syncSaveButton = () => {
      if (!saveBtn) return;
      const set = new Set(readStringList(STORAGE_KEYS.savedGuides));
      const isSaved = id && set.has(id);
      saveBtn.textContent = isSaved ? "已收藏（点击取消）" : "收藏到本地";
      saveBtn.setAttribute("aria-pressed", isSaved ? "true" : "false");
      saveBtn.classList.toggle("btn-secondary", Boolean(isSaved));
    };

    syncSaveButton();

    saveBtn?.addEventListener("click", () => {
      if (!id) {
        toast({ title: "暂不可收藏", message: "缺少攻略 id（链接不完整）。", tone: "warn" });
        return;
      }
      const set = new Set(readStringList(STORAGE_KEYS.savedGuides));
      const isSaved = set.has(id);
      if (isSaved) set.delete(id);
      else set.add(id);
      writeStringList(STORAGE_KEYS.savedGuides, Array.from(set));
      toast({
        title: isSaved ? "已取消收藏" : "已收藏",
        message: "已保存到本地浏览器。",
        tone: isSaved ? "info" : "success",
      });
      syncSaveButton();
    });

    initNotesPanel({
      id,
      textarea: notesTextarea,
      saveBtn: notesSaveBtn,
      clearBtn: notesClearBtn,
      statusEl: notesStatus,
      storageKey: STORAGE_KEYS.guideNotesPrefix,
    });
  };

  // -------------------------
  // Game Page
  // -------------------------

  const initGamePage = () => {
    if (getPage() !== "game") return;

    const id = getParam("id") || "";
    const data = getData();
    const game = id ? data?.games?.[id] : null;

    const titleEl = $("#game-title");
    const subtitleEl = $("#game-subtitle");
    const iconEl = $("#game-icon");
    const yearBadge = $("#game-year-badge");
    const metaEl = $("#game-meta");
    const genreEl = $("#game-meta-genre");
    const ratingEl = $("#game-meta-rating");
    const platformsEl = $("#game-meta-platforms");
    const difficultyEl = $("#game-meta-difficulty");
    const playtimeEl = $("#game-meta-playtime");
    const modesEl = $("#game-meta-modes");
    const updatedEl = $("#game-meta-updated");
    const summaryEl = $("#game-summary");
    const guidesEl = $("#game-guides");
    const primaryAction = $("#game-primary-action");
    const communityAction = $("#game-community-action");
    const topicLink = $("#game-topic-link");
    const saveGameBtn = $("#game-save");
    const tagsEl = $("#game-tags");
    const highlightsEl = $("#game-highlights");

    const title = game?.title || (id ? `游戏：${id}` : "游戏详情");
    const subtitle = game?.subtitle || "该游戏详情正在建设中，我们会逐步补全攻略体系。";
    const icon = game?.icon || "images/icons/game-cover.svg";
    const year = game?.year ? String(game.year) : "—";
    const genre = game?.genre || "—";
    const rating = typeof game?.rating === "number" ? String(game.rating) : "—";
    const platforms = Array.isArray(game?.platforms) ? game.platforms.join(" / ") : "—";
    const difficulty = game?.difficulty || "—";
    const playtime = game?.playtime || "—";
    const modes = Array.isArray(game?.modes) ? game.modes.join(" / ") : "—";
    const updated = game?.updated ? formatDate(game.updated) : "—";
    const ratingValue = typeof game?.rating === "number" ? game.rating : null;
    const summary = game?.summary || "你可以先从通用攻略入手，或者在游戏库中筛选相关内容。";

    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({ title: document.title, description: summary, image: icon });
    if (id) pushRecent(STORAGE_KEYS.recentGames, id, 12);
    if (id) markItemSeen("games", id, game?.updated);
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (iconEl) {
      iconEl.src = icon;
      iconEl.alt = title;
    }
    if (yearBadge) yearBadge.textContent = year;
    if (summaryEl) summaryEl.textContent = summary;

    if (metaEl) {
      if (genreEl) genreEl.textContent = genre;
      if (ratingEl) ratingEl.textContent = rating;
      if (platformsEl) platformsEl.textContent = platforms;
      if (difficultyEl) difficultyEl.textContent = difficulty;
      if (playtimeEl) playtimeEl.textContent = playtime;
      if (modesEl) modesEl.textContent = modes;
      if (updatedEl) updatedEl.textContent = updated;
    }

    const ratingMeter = $("#game-rating-meter");
    if (ratingMeter) {
      const pct = ratingValue != null ? Math.max(0, Math.min(100, Math.round((ratingValue / 10) * 100))) : 0;
      ratingMeter.style.width = `${pct}%`;
    }

    if (guidesEl && data?.guides) {
      const all = Object.entries(data.guides).map(([gid, g]) => ({ id: gid, guide: g }));
      const related = all.filter((g) => g.guide.gameId === id);
      const list = related.length > 0 ? related : all.slice(0, 6);

      guidesEl.innerHTML = list
        .map(({ id: gid, guide }) => {
          const icon2 = guide.icon || "images/icons/guide-icon.svg";
          const t = guide.title || gid;
          const s = guide.summary || "点击查看详情。";
          return `
            <a class="mini-card" href="guide-detail.html?id=${encodeURIComponent(gid)}">
              <img src="${icon2}" alt="${escapeHtml(t)}">
              <div class="mini-card-body">
                <div class="mini-card-title">${escapeHtml(t)}</div>
                <div class="mini-card-desc">${escapeHtml(s)}</div>
              </div>
            </a>
          `;
        })
        .join("");
    }

    const renderChips = (root, list, emptyText) => {
      if (!root) return;
      if (!Array.isArray(list) || list.length === 0) {
        root.innerHTML = `<span class="chip">${escapeHtml(emptyText)}</span>`;
        return;
      }
      root.innerHTML = list.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
    };

    renderChips(tagsEl, game?.tags, "暂无标签");
    renderChips(highlightsEl, game?.highlights, "重点待补");

    const topicMap = {
      "starlight-miracle": "starlight-leveling",
      "baldurs-gate3": "bg3-party",
      "elden-ring": "elden-boss",
      civilization6: "civ6-leaders",
      "dark-souls3": "dark-souls",
      "devil-may-cry5": "reaction-time",
      "crusader-kings3": "diplomacy",
      "horizon-fw": "elden-ring-bosses",
      "god-of-war": "controller",
    };
    const topicId = topicMap[id] || "upcoming-games";
    const topicHref = `forum-topic.html?id=${encodeURIComponent(topicId)}`;
    if (communityAction) communityAction.href = topicHref;
    if (topicLink) topicLink.href = topicHref;

    if (primaryAction) {
      if (game?.hasDeepGuide && game?.deepGuideHref) {
        primaryAction.href = game.deepGuideHref;
        primaryAction.textContent = "查看完整攻略";
      } else {
        primaryAction.href = "all-guides.html";
        primaryAction.textContent = "查看相关攻略";
      }
    }

    const syncGameSave = () => {
      if (!saveGameBtn) return;
      if (!id) {
        saveGameBtn.textContent = "收藏游戏";
        saveGameBtn.setAttribute("aria-pressed", "false");
        saveGameBtn.disabled = true;
        return;
      }
      saveGameBtn.disabled = false;
      const set = new Set(readStringList(STORAGE_KEYS.savedGames));
      const saved = set.has(id);
      saveGameBtn.textContent = saved ? "已收藏（点击取消）" : "收藏游戏";
      saveGameBtn.setAttribute("aria-pressed", saved ? "true" : "false");
      saveGameBtn.classList.toggle("btn-secondary", saved);
    };

    syncGameSave();

    saveGameBtn?.addEventListener("click", () => {
      if (!id) return;
      const set = new Set(readStringList(STORAGE_KEYS.savedGames));
      const saved = set.has(id);
      if (saved) set.delete(id);
      else set.add(id);
      writeStringList(STORAGE_KEYS.savedGames, Array.from(set));
      toast({
        title: saved ? "已取消收藏" : "已收藏",
        message: "游戏已保存到本地浏览器。",
        tone: saved ? "info" : "success",
      });
      syncGameSave();
    });

    initNotesPanel({
      id,
      textarea: $("#game-notes"),
      saveBtn: $("#game-notes-save"),
      clearBtn: $("#game-notes-clear"),
      statusEl: $("#game-notes-status"),
      storageKey: STORAGE_KEYS.gameNotesPrefix,
    });
  };

  // -------------------------
  // Community Page
  // -------------------------

  const initCommunityPage = () => {
    if (getPage() !== "community") return;

    const data = getData();
    const topics = data?.topics;
    const grid = $("#community-topics");
    if (!topics || !grid) return;

    const searchInput = $("#community-search");
    const searchBtn = $("#community-search-btn");
    const tagRoot = $("#community-tags");
    const sortSelect = $("#community-sort");
    const countEl = $("#community-count");
    const empty = $("#community-topics-empty");
    const clearBtn = $("#community-clear");

    const items = Object.entries(topics).map(([id, topic]) => ({ id, topic }));
    const allTags = Array.from(
      new Set(
        items.flatMap(({ topic }) => {
          const tags = Array.isArray(topic?.tags) ? topic.tags.map(String) : [];
          const category = topic?.category ? [String(topic.category)] : [];
          return [...category, ...tags];
        })
      )
    )
      .slice(0, 18)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    const readState = () => {
      const raw = storage.get(STORAGE_KEYS.communityTopicsState);
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object") return { query: "", tags: [], savedOnly: false, sort: "latest" };
      return {
        query: String(parsed.query || ""),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        savedOnly: Boolean(parsed.savedOnly),
        sort: String(parsed.sort || "latest"),
      };
    };
    const writeState = (s) => storage.set(STORAGE_KEYS.communityTopicsState, JSON.stringify(s));

    let state = readState();
    let saved = new Set(readStringList(STORAGE_KEYS.savedTopics));

    const readUrlParams = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const readList = (key) => {
          const raw = params
            .getAll(key)
            .flatMap((v) => String(v || "").split(","))
            .map((v) => v.trim())
            .filter(Boolean);
          return Array.from(new Set(raw));
        };
        const q = String(params.get("q") || params.get("query") || "").trim();
        const tags = [...readList("tag"), ...readList("tags")];
        const reset = params.get("reset") === "1";
        const savedOnlyRaw = String(params.get("saved") || params.get("savedOnly") || "").trim().toLowerCase();
        const savedOnly = savedOnlyRaw === "1" || savedOnlyRaw === "true";
        const sort = String(params.get("sort") || "").trim();
        return { reset, query: q, tags, savedOnly, sort };
      } catch (_) {
        return { reset: false, query: "", tags: [], savedOnly: false, sort: "" };
      }
    };

    const url = readUrlParams();
    if (url.reset) state = { query: "", tags: [], savedOnly: false, sort: "latest" };
    if (url.query) state = { ...state, query: url.query };
    if (url.tags.length > 0) {
      const known = new Set(allTags);
      const nextTags = url.tags.filter((t) => known.has(t));
      if (nextTags.length > 0) state = { ...state, tags: nextTags };
    }
    if (url.savedOnly) state = { ...state, savedOnly: true };
    if (url.sort) state = { ...state, sort: url.sort };

    const renderTags = () => {
      if (!tagRoot) return;
      const savedActive = state.savedOnly ? "active" : "";
      const savedChip = `<button type="button" class="chip chip-btn chip-saved ${savedActive}" data-action="saved-only">只看收藏</button>`;
      tagRoot.innerHTML =
        savedChip +
        allTags
          .map((t) => {
            const active = state.tags.includes(t);
            return `<button type="button" class="chip chip-btn ${active ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
          })
          .join("");
    };

    // 事件委托：避免每次 renderTags 都为每个 chip 绑定 click
    tagRoot?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".chip-btn");
      if (!btn || !tagRoot.contains(btn)) return;

      const action = btn.dataset.action || "";
      if (action === "saved-only") {
        state.savedOnly = !state.savedOnly;
        writeState(state);
        renderTags();
        apply();
        return;
      }

      const t = btn.dataset.tag || "";
      if (!t) return;
      state.tags = state.tags.includes(t) ? state.tags.filter((x) => x !== t) : [...state.tags, t];
      writeState(state);
      renderTags();
      apply();
    });

    const syncUrl = () => {
      try {
        const params = new URLSearchParams();
        if (state.query) params.set("q", state.query);
        if (state.tags.length > 0) params.set("tag", state.tags.join(","));
        if (state.savedOnly) params.set("saved", "1");
        if (state.sort && state.sort !== "latest") params.set("sort", state.sort);
        const next = params.toString();
        const url2 = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState(null, "", url2);
      } catch (_) {}
    };

    const renderCard = (id, topic) => {
      const title = topic.title || id;
      const summary = topic.summary || "该话题正在整理中。";
      const starter = topic.starter || "社区成员";
      const replies = Number(topic.replies || 0);
      const updated = topic.updated ? formatDate(topic.updated) : "—";
      const status = getUpdateStatus("topics", id, topic.updated);
      const tags = Array.isArray(topic.tags) ? topic.tags : [];
      const category = topic.category ? [topic.category] : [];
      const isSaved = saved.has(id);
      const saveLabel = isSaved ? "取消收藏" : "收藏";
      const saveStar = isSaved ? "★" : "☆";
      const hotBadge = replies >= 150 ? '<span class="badge popular">热门</span>' : "";
      const categoryBadge = topic.category ? `<span class="badge subtle">${escapeHtml(topic.category)}</span>` : "";
      const updateBadge = renderUpdateBadge(status);
      const tagList = [...category, ...tags]
        .filter(Boolean)
        .slice(0, 4)
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join("");

      return `
        <article class="topic-card ${isSaved ? "is-saved" : ""}">
          <div class="topic-header">
            <div class="topic-badges">${updateBadge}${hotBadge}${categoryBadge}</div>
          </div>
          <h3 class="topic-title">${escapeHtml(title)}</h3>
          <p class="topic-summary">${escapeHtml(summary)}</p>
          ${tagList ? `<div class="topic-tags">${tagList}</div>` : ""}
          <div class="topic-stats">
            <span>发起人：${escapeHtml(starter)}</span>
            <span>回复：${Number.isFinite(replies) ? replies : 0}</span>
            <span>更新：${escapeHtml(updated)}</span>
          </div>
          <div class="topic-actions">
            <a class="btn btn-small" href="forum-topic.html?id=${encodeURIComponent(id)}">加入讨论</a>
            <button type="button" class="save-pill ${isSaved ? "active" : ""}" data-topic-id="${escapeHtml(id)}" aria-pressed="${isSaved ? "true" : "false"}" aria-label="${escapeHtml(saveLabel)}">
              <span class="save-star" aria-hidden="true">${saveStar}</span>
              <span class="save-text">${escapeHtml(saveLabel)}</span>
            </button>
          </div>
        </article>
      `;
    };

    const syncTopicSaveUi = (btn, isSaved) => {
      if (!btn) return;
      btn.classList.toggle("active", Boolean(isSaved));
      btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
      btn.setAttribute("aria-label", isSaved ? "取消收藏" : "收藏");

      const star = $(".save-star", btn);
      if (star) star.textContent = isSaved ? "★" : "☆";
      const text = $(".save-text", btn);
      if (text) text.textContent = isSaved ? "取消收藏" : "收藏";
    };

    // 事件委托：避免每次 apply 重新绑定 N 个按钮监听器
    grid.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".save-pill");
      if (!btn || !grid.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();

      const tid = btn.dataset.topicId || "";
      if (!tid) return;

      const had = saved.has(tid);
      if (had) saved.delete(tid);
      else saved.add(tid);
      writeStringList(STORAGE_KEYS.savedTopics, Array.from(saved));

      toast({
        title: had ? "已取消收藏" : "已收藏",
        message: "话题已保存到本地浏览器。",
        tone: had ? "info" : "success",
      });

      // 只看收藏：取消收藏会导致当前卡片需要被移除（直接重算列表）
      if (state.savedOnly && had) {
        apply();
        return;
      }

      syncTopicSaveUi(btn, !had);
      btn.closest?.(".topic-card")?.classList.toggle("is-saved", !had);
    });

    const apply = () => {
      saved = new Set(readStringList(STORAGE_KEYS.savedTopics));
      const q = (state.query || "").trim().toLowerCase();
      const tagSet = new Set(state.tags);

      const filtered = items.filter(({ id, topic }) => {
        const title = String(topic.title || id).toLowerCase();
        const summary = String(topic.summary || "").toLowerCase();
        const starter = String(topic.starter || "").toLowerCase();
        const tags = Array.isArray(topic.tags) ? topic.tags.map(String) : [];
        const category = topic.category ? [String(topic.category)] : [];
        const hay = `${title} ${summary} ${starter} ${tags.join(" ")} ${category.join(" ")}`;
        const okQuery = !q || hay.includes(q);
        const okTags = tagSet.size === 0 || [...tags, ...category].some((t) => tagSet.has(String(t)));
        const okSaved = !state.savedOnly || saved.has(id);
        return okQuery && okTags && okSaved;
      });

      const sorted = [...filtered];
      const sortKey = state.sort || "latest";
      sorted.sort((a, b) => {
        if (sortKey === "replies-desc") return Number(b.topic?.replies || 0) - Number(a.topic?.replies || 0);
        if (sortKey === "replies-asc") return Number(a.topic?.replies || 0) - Number(b.topic?.replies || 0);
        if (sortKey === "title") {
          return String(a.topic?.title || a.id).localeCompare(String(b.topic?.title || b.id), "zh-Hans-CN");
        }
        return parseDateKey(b.topic?.updated) - parseDateKey(a.topic?.updated);
      });

      withViewTransition(() => {
        grid.innerHTML = sorted.length > 0 ? sorted.map(({ id, topic }) => renderCard(id, topic)).join("") : "";
        if (countEl) countEl.textContent = `共 ${sorted.length} 个话题`;
        if (empty) empty.hidden = sorted.length !== 0;
      });
      syncUrl();
    };

    if (searchInput) searchInput.value = state.query || "";
    if (sortSelect) {
      const options = new Set($$("option", sortSelect).map((opt) => opt.value).filter(Boolean));
      if (!options.has(state.sort)) state.sort = "latest";
      sortSelect.value = state.sort || "latest";
    }

    renderTags();
    apply();

    const syncFromInput = () => {
      state = { ...state, query: searchInput?.value?.trim() || "" };
      writeState(state);
      apply();
    };

    searchBtn?.addEventListener("click", syncFromInput);
    sortSelect?.addEventListener("change", () => {
      state = { ...state, sort: String(sortSelect.value || "latest") };
      writeState(state);
      apply();
    });

    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          syncFromInput();
        }
      });
      let t = 0;
      searchInput.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(syncFromInput, 180);
      });
    }

    clearBtn?.addEventListener("click", () => {
      state = { query: "", tags: [], savedOnly: false, sort: "latest" };
      writeState(state);
      if (searchInput) searchInput.value = "";
      if (sortSelect) sortSelect.value = "latest";
      renderTags();
      apply();
    });
  };

  // -------------------------
  // Forum Topic Page
  // -------------------------

  const renderReply = (reply) => {
    const when = reply.ts ? new Date(reply.ts).toLocaleString("zh-CN") : "";
    const tag = reply.tag ? `<span class="chip">${escapeHtml(reply.tag)}</span>` : "";
    return `
      <div class="reply">
        <div class="reply-header">
          <div class="reply-author">${escapeHtml(reply.author || "匿名")}</div>
          <div class="reply-meta">${escapeHtml(when)}</div>
        </div>
        <div class="reply-content">${escapeHtml(reply.content || "")}</div>
        <div class="reply-tags">${tag}</div>
      </div>
    `;
  };

  const initForumTopicPage = () => {
    if (getPage() !== "forum") return;

    const id = getParam("id") || "upcoming-games";
    const topic = getData()?.topics?.[id] || null;

    const titleEl = $("#topic-title");
    const metaEl = $("#topic-meta");
    const countEl = $("#topic-count");
    const summaryEl = $("#topic-summary");
    const tagsEl = $("#topic-tags");
    const updatedEl = $("#topic-updated");
    const repliesEl = $("#topic-replies");
    const form = $("#replyForm");
    const clearBtn = $("#topic-clear-local");
    const sortSelect = $("#reply-sort");
    const saveBtn = $("#topic-save");

    const title = topic?.title || `话题：${id}`;
    const summary =
      topic?.summary || "该话题正在建设中。你仍然可以在这里发表本地回复进行记录。";
    const starter = topic?.starter || "站内编辑";
    const updated = topic?.updated ? formatDate(topic.updated) : "—";
    const topicTags = Array.isArray(topic?.tags) ? topic.tags : [];
    const category = topic?.category ? [topic.category] : [];

    markItemSeen("topics", id, topic?.updated);

    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({
      title: document.title,
      description: summary,
      image: "images/icons/favicon.svg",
    });
    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary;
    if (metaEl) metaEl.textContent = `发起人：${starter}`;
    if (updatedEl) updatedEl.textContent = `更新：${updated}`;
    if (tagsEl) {
      const tags = [...category, ...topicTags].filter(Boolean);
      tagsEl.innerHTML =
        tags.length > 0
          ? tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")
          : '<span class="chip">综合讨论</span>';
    }

    const key = `${STORAGE_KEYS.forumRepliesPrefix}${id}`;
    const sortKey = `${STORAGE_KEYS.forumSortPrefix}${id}`;
    const readLocal = () => safeJsonParse(storage.get(key), []) || [];
    const writeLocal = (list) => storage.set(key, JSON.stringify(list));
    const readSort = () => storage.get(sortKey) || "latest";
    const writeSort = (value) => storage.set(sortKey, value);

    const baseReplies = Number(topic?.replies || 0);
    const render = () => {
      if (!repliesEl) return;
      const local = readLocal();
      const seed = [
        { author: starter, tag: "楼主", content: summary, ts: Date.now() - 1000 * 60 * 60 * 2 },
      ];
      const all = [...seed, ...local];
      const sortMode = readSort();
      all.sort((a, b) => {
        const ta = Number(a.ts || 0);
        const tb = Number(b.ts || 0);
        return sortMode === "oldest" ? ta - tb : tb - ta;
      });
      repliesEl.innerHTML = all.map(renderReply).join("");
      if (countEl) countEl.textContent = `${baseReplies + all.length} 条回复`;
    };

    render();

    if (sortSelect) {
      sortSelect.value = readSort();
      sortSelect.addEventListener("change", () => {
        const value = String(sortSelect.value || "latest");
        writeSort(value);
        render();
      });
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const author = String(fd.get("author") || "").trim();
      const tag = String(fd.get("tag") || "").trim();
      const content = String(fd.get("content") || "").trim();

      if (!author || !content) {
        toast({ title: "还差一步", message: "昵称与内容不能为空。", tone: "warn" });
        return;
      }

      const next = {
        author: author.slice(0, 24),
        tag: tag.slice(0, 24),
        content: content.slice(0, 2000),
        ts: Date.now(),
      };

      const list = readLocal();
      writeLocal([...list, next]);
      form.reset();
      render();
      toast({ title: "已发送", message: "已保存到本地浏览器。", tone: "success" });
    });

    clearBtn?.addEventListener("click", () => {
      writeLocal([]);
      render();
      toast({ title: "已清空", message: "本地回复已删除。", tone: "info" });
    });

    const syncTopicSave = () => {
      if (!saveBtn) return;
      const set = new Set(readStringList(STORAGE_KEYS.savedTopics));
      const saved = set.has(id);
      saveBtn.textContent = saved ? "已收藏（点击取消）" : "收藏话题";
      saveBtn.setAttribute("aria-pressed", saved ? "true" : "false");
      saveBtn.classList.toggle("btn-secondary", saved);
    };

    syncTopicSave();

    saveBtn?.addEventListener("click", () => {
      if (!id) return;
      const set = new Set(readStringList(STORAGE_KEYS.savedTopics));
      const saved = set.has(id);
      if (saved) set.delete(id);
      else set.add(id);
      writeStringList(STORAGE_KEYS.savedTopics, Array.from(set));
      toast({
        title: saved ? "已取消收藏" : "已收藏",
        message: "话题已保存到本地浏览器。",
        tone: saved ? "info" : "success",
      });
      syncTopicSave();
    });
  };

  // -------------------------
  // Boot
  // -------------------------

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.add("js");

    const run = (fn) => {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    };

    const runIdle = (fn, { timeout = 1200 } = {}) => {
      try {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => run(fn), { timeout });
          return;
        }
      } catch (_) {}
      window.setTimeout(() => run(fn), 0);
    };

    // 关键交互优先：主题 / 导航 / 搜索
    run(initThemeToggle);
    run(initContrast);
    run(seedUpdateRadarIfNeeded);
    run(initCommandPalette);
    run(initNavigation);
    run(initSoftNavigation);
    run(initBackToTop);
    run(initCopyLinkButtons);
    run(initPwaInstall);
    run(initConnectivityToasts);
    run(initServiceWorkerMessaging);

    // 页面逻辑尽早执行，保证后续动效能覆盖动态内容
    run(initAllGamesPage);
    run(initAllGuidesPage);
    run(initGuideDetailPage);
    run(initGamePage);
    run(initCommunityPage);
    run(initForumTopicPage);

    // 视觉增强项（可延后）
    run(initPageLoaded);
    run(initScrollReveal);
    run(initHeroStats);
    run(initHomeRecent);
    run(initNewsletterForms);
    runIdle(initParticles, { timeout: 1200 });
    runIdle(initServiceWorker, { timeout: 1500 });
  });
})();
