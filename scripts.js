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
    allGamesState: "gkb-all-games-state",
    allGuidesState: "gkb-all-guides-state",
    savedGuides: "gkb-saved-guides",
    forumRepliesPrefix: "gkb-forum-replies:",
    recentGames: "gkb-recent-games",
    recentGuides: "gkb-recent-guides",
    swSeenPrefix: "gkb-sw-seen:",
    pwaInstallTipPrefix: "gkb-pwa-install-tip:",
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
      meta.setAttribute("content", theme === "dark" ? "#070a12" : "#f6f7fb");
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

    const buildGroups = (query) => {
      const data = getData();
      const q = String(query || "").trim().toLowerCase();

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

        const groups = [{ title: "快捷操作", items: actions }];
        if (recent.length > 0) groups.push({ title: "最近访问", items: recent });
        if (saved.length > 0) groups.push({ title: "本地收藏", items: saved });
        return withHighlight(groups);
      }

      const gameItems = Object.entries(data?.games || {})
        .map(([id, g]) => {
          const title = String(g?.title || id);
          const genre = String(g?.genre || "");
          const year = g?.year ? `${g.year}` : "";
          const score = fuzzyScore(`${id} ${title} ${genre} ${year}`, q);
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

      const guideItems = Object.entries(data?.guides || {})
        .map(([id, g]) => {
          const title = String(g?.title || id);
          const summary = String(g?.summary || "");
          const tags = Array.isArray(g?.tags) ? g.tags.map(String).join(" ") : "";
          const score = fuzzyScore(`${id} ${title} ${summary} ${tags}`, q);
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

      const topicItems = Object.entries(data?.topics || {})
        .map(([id, g]) => {
          const title = String(g?.title || id);
          const summary = String(g?.summary || "");
          const score = fuzzyScore(`${id} ${title} ${summary}`, q);
          return { id, g, score };
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

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
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
      });
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
      document.body.classList.add("cmdk-open");
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
      root.hidden = true;
      document.body.classList.remove("cmdk-open");
      try {
        lastActive?.focus?.();
      } catch (_) {}
    };

    root.addEventListener("click", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.dataset.action === "cmdk-close") close();
    });

    input?.addEventListener("input", () => render(input.value));

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
      const close = () => {
        nav.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "打开导航菜单");
        toggle.textContent = "☰";
      };

      const open = () => {
        nav.classList.add("active");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "关闭导航菜单");
        toggle.textContent = "✕";
      };

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
          message: "已为你缓存核心资源；断网时仍可打开已访问过的页面。",
          tone: "success",
          timeout: 3400,
        });
      })
      .catch(() => {
        // 离线能力是增强项：注册失败不影响基本可用性
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
  // All Games Page
  // -------------------------

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
      sort: sortSelect?.value || "popular",
      view: listEl.classList.contains("list-view-active") ? "list" : "grid",
    });

    const sort = (sortKey) => {
      if (!sortKey || sortKey === "popular") return;
      const comparator = (a, b) => {
        const ra = Number(a.dataset.rating || 0);
        const rb = Number(b.dataset.rating || 0);
        const ya = Number(a.dataset.year || 0);
        const yb = Number(b.dataset.year || 0);
        if (sortKey === "rating-desc") return rb - ra;
        if (sortKey === "rating-asc") return ra - rb;
        if (sortKey === "year-desc") return yb - ya;
        if (sortKey === "year-asc") return ya - yb;
        return 0;
      };
      cards.sort(comparator).forEach((c) => listEl.appendChild(c));
    };

    const filter = (s) => {
      const q = (s.query || "").toLowerCase();
      let shown = 0;

      cards.forEach((card) => {
        const title = ($("h3", card)?.textContent || "").toLowerCase();
        const desc = ($("p", card)?.textContent || "").toLowerCase();
        const blob = `${title} ${desc}`;

        const genre = card.dataset.genre || "";
        const platformTokens = (card.dataset.platform || "").split(/\s+/).filter(Boolean);
        const year = card.dataset.year || "";
        const rating = card.dataset.rating || "0";

        const okQuery = !q || blob.includes(q);
        const okGenre = s.genres.length === 0 || s.genres.includes(genre);
        const okPlatform =
          s.platforms.length === 0 || platformTokens.some((p) => s.platforms.includes(p));
        const okYear = matchesYear(year, s.years);
        const okRating = matchesRating(rating, s.ratings);

        const visible = okQuery && okGenre && okPlatform && okYear && okRating;
        card.hidden = !visible;
        if (visible) shown += 1;
      });

      if (emptyEl) emptyEl.hidden = shown !== 0;
      if (countEl) countEl.textContent = `共 ${shown} 个结果`;
    };

    const sync = () => {
      const s = stateFromUi();
      sort(s.sort);
      filter(s);
      writeState(s);
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
        const view = String(params.get("view") || "").trim();

        return {
          reset,
          query: q,
          genres: readList("genre"),
          platforms: readList("platform"),
          years: readList("year"),
          ratings: readList("rating"),
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

    const items = Object.entries(guides).map(([id, guide]) => ({ id, guide }));
    const allTags = Array.from(
      new Set(items.flatMap((x) => (Array.isArray(x.guide.tags) ? x.guide.tags : [])).map(String))
    )
      .slice(0, 16)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    const readState = () => {
      const raw = storage.get(STORAGE_KEYS.allGuidesState);
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object") return { query: "", tags: [], savedOnly: false };
      return {
        query: String(parsed.query || ""),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        savedOnly: Boolean(parsed.savedOnly),
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

        return { reset, query: q, tags, savedOnly };
      } catch (_) {
        return { reset: false, query: "", tags: [], savedOnly: false };
      }
    };

    const url = readUrlParams();
    if (url.reset) state = { query: "", tags: [], savedOnly: false };

    if (url.query) state = { ...state, query: url.query };
    if (url.tags.length > 0) {
      const known = new Set(allTags);
      const nextTags = url.tags.filter((t) => known.has(t));
      if (nextTags.length > 0) state = { ...state, tags: nextTags };
    }
    if (url.savedOnly) state = { ...state, savedOnly: true };

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

      $$(".chip-btn", tagRoot).forEach((btn) => {
        btn.addEventListener("click", () => {
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
      });
    };

    const renderCard = (id, guide) => {
      const icon = guide.icon || "images/icons/guide-icon.svg";
      const title = guide.title || id;
      const summary = guide.summary || "该攻略正在整理中。";
      const tags = Array.isArray(guide.tags) ? guide.tags : [];
      const isSaved = saved.has(id);
      const saveLabel = isSaved ? "取消收藏" : "收藏";
      const saveStar = isSaved ? "★" : "☆";
      const chips =
        tags.length > 0
          ? `<div class="chips-inline">${tags.slice(0, 4).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>`
          : "";

      return `
        <div class="game-card guide-card fade-in-up ${isSaved ? "is-saved" : ""}">
          <div class="game-card-image">
            <img src="${icon}" alt="${escapeHtml(title)}">
          </div>
          <div class="game-card-content">
            <h3 class="game-card-title">${escapeHtml(title)}</h3>
            <p class="game-card-description">${escapeHtml(summary)}</p>
            ${chips}
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

      grid.innerHTML = filtered.map(({ id, guide }) => renderCard(id, guide)).join("");
      $$(".save-pill", grid).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const gid = btn.dataset.guideId || "";
          if (!gid) return;
          const list = new Set(readStringList(STORAGE_KEYS.savedGuides));
          const has = list.has(gid);
          if (has) list.delete(gid);
          else list.add(gid);
          writeStringList(STORAGE_KEYS.savedGuides, Array.from(list));
          toast({
            title: has ? "已取消收藏" : "已收藏",
            message: "偏好已保存到本地浏览器。",
            tone: has ? "info" : "success",
          });
          apply();
        });
      });
      if (empty) empty.hidden = filtered.length !== 0;
      if (empty && filtered.length === 0) grid.innerHTML = "";
    };

    if (searchInput) searchInput.value = state.query || "";
    renderTags();
    apply();

    const syncFromInput = () => {
      state = { ...state, query: searchInput?.value?.trim() || "" };
      writeState(state);
      apply();
    };

    searchBtn?.addEventListener("click", syncFromInput);
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
      state = { query: "", tags: [], savedOnly: false };
      writeState(state);
      if (searchInput) searchInput.value = "";
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

    const title = guide?.title || (id ? `攻略：${id}` : "攻略详情");
    const summary =
      guide?.summary || "该攻略正在整理中。你依然可以先收藏到本地，后续再回来看更新。";

    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary;
    if (iconEl) iconEl.src = guide?.icon || "images/icons/guide-icon.svg";
    if (tagEl) tagEl.textContent = (guide?.tags && guide.tags[0]) || "攻略";
    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({
      title: document.title,
      description: summary,
      image: guide?.icon || "images/icons/guide-icon.svg",
    });
    if (id) pushRecent(STORAGE_KEYS.recentGuides, id, 12);

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
    const summaryEl = $("#game-summary");
    const guidesEl = $("#game-guides");
    const primaryAction = $("#game-primary-action");
    const communityAction = $("#game-community-action");
    const topicLink = $("#game-topic-link");

    const title = game?.title || (id ? `游戏：${id}` : "游戏详情");
    const subtitle = game?.subtitle || "该游戏详情正在建设中，我们会逐步补全攻略体系。";
    const icon = game?.icon || "images/icons/game-cover.svg";
    const year = game?.year ? String(game.year) : "—";
    const genre = game?.genre || "—";
    const rating = typeof game?.rating === "number" ? String(game.rating) : "—";
    const platforms = Array.isArray(game?.platforms) ? game.platforms.join(" / ") : "—";
    const summary = game?.summary || "你可以先从通用攻略入手，或者在游戏库中筛选相关内容。";

    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({ title: document.title, description: summary, image: icon });
    if (id) pushRecent(STORAGE_KEYS.recentGames, id, 12);
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (iconEl) {
      iconEl.src = icon;
      iconEl.alt = title;
    }
    if (yearBadge) yearBadge.textContent = year;
    if (summaryEl) summaryEl.textContent = summary;

    if (metaEl) {
      const rows = $$(".meta-item", metaEl);
      if (rows[0]) $(".meta-value", rows[0]).textContent = genre;
      if (rows[1]) $(".meta-value", rows[1]).textContent = rating;
      if (rows[2]) $(".meta-value", rows[2]).textContent = platforms;
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

    const topicMap = {
      "elden-ring": "elden-boss",
      civilization6: "civ6-leaders",
      "dark-souls3": "dark-souls",
      "devil-may-cry5": "reaction-time",
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
    const summaryEl = $("#topic-summary");
    const repliesEl = $("#topic-replies");
    const form = $("#replyForm");
    const clearBtn = $("#topic-clear-local");

    const title = topic?.title || `话题：${id}`;
    const summary =
      topic?.summary || "该话题正在建设中。你仍然可以在这里发表本地回复进行记录。";
    const starter = topic?.starter || "站内编辑";

    document.title = `${title} - 游戏攻略网`;
    syncShareMeta({
      title: document.title,
      description: summary,
      image: "images/icons/favicon.svg",
    });
    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary;
    if (metaEl) metaEl.textContent = `发起人：${starter}`;

    const key = `${STORAGE_KEYS.forumRepliesPrefix}${id}`;
    const readLocal = () => safeJsonParse(storage.get(key), []) || [];
    const writeLocal = (list) => storage.set(key, JSON.stringify(list));

    const render = () => {
      if (!repliesEl) return;
      const local = readLocal();
      const seed = [
        { author: starter, tag: "楼主", content: summary, ts: Date.now() - 1000 * 60 * 60 * 2 },
      ];
      repliesEl.innerHTML = [...seed, ...local].map(renderReply).join("");
    };

    render();

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
    run(initCommandPalette);
    run(initNavigation);
    run(initBackToTop);
    run(initCopyLinkButtons);
    run(initPwaInstall);
    run(initConnectivityToasts);

    // 页面逻辑尽早执行，保证后续动效能覆盖动态内容
    run(initAllGamesPage);
    run(initAllGuidesPage);
    run(initGuideDetailPage);
    run(initGamePage);
    run(initForumTopicPage);

    // 视觉增强项（可延后）
    run(initPageLoaded);
    run(initScrollReveal);
    run(initNewsletterForms);
    runIdle(initParticles, { timeout: 1200 });
    runIdle(initServiceWorker, { timeout: 1500 });
  });
})();
