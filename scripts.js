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
    gameLibrary: "gkb-game-library",
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
    plans: "gkb-plans",
    planSettings: "gkb-plan-settings",
    discoverPrefs: "gkb-discover-prefs",
    telemetryEnabled: "gkb-telemetry-enabled",
    telemetryEvents: "gkb-telemetry-events",
    diagnosticsErrors: "gkb-diagnostics-errors",
    diagnosticsLogs: "gkb-diagnostics-logs",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const runIdleTask = (fn, { timeout = 900 } = {}) => {
    const safeRun = () => {
      try {
        fn();
      } catch (err) {
        diagnostics.captureError(err, { kind: "handled", source: "runIdleTask" });
        console.error(err);
      }
    };

    const t = Math.max(0, Number(timeout || 0) || 0);

    try {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(safeRun, { timeout: t || 900 });
        return;
      }
    } catch (_) {}

    window.setTimeout(safeRun, 0);
  };

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

  // -------------------------
  // Telemetry（本地埋点：无后端/无外发，默认启用，可本地关闭）
  // - 目标：为“交互优化/性能优化”提供事实依据（而不是为了追踪用户）
  // - 约束：不记录任何敏感信息；对文本字段强制截断；事件数量上限防止膨胀
  // -------------------------

  const telemetry = (() => {
    const MAX_EVENTS = 420;
    const MAX_STR = 96;
    const MAX_KEY = 48;

    const isEnabled = () => storage.get(STORAGE_KEYS.telemetryEnabled) !== "0";

    const sanitizeMeta = (meta) => {
      if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
      const out = {};

      Object.entries(meta).forEach(([k, v]) => {
        const key = String(k || "").trim().slice(0, MAX_KEY);
        if (!key) return;

        if (typeof v === "string") out[key] = v.slice(0, MAX_STR);
        else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
        else if (typeof v === "boolean") out[key] = v;
        else if (Array.isArray(v)) out[key] = v.length;
      });

      return Object.keys(out).length > 0 ? out : undefined;
    };

    const read = () => {
      const raw = storage.get(STORAGE_KEYS.telemetryEvents);
      const list = safeJsonParse(raw, []);
      if (!Array.isArray(list)) return [];
      return list
        .filter((x) => x && typeof x === "object" && !Array.isArray(x))
        .slice(Math.max(0, list.length - MAX_EVENTS));
    };

    const write = (events) => {
      const list = Array.isArray(events) ? events : [];
      const trimmed = list.slice(Math.max(0, list.length - MAX_EVENTS));
      return storage.set(STORAGE_KEYS.telemetryEvents, JSON.stringify(trimmed));
    };

    const log = (name, meta) => {
      if (!isEnabled()) return false;
      const n = String(name || "").trim();
      if (!n) return false;

      const ev = { ts: Date.now(), name: n };

      try {
        const page = String(getPage?.() || "").trim();
        if (page) ev.page = page;
      } catch (_) {}

      const m = sanitizeMeta(meta);
      if (m) ev.meta = m;

      try {
        const list = read();
        list.push(ev);
        return write(list);
      } catch (_) {
        return false;
      }
    };

    const clear = () => storage.remove(STORAGE_KEYS.telemetryEvents);

    const setEnabled = (on) => storage.set(STORAGE_KEYS.telemetryEnabled, on ? "1" : "0");

    return { isEnabled, log, read, clear, setEnabled };
  })();

  const normalizeGameLibraryStatus = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (v === "wishlist" || v === "playing" || v === "done") return v;
    return "none";
  };

  const readGameLibraryMap = () => {
    const parsed = safeJsonParse(storage.get(STORAGE_KEYS.gameLibrary), null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    Object.entries(parsed).forEach(([id, entry]) => {
      const gid = String(id || "").trim();
      if (!gid) return;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const status = normalizeGameLibraryStatus(entry.status);
      if (status === "none") return;
      out[gid] = { status, updatedAt: Number(entry.updatedAt || 0) || 0 };
    });
    return out;
  };

  const writeGameLibraryMap = (map) => {
    if (!map || typeof map !== "object" || Array.isArray(map)) return false;
    return storage.set(STORAGE_KEYS.gameLibrary, JSON.stringify(map));
  };

  const setGameLibraryStatus = (id, status) => {
    const gid = String(id || "").trim();
    if (!gid) return "none";
    const next = normalizeGameLibraryStatus(status);

    const map = readGameLibraryMap();
    if (next === "none") {
      if (Object.prototype.hasOwnProperty.call(map, gid)) delete map[gid];
    } else {
      map[gid] = { status: next, updatedAt: Date.now() };
    }
    writeGameLibraryMap(map);
    return next;
  };

  const getGameLibraryStatus = (id, map) => {
    const gid = String(id || "").trim();
    if (!gid) return "none";
    const m = map && typeof map === "object" ? map : readGameLibraryMap();
    const s = m && Object.prototype.hasOwnProperty.call(m, gid) ? m[gid]?.status : "";
    return normalizeGameLibraryStatus(s);
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

  const clampNumber = (value, min, max) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
  };

  const normalizeTagList = (tags) =>
    (Array.isArray(tags) ? tags : [])
      .map((t) => String(t || "").trim())
      .filter(Boolean);

  const addTagWeight = (map, tag, weight) => {
    const key = String(tag || "").trim();
    if (!key) return;
    map[key] = (Number(map[key] || 0) || 0) + weight;
  };

  const computeGuideProgress = (guideId, guide) => {
    const gid = String(guideId || "").trim();
    if (!gid) return { done: 0, total: 0, pct: 0 };
    const steps = Array.isArray(guide?.steps) ? guide.steps : [];
    const total = steps.length;
    if (!total) return { done: 0, total: 0, pct: 0 };
    const key = `${STORAGE_KEYS.guideChecklistPrefix}${gid}`;
    const done = Math.min(readStringList(key).length, total);
    const pct = clampNumber(Math.round((done / total) * 100), 0, 100);
    return { done, total, pct };
  };

  const buildInterestWeights = (data) => {
    const weights = {};
    const savedGames = readStringList(STORAGE_KEYS.savedGames);
    const savedGuides = readStringList(STORAGE_KEYS.savedGuides);
    const savedTopics = readStringList(STORAGE_KEYS.savedTopics);
    const recentGames = readStringList(STORAGE_KEYS.recentGames);
    const recentGuides = readStringList(STORAGE_KEYS.recentGuides);
    const library = readGameLibraryMap();

    savedGames.forEach((id) => normalizeTagList(data?.games?.[id]?.tags).forEach((t) => addTagWeight(weights, t, 5)));
    savedGuides.forEach((id) => normalizeTagList(data?.guides?.[id]?.tags).forEach((t) => addTagWeight(weights, t, 4)));
    savedTopics.forEach((id) => normalizeTagList(data?.topics?.[id]?.tags).forEach((t) => addTagWeight(weights, t, 2)));

    recentGames.slice(0, 10).forEach((id) => normalizeTagList(data?.games?.[id]?.tags).forEach((t) => addTagWeight(weights, t, 3)));
    recentGuides.slice(0, 10).forEach((id) => normalizeTagList(data?.guides?.[id]?.tags).forEach((t) => addTagWeight(weights, t, 2)));

    Object.entries(library).forEach(([id, entry]) => {
      const status = normalizeGameLibraryStatus(entry?.status);
      const w = status === "playing" ? 6 : status === "wishlist" ? 3 : status === "done" ? 1 : 0;
      if (!w) return;
      normalizeTagList(data?.games?.[id]?.tags).forEach((t) => addTagWeight(weights, t, w));
    });

    const checklistKeys = listLocalStorageKeys().filter((k) => k.startsWith(STORAGE_KEYS.guideChecklistPrefix));
    checklistKeys.forEach((key) => {
      const id = key.slice(String(STORAGE_KEYS.guideChecklistPrefix).length);
      const guide = data?.guides?.[id];
      if (!guide) return;
      const progress = computeGuideProgress(id, guide);
      if (progress.pct > 0 && progress.pct < 100) {
        normalizeTagList(guide.tags).forEach((t) => addTagWeight(weights, t, 3));
      }
    });

    return weights;
  };

  const PLAYSTYLE_ARCHETYPES = [
    {
      id: "action",
      label: "动作爆发",
      tags: ["动作", "连招", "Boss", "Boss战", "魂系", "招架", "硬核", "高难"],
      tone: "#0ea5e9",
    },
    {
      id: "strategy",
      label: "策略筹谋",
      tags: ["策略", "回合制", "科技树", "内政", "外交", "运营", "资源", "扩张"],
      tone: "#f97316",
    },
    {
      id: "story",
      label: "叙事沉浸",
      tags: ["叙事", "剧情", "开放世界", "探索", "东方幻想", "世界观", "任务"],
      tone: "#22c55e",
    },
    {
      id: "build",
      label: "构筑掌控",
      tags: ["Build", "构筑", "装备", "技能", "队伍", "词条", "搭配"],
      tone: "#14b8a6",
    },
    {
      id: "efficiency",
      label: "效率路线",
      tags: ["效率", "刷装", "路线", "收集", "节奏", "规划"],
      tone: "#eab308",
    },
  ];

  const computePlaystyleDna = (weights) => {
    const entries = PLAYSTYLE_ARCHETYPES.map((arc) => {
      const score = arc.tags.reduce((sum, tag) => sum + (Number(weights?.[tag] || 0) || 0), 0);
      return { ...arc, score };
    });
    const total = entries.reduce((sum, item) => sum + item.score, 0) || 1;
    const bars = entries
      .map((item) => ({
        id: item.id,
        label: item.label,
        tone: item.tone,
        pct: clampNumber(Math.round((item.score / total) * 100), 0, 100),
      }))
      .sort((a, b) => b.pct - a.pct);

    const topTags = Object.entries(weights || {})
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 8)
      .map(([tag]) => tag);

    return { bars, topTags };
  };

  const computeMomentum = (data) => {
    const recentGames = readStringList(STORAGE_KEYS.recentGames);
    const recentGuides = readStringList(STORAGE_KEYS.recentGuides);
    const savedGames = readStringList(STORAGE_KEYS.savedGames);
    const savedGuides = readStringList(STORAGE_KEYS.savedGuides);
    const library = readGameLibraryMap();
    const planState = readPlansState?.() || { currentId: "", plans: {} };
    const currentPlan = planState.currentId ? planState.plans?.[planState.currentId] : null;
    const planCount = Array.isArray(currentPlan?.items) ? currentPlan.items.length : 0;

    const checklistKeys = listLocalStorageKeys().filter((k) => k.startsWith(STORAGE_KEYS.guideChecklistPrefix));
    const inProgress = checklistKeys
      .map((key) => {
        const id = key.slice(String(STORAGE_KEYS.guideChecklistPrefix).length);
        const guide = data?.guides?.[id];
        if (!guide) return null;
        const progress = computeGuideProgress(id, guide);
        return progress.pct > 0 && progress.pct < 100 ? { id, guide, progress } : null;
      })
      .filter(Boolean);

    const scoreRaw =
      recentGames.length * 6 +
      recentGuides.length * 4 +
      inProgress.length * 12 +
      planCount * 2 +
      (savedGames.length + savedGuides.length) * 1.5;
    const score = clampNumber(Math.round(scoreRaw / 2.4), 0, 100);

    const level =
      score >= 80
        ? "高能推进"
        : score >= 60
          ? "稳定推进"
          : score >= 35
            ? "逐步升温"
            : "蓄力阶段";

    let nextAction = "先收藏 1-2 个游戏，系统会更懂你。";
    if (inProgress.length > 0) {
      const top = inProgress.sort((a, b) => b.progress.pct - a.progress.pct)[0];
      nextAction = `继续推进「${top.guide?.title || top.id}」`;
    } else {
      const playing = Object.entries(library)
        .filter(([, entry]) => normalizeGameLibraryStatus(entry?.status) === "playing")
        .map(([id]) => data?.games?.[id])
        .filter(Boolean)[0];
      if (playing) nextAction = `今天继续玩「${playing.title}」`;
      else if (planCount > 0) nextAction = "打开路线规划，做一次优先级排序。";
    }

    return { score, level, nextAction, planCount };
  };

  const estimateGameSessionMinutes = (game) => {
    const raw = String(game?.playtime || "");
    const nums = raw.match(/\d+/g)?.map((n) => Number(n)) || [];
    const avg = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] || 0;
    if (!avg) return 60;
    if (avg <= 20) return 45;
    if (avg <= 50) return 60;
    return 90;
  };

  const buildSprintSchedule = (plan, data, focusMinutes) => {
    const items = Array.isArray(plan?.items) ? plan.items : [];
    const tasks = items.map((item) => {
      if (item.type === "guide") {
        const guide = data?.guides?.[item.id];
        const minutes = Math.max(10, Math.round(Number(guide?.readingTime || 0) || 20));
        return { id: item.id, type: "guide", label: guide?.title || item.id, minutes };
      }
      const game = data?.games?.[item.id];
      const minutes = estimateGameSessionMinutes(game);
      return { id: item.id, type: "game", label: game?.title || item.id, minutes };
    });

    const focus = clampNumber(focusMinutes, 20, 120);
    const sessions = [];
    let current = { minutes: 0, items: [] };

    tasks.forEach((task) => {
      if (current.items.length > 0 && current.minutes + task.minutes > focus * 1.15) {
        sessions.push(current);
        current = { minutes: 0, items: [] };
      }
      current.items.push(task);
      current.minutes += task.minutes;
    });
    if (current.items.length > 0) sessions.push(current);

    const totalMinutes = tasks.reduce((sum, t) => sum + t.minutes, 0);
    return { sessions: sessions.slice(0, 8), totalMinutes };
  };

  const scorePlanItem = (item, data, library) => {
    if (!item || !data) return 0;
    if (item.type === "guide") {
      const guide = data.guides?.[item.id];
      const progress = computeGuideProgress(item.id, guide);
      const diff = difficultyRank(guide?.difficulty);
      const recency = parseDateKey(guide?.updated) / 100000000;
      const base = progress.pct > 0 && progress.pct < 100 ? 120 : 60;
      return base + diff * 6 + recency;
    }
    const game = data.games?.[item.id];
    const status = getGameLibraryStatus(item.id, library);
    const rating = Number(game?.rating || 0) || 0;
    const recency = parseDateKey(game?.updated) / 100000000;
    const base = status === "playing" ? 120 : status === "wishlist" ? 85 : status === "done" ? 30 : 55;
    return base + rating * 4 + recency;
  };

  const INTENT_PRESETS = [
    {
      id: "relaxed",
      label: "轻松上手",
      tags: ["入门", "新手", "通用", "探索", "剧情"],
    },
    {
      id: "challenge",
      label: "挑战拉满",
      tags: ["硬核", "高阶", "Boss", "魂系", "高难", "招架"],
    },
    {
      id: "story",
      label: "剧情沉浸",
      tags: ["叙事", "剧情", "开放世界", "东方幻想"],
    },
    {
      id: "strategy",
      label: "策略规划",
      tags: ["策略", "回合制", "科技树", "运营", "外交"],
    },
    {
      id: "build",
      label: "构筑刷装",
      tags: ["Build", "构筑", "装备", "技能", "队伍", "刷装"],
    },
  ];

  const computeIntentWeights = (intentId) => {
    const hit = INTENT_PRESETS.find((p) => p.id === intentId);
    if (!hit) return {};
    const weights = {};
    hit.tags.forEach((t) => addTagWeight(weights, t, 6));
    return weights;
  };

  const computeImpact = (type, item) => {
    const recency = parseDateKey(item?.updated) / 100000000;
    if (type === "games") {
      const rating = Number(item?.rating || 0) || 0;
      const diff = difficultyRank(item?.difficulty);
      const score = rating * 8 + diff * 6 + recency * 20;
      return clampNumber(score, 0, 100);
    }
    if (type === "guides") {
      const minutes = Number(item?.readingTime || 0) || 0;
      const diff = difficultyRank(item?.difficulty);
      const score = minutes * 1.2 + diff * 10 + recency * 18;
      return clampNumber(score, 0, 100);
    }
    const replies = Number(item?.replies || 0) || 0;
    const score = Math.log10(replies + 1) * 30 + recency * 15;
    return clampNumber(score, 0, 100);
  };

  const impactLevel = (score) => {
    if (score >= 75) return { label: "高影响", tone: "high" };
    if (score >= 45) return { label: "中影响", tone: "mid" };
    return { label: "轻影响", tone: "low" };
  };

  const computeTopicHeat = (topic) => {
    const replies = Number(topic?.replies || 0) || 0;
    const recency = parseDateKey(topic?.updated) / 100000000;
    const score = Math.log10(replies + 1) * 24 + recency * 16;
    return clampNumber(score, 0, 100);
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

  const getSearchParams = () => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (_) {
      return null;
    }
  };

  const readSearchString = (params, keys) => {
    if (!params) return "";
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      const v = params.get(k);
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };

  const readSearchList = (params, keys) => {
    if (!params) return [];
    const keyList = Array.isArray(keys) ? keys : [keys];
    const raw = keyList
      .flatMap((k) => params.getAll(k))
      .flatMap((v) => String(v || "").split(","))
      .map((v) => v.trim())
      .filter(Boolean);
    return Array.from(new Set(raw));
  };

  const readSearchBool = (params, keys, { truthy = ["1", "true"] } = {}) => {
    const v = readSearchString(params, keys).trim().toLowerCase();
    return truthy.includes(v);
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
  // Runtime Store + Network Client（请求拦截 & 状态闭环）
  // -------------------------

  /**
   * @typedef {Object} NetConnectionInfo
   * @property {string} effectiveType
   * @property {number} rtt
   * @property {number} downlink
   * @property {boolean} saveData
   */

  /**
   * @typedef {Object} NetRuntimeState
   * @property {boolean} online
   * @property {string} effectiveType
   * @property {number} rtt
   * @property {number} downlink
   * @property {boolean} saveData
   * @property {number} requestsInFlight
   * @property {number} lastErrorAt
   */

  const NET_CONSTANTS = {
    requestTimeoutMs: 6500,
    retryMax: 1,
    retryBaseDelayMs: 240,
    retryMaxDelayMs: 1200,
    memoryCacheTtlMs: 90 * 1000,
    prefetchHoverDelayMs: 80,
    prefetchMax: 24,
  };

  /**
   * @template T
   * @param {T} initialState
   */
  const createStore = (initialState) => {
    let state = initialState;
    const listeners = new Set();

    const getState = () => state;

    const setState = (updater, meta = {}) => {
      const next =
        typeof updater === "function"
          ? updater(state)
          : { ...(state && typeof state === "object" ? state : {}), ...(updater || {}) };
      if (next === state) return state;
      state = next;
      listeners.forEach((fn) => {
        try {
          fn(state, meta);
        } catch (_) {}
      });
      return state;
    };

    const subscribe = (fn) => {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    };

    return { getState, setState, subscribe };
  };

  const readConnectionInfo = () => {
    const empty = { effectiveType: "", rtt: 0, downlink: 0, saveData: false };
    try {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return empty;
      return {
        effectiveType: String(c.effectiveType || ""),
        rtt: Number(c.rtt || 0) || 0,
        downlink: Number(c.downlink || 0) || 0,
        saveData: Boolean(c.saveData),
      };
    } catch (_) {
      return empty;
    }
  };

  const netStore = createStore({
    online: true,
    ...readConnectionInfo(),
    requestsInFlight: 0,
    lastErrorAt: 0,
  });

  const withTimeout = async (promiseFactory, timeoutMs) => {
    const ms = Math.max(0, Number(timeoutMs || 0) || 0);
    if (!ms) return promiseFactory({ signal: null });

    let controller = null;
    try {
      controller = typeof AbortController === "function" ? new AbortController() : null;
    } catch (_) {
      controller = null;
    }

    const signal = controller?.signal || null;
    let id = 0;
    const timeout = new Promise((_, reject) => {
      id = window.setTimeout(() => {
        try {
          controller?.abort?.();
        } catch (_) {}
        reject(new Error("timeout"));
      }, ms);
    });

    try {
      return await Promise.race([promiseFactory({ signal }), timeout]);
    } finally {
      if (id) window.clearTimeout(id);
    }
  };

  const sleep = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms || 0) || 0)));

  const jitter = (baseMs, maxMs) => {
    const base = Math.max(0, Number(baseMs || 0) || 0);
    const max = Math.max(base, Number(maxMs || 0) || base);
    const span = Math.max(0, max - base);
    return base + Math.round(Math.random() * span);
  };

  const createMemoryCache = () => {
    const map = new Map();
    const get = (key) => {
      const k = String(key || "");
      if (!k) return null;
      const hit = map.get(k);
      if (!hit) return null;
      if (Date.now() > hit.expiresAt) {
        map.delete(k);
        return null;
      }
      return hit.value;
    };
    const set = (key, value, ttlMs) => {
      const k = String(key || "");
      if (!k) return false;
      const ttl = Math.max(0, Number(ttlMs || 0) || 0);
      map.set(k, { value, expiresAt: Date.now() + ttl });
      return true;
    };
    return { get, set };
  };

  /**
   * @param {{ store?: { getState: () => NetRuntimeState, setState: (updater: any) => any } }} [options]
   */
  const createRequestClient = ({ store } = {}) => {
    const inflight = new Map();
    const cache = createMemoryCache();

    const normalizeSameOriginUrl = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return null;
      if (raw.startsWith("//")) return null;

      try {
        const u = new URL(raw, window.location.href);
        if (u.origin !== window.location.origin) return null;
        return u.href;
      } catch (_) {
        return null;
      }
    };

    const bumpInflight = (delta) => {
      if (!store) return;
      store.setState((s) => ({
        ...s,
        requestsInFlight: Math.max(0, Number(s.requestsInFlight || 0) + Number(delta || 0)),
      }));
    };

    const onError = () => {
      if (!store) return;
      store.setState((s) => ({ ...s, lastErrorAt: Date.now() }));
    };

    const fetchTextOnce = async (href, { timeoutMs } = {}) =>
      withTimeout(
        async ({ signal }) => {
          const res = await fetch(href, {
            method: "GET",
            credentials: "same-origin",
            cache: "force-cache",
            signal,
          });
          if (!res || !res.ok) throw new Error(`http ${res?.status || 0}`);
          return await res.text();
        },
        timeoutMs
      );

    const requestText = async (url, { timeoutMs = NET_CONSTANTS.requestTimeoutMs, retry = true } = {}) => {
      const href = normalizeSameOriginUrl(url);
      if (!href) throw new Error("blocked url");

      const key = `text:${href}`;
      const cached = cache.get(key);
      if (typeof cached === "string") {
        // 背景刷新：避免高延迟网络下重复卡顿
        if (!inflight.has(key)) {
          inflight.set(
            key,
            (async () => {
              try {
                const fresh = await fetchTextOnce(href, { timeoutMs });
                cache.set(key, fresh, NET_CONSTANTS.memoryCacheTtlMs);
              } catch (_) {
                // ignore
              } finally {
                inflight.delete(key);
              }
            })()
          );
        }
        return cached;
      }

      if (inflight.has(key)) return inflight.get(key);

      const task = (async () => {
        bumpInflight(1);
        try {
          const runOnce = async () => fetchTextOnce(href, { timeoutMs });

          try {
            const text = await runOnce();
            cache.set(key, text, NET_CONSTANTS.memoryCacheTtlMs);
            return text;
          } catch (err) {
            if (!retry) throw err;
            const retries = Math.max(0, Number(NET_CONSTANTS.retryMax || 0) || 0);
            for (let i = 0; i < retries; i += 1) {
              await sleep(jitter(NET_CONSTANTS.retryBaseDelayMs, NET_CONSTANTS.retryMaxDelayMs));
              try {
                const text = await runOnce();
                cache.set(key, text, NET_CONSTANTS.memoryCacheTtlMs);
                return text;
              } catch (_) {
                // continue
              }
            }
            throw err;
          }
        } catch (err) {
          onError();
          throw err;
        } finally {
          bumpInflight(-1);
          inflight.delete(key);
        }
      })();

      inflight.set(key, task);
      return task;
    };

    const prefetch = async (url) => {
      const href = normalizeSameOriginUrl(url);
      if (!href) return false;
      try {
        // 预取只为“热缓存”（SW / HTTP cache），无需读取 body
        await withTimeout(
          async ({ signal }) => {
            const res = await fetch(href, {
              method: "GET",
              credentials: "same-origin",
              cache: "force-cache",
              signal,
            });
            void res;
            return true;
          },
          Math.min(2500, NET_CONSTANTS.requestTimeoutMs)
        );
        return true;
      } catch (_) {
        return false;
      }
    };

    return { requestText, prefetch };
  };

  const netClient = createRequestClient({ store: netStore });

  const createHealthMonitor = ({ store } = {}) => {
    const state = {
      startedAt: 0,
      running: false,
      fps: 0,
      frameCount: 0,
      lastFpsAt: 0,
      longTaskCount: 0,
      longTaskTotalMs: 0,
      cls: 0,
      lcpMs: 0,
      fcpMs: 0,
      inpMs: 0,
      samples: [],
      timer: 0,
      raf: 0,
      observers: [],
    };

    const now = () => {
      try {
        return performance.now();
      } catch (_) {
        return Date.now();
      }
    };

    const getMemory = () => {
      try {
        // Chromium only
        const mem = performance.memory;
        if (!mem) return null;
        const used = Number(mem.usedJSHeapSize || 0) || 0;
        const total = Number(mem.totalJSHeapSize || 0) || 0;
        const limit = Number(mem.jsHeapSizeLimit || 0) || 0;
        return { used, total, limit };
      } catch (_) {
        return null;
      }
    };

    const approxLocalStorageBytes = () => {
      try {
        let bytes = 0;
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (!k) continue;
          const v = localStorage.getItem(k) || "";
          // UTF-16 粗略估算：每个字符 2 bytes
          bytes += (k.length + v.length) * 2;
        }
        return bytes;
      } catch (_) {
        return 0;
      }
    };

    const getDomNodes = () => {
      try {
        return document.getElementsByTagName("*").length;
      } catch (_) {
        return 0;
      }
    };

    const observe = (type, handler, opts) => {
      try {
        if (!("PerformanceObserver" in window)) return null;
        const obs = new PerformanceObserver((list) => {
          try {
            handler(list.getEntries());
          } catch (_) {}
        });
        obs.observe({ type, buffered: true, ...(opts || {}) });
        state.observers.push(obs);
        return obs;
      } catch (_) {
        return null;
      }
    };

    const formatBytes = (b) => {
      const n = Number(b || 0) || 0;
      if (n <= 0) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      let v = n;
      let u = 0;
      while (v >= 1024 && u < units.length - 1) {
        v /= 1024;
        u += 1;
      }
      return `${v.toFixed(u === 0 ? 0 : 2)} ${units[u]}`;
    };

    const snapshot = ({ log = true } = {}) => {
      const mem = getMemory();
      const domNodes = getDomNodes();
      const lsBytes = approxLocalStorageBytes();
      const net = store?.getState?.() || {};

      const nav = (() => {
        try {
          const entry = performance.getEntriesByType("navigation")?.[0];
          if (!entry) return null;
          return {
            type: String(entry.type || ""),
            ttfb: Number(entry.responseStart || 0) || 0,
            domInteractive: Number(entry.domInteractive || 0) || 0,
            dcl: Number(entry.domContentLoadedEventEnd || 0) || 0,
            load: Number(entry.loadEventEnd || 0) || 0,
          };
        } catch (_) {
          return null;
        }
      })();

      const report = {
        "网络/在线": Boolean(net.online),
        "网络/类型": String(net.effectiveType || ""),
        "网络/RTT(ms)": Number(net.rtt || 0) || 0,
        "网络/请求中": Number(net.requestsInFlight || 0) || 0,
        "性能/FPS": Math.round(Number(state.fps || 0) || 0),
        "性能/LongTask": Number(state.longTaskCount || 0) || 0,
        "性能/LongTask(ms)": Math.round(Number(state.longTaskTotalMs || 0) || 0),
        "性能/CLS": Number(state.cls || 0) || 0,
        "性能/LCP(ms)": Math.round(Number(state.lcpMs || 0) || 0),
        "性能/FCP(ms)": Math.round(Number(state.fcpMs || 0) || 0),
        "性能/INP(ms)": Math.round(Number(state.inpMs || 0) || 0),
        "渲染/VListUpdate(ms)": Math.round(Number(runtimeMetrics.vlistLastUpdateMs || 0) || 0),
        "渲染/VListMounted": Number(runtimeMetrics.vlistMounted || 0) || 0,
        "渲染/VListRange": String(runtimeMetrics.vlistRange || ""),
        "页面/DOM节点": domNodes,
        "存储/localStorage": formatBytes(lsBytes),
        "内存/JSHeap": mem ? `${formatBytes(mem.used)} / ${formatBytes(mem.total)}` : "n/a",
      };

      const warnings = [];
      if (report["性能/FPS"] > 0 && report["性能/FPS"] < 50) warnings.push("FPS 偏低（可能有重渲染或长任务）");
      if ((Number(report["性能/LongTask"]) || 0) > 0) warnings.push("存在 LongTask（可用 Performance 面板定位）");
      if (Number(report["性能/CLS"] || 0) >= 0.12) warnings.push("CLS 偏高（注意布局抖动/图片尺寸占位）");
      if ((Number(report["性能/INP(ms)"]) || 0) >= 350) warnings.push("INP 偏高（交互响应延迟，优先排查长任务/重渲染）");
      if ((Number(net.requestsInFlight || 0) || 0) >= 6) warnings.push("并发请求较多（注意瀑布与缓存策略）");

      if (log) {
        console.groupCollapsed(`[GKB] 系统健康全景图 @ ${new Date().toLocaleString("zh-CN")}`);
        try {
          console.table(report);
        } catch (_) {
          console.log(report);
        }

        if (nav) {
          try {
            console.table({
              "导航/type": nav.type,
              "导航/TTFB(ms)": Math.round(nav.ttfb),
              "导航/DOM Interactive(ms)": Math.round(nav.domInteractive),
              "导航/DCL(ms)": Math.round(nav.dcl),
              "导航/Load(ms)": Math.round(nav.load),
            });
          } catch (_) {}
        }

        if (warnings.length > 0) console.warn("⚠️ Health Warnings:", warnings);
        console.groupEnd();
      }

      return { report, warnings, nav };
    };

    const tickFps = () => {
      if (!state.running) return;
      state.frameCount += 1;
      const t = now();
      if (!state.lastFpsAt) state.lastFpsAt = t;
      const delta = t - state.lastFpsAt;
      if (delta >= 1000) {
        state.fps = (state.frameCount * 1000) / delta;
        state.frameCount = 0;
        state.lastFpsAt = t;
      }
      state.raf = window.requestAnimationFrame(tickFps);
    };

    const start = ({ intervalMs = 5000, log = true } = {}) => {
      if (state.running) return;
      state.running = true;
      state.startedAt = Date.now();
      state.longTaskCount = 0;
      state.longTaskTotalMs = 0;
      state.cls = 0;
      state.lcpMs = 0;
      state.fcpMs = 0;
      state.inpMs = 0;

      // Long Task（主线程卡顿）
      observe("longtask", (entries) => {
        entries.forEach((e) => {
          state.longTaskCount += 1;
          state.longTaskTotalMs += Number(e.duration || 0) || 0;
        });
      });

      // CLS（布局抖动）
      observe("layout-shift", (entries) => {
        entries.forEach((e) => {
          if (e.hadRecentInput) return;
          state.cls += Number(e.value || 0) || 0;
        });
      });

      // LCP（首屏关键内容渲染）
      observe("largest-contentful-paint", (entries) => {
        const last = entries[entries.length - 1];
        if (!last) return;
        state.lcpMs = Math.max(state.lcpMs, Number(last.startTime || 0) || 0);
      });

      // FCP（首次内容绘制）
      observe("paint", (entries) => {
        entries.forEach((e) => {
          if (String(e.name || "") !== "first-contentful-paint") return;
          state.fcpMs = Math.max(state.fcpMs, Number(e.startTime || 0) || 0);
        });
      });

      // INP（交互延迟：简化近似值，浏览器不支持则自动降级）
      observe(
        "event",
        (entries) => {
          entries.forEach((e) => {
            const d = Number(e.duration || 0) || 0;
            if (d <= 0) return;
            state.inpMs = Math.max(state.inpMs, d);
          });
        },
        { durationThreshold: 40 }
      );

      // FPS loop
      state.raf = window.requestAnimationFrame(tickFps);

      const ms = Math.max(1000, Number(intervalMs || 0) || 5000);
      state.timer = window.setInterval(() => {
        if (!state.running) return;
        const mem = getMemory();
        const sample = {
          ts: Date.now(),
          fps: Number(state.fps || 0) || 0,
          longTaskCount: state.longTaskCount,
          longTaskTotalMs: state.longTaskTotalMs,
          cls: state.cls,
          lcpMs: state.lcpMs,
          heapUsed: mem?.used || 0,
        };
        state.samples.push(sample);
        if (state.samples.length > 120) state.samples.shift();
        if (log) snapshot();
      }, ms);

      if (log) snapshot();
    };

    const stop = () => {
      if (!state.running) return;
      state.running = false;

      if (state.timer) window.clearInterval(state.timer);
      state.timer = 0;

      if (state.raf) window.cancelAnimationFrame(state.raf);
      state.raf = 0;

      state.observers.forEach((obs) => {
        try {
          obs.disconnect();
        } catch (_) {}
      });
      state.observers = [];
    };

    return {
      snapshot,
      start,
      stop,
      getState: () => ({ ...state, observers: state.observers.length }),
    };
  };

  const healthMonitor = createHealthMonitor({ store: netStore });
  const logger = (() => {
    const MAX_LOGS = 180;
    const MAX_STR = 260;
    const MAX_META_KEYS = 12;
    const MAX_META_STR = 120;

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
      const entries = Object.entries(meta).slice(0, MAX_META_KEYS);
      entries.forEach(([k, v]) => {
        const key = truncate(String(k || "").trim(), 48);
        if (!key) return;
        if (typeof v === "string") out[key] = truncate(v, MAX_META_STR);
        else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
        else if (typeof v === "boolean") out[key] = v;
      });
      return Object.keys(out).length > 0 ? out : undefined;
    };

    const read = () => {
      const raw = storage.get(STORAGE_KEYS.diagnosticsLogs);
      const list = safeJsonParse(raw, []);
      if (!Array.isArray(list)) return [];
      return list
        .filter((x) => x && typeof x === "object" && !Array.isArray(x))
        .slice(Math.max(0, list.length - MAX_LOGS));
    };

    const write = (events) => {
      const list = Array.isArray(events) ? events : [];
      const trimmed = list.slice(Math.max(0, list.length - MAX_LOGS));
      return storage.set(STORAGE_KEYS.diagnosticsLogs, JSON.stringify(trimmed));
    };

    const persistLevel = (level) => level === "info" || level === "warn" || level === "error";

    const log = (level, message, meta) => {
      const lvl = String(level || "").trim().toLowerCase();
      const okLevel = lvl === "debug" || lvl === "info" || lvl === "warn" || lvl === "error";
      const l = okLevel ? lvl : "info";

      const msg = truncate(safeToString(message).trim(), MAX_STR);
      if (!msg) return false;

      // 控制台输出（不影响主流程）
      try {
        const fn =
          l === "error"
            ? console.error
            : l === "warn"
              ? console.warn
              : l === "debug"
                ? console.debug
                : console.log;
        fn?.call?.(console, `[GKB] ${msg}`);
      } catch (_) {}

      if (!persistLevel(l)) return true;

      const entry = {
        ts: Date.now(),
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

    const clear = () => storage.remove(STORAGE_KEYS.diagnosticsLogs);

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
  })();
  const diagnostics = (() => {
    const MAX_ERRORS = 80;
    const MAX_STR = 240;
    const MAX_STACK = 1600;
    const MAX_META_KEYS = 12;
    const MAX_META_STR = 120;

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
      const entries = Object.entries(meta).slice(0, MAX_META_KEYS);
      entries.forEach(([k, v]) => {
        const key = truncate(String(k || "").trim(), 48);
        if (!key) return;
        if (typeof v === "string") out[key] = truncate(v, MAX_META_STR);
        else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
        else if (typeof v === "boolean") out[key] = v;
      });
      return Object.keys(out).length > 0 ? out : undefined;
    };

    const readErrors = () => {
      const raw = storage.get(STORAGE_KEYS.diagnosticsErrors);
      const list = safeJsonParse(raw, []);
      if (!Array.isArray(list)) return [];
      return list
        .filter((x) => x && typeof x === "object" && !Array.isArray(x))
        .slice(Math.max(0, list.length - MAX_ERRORS));
    };

    const writeErrors = (events) => {
      const list = Array.isArray(events) ? events : [];
      const trimmed = list.slice(Math.max(0, list.length - MAX_ERRORS));
      return storage.set(STORAGE_KEYS.diagnosticsErrors, JSON.stringify(trimmed));
    };

    const captureError = (error, { kind = "error", source = "", meta } = {}) => {
      const message = truncate(safeToString(error).trim(), MAX_STR);
      if (!message) return false;

      const entry = {
        ts: Date.now(),
        kind: truncate(kind, 32),
        page: truncate(getPage?.() || "", 32),
        source: truncate(source, 48),
        message,
      };

      try {
        const stack = error instanceof Error ? error.stack : "";
        const s = truncate(String(stack || "").trim(), MAX_STACK);
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
        telemetry.log("runtime_error", {
          kind: entry.kind,
          source: entry.source,
          msg: entry.message,
        });
      } catch (_) {
        // ignore
      }

      return true;
    };

    const clearErrors = () => storage.remove(STORAGE_KEYS.diagnosticsErrors);

    const buildBundle = ({ includeTelemetry = true, includeHealth = true } = {}) => {
      const data = getData?.() || null;
      const version = String(data?.version || "");
      const exportedAt = new Date().toISOString();
      const page = String(getPage?.() || "");

      const bundle = {
        schema: "gkb-diagnostics",
        version,
        exportedAt,
        page,
        url: String(window.location?.href || ""),
        userAgent: String(navigator.userAgent || ""),
        errors: readErrors(),
        logs: logger.read().slice(-240),
      };

      if (includeTelemetry) {
        try {
          bundle.telemetry = telemetry.read().slice(-240);
          bundle.telemetryEnabled = telemetry.isEnabled();
        } catch (_) {}
      }

      if (includeHealth) {
        try {
          bundle.health = healthMonitor.snapshot({ log: false });
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
  })();

  // 暴露只读句柄：便于调试/扩展，但避免把内部实现散落在全局
  try {
    window.GKB = window.GKB || {};
    window.GKB.runtime = window.GKB.runtime || {};
    window.GKB.runtime.netStore = netStore;
    window.GKB.runtime.net = netClient;
    window.GKB.runtime.health = healthMonitor;
    window.GKB.runtime.telemetry = telemetry;
    window.GKB.runtime.diagnostics = diagnostics;
    window.GKB.runtime.logger = logger;
    window.GKB.health = () => healthMonitor.snapshot();
  } catch (_) {
    // ignore
  }

  const initNetworkStateLoop = () => {
    const syncOnline = () => {
      let online = true;
      try {
        online = Boolean(navigator.onLine);
      } catch (_) {
        online = true;
      }
      netStore.setState({ online });
    };

    const syncConnection = () => netStore.setState(readConnectionInfo());

    syncOnline();
    syncConnection();

    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    try {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      c?.addEventListener?.("change", syncConnection);
    } catch (_) {}
  };

  const canPrefetchNow = () => {
    const s = netStore.getState();
    if (!s || !s.online) return false;
    if (s.saveData) return false;
    const type = String(s.effectiveType || "");
    if (type === "slow-2g" || type === "2g") return false;
    return true;
  };

  const prefetchedUrls = new Set();

  const prefetchUrls = (urls, { limit = 8, reason = "" } = {}) => {
    if (!canPrefetchNow()) return false;
    const next = Array.from(new Set((Array.isArray(urls) ? urls : []).map((x) => String(x || "").trim()).filter(Boolean)))
      .filter((href) => (href ? !prefetchedUrls.has(href) : false))
      .slice(0, Math.max(0, Number(limit || 0) || 0));
    if (next.length === 0) return false;

    next.forEach((href) => prefetchedUrls.add(href));
    if (prefetchedUrls.size > 900) prefetchedUrls.clear();

    telemetry.log("prefetch", { reason: String(reason || "auto").slice(0, 24), n: next.length });
    runIdleTask(() => next.forEach((href) => netClient.prefetch(href)), { timeout: 1200 });
    return true;
  };

  const initLinkPrefetch = () => {
    const prefetched = new Set();
    let hoverTimer = 0;
    let lastHoverHref = "";

    const normalize = (href) => {
      const raw = String(href || "").trim();
      if (!raw) return null;
      if (raw.startsWith("#")) return null;
      if (raw.startsWith("mailto:") || raw.startsWith("tel:")) return null;

      let url = null;
      try {
        url = new URL(raw, window.location.href);
      } catch (_) {
        return null;
      }
      if (url.origin !== window.location.origin) return null;
      if (!url.pathname.toLowerCase().endsWith(".html")) return null;
      return url.href;
    };

    const schedule = (href) => {
      const normalized = normalize(href);
      if (!normalized) return;
      if (!canPrefetchNow()) return;
      if (prefetched.has(normalized)) return;
      if (prefetched.size >= NET_CONSTANTS.prefetchMax) return;

      if (hoverTimer) window.clearTimeout(hoverTimer);
      lastHoverHref = normalized;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = 0;
        const next = lastHoverHref;
        if (!next) return;
        if (prefetched.has(next)) return;
        prefetched.add(next);
        netClient.prefetch(next);
      }, NET_CONSTANTS.prefetchHoverDelayMs);
    };

    document.addEventListener(
      "pointerover",
      (e) => {
        const a = e.target?.closest?.("a[href]");
        if (!a) return;
        schedule(a.getAttribute("href") || "");
      },
      { passive: true }
    );

    document.addEventListener(
      "focusin",
      (e) => {
        const a = e.target?.closest?.("a[href]");
        if (!a) return;
        schedule(a.getAttribute("href") || "");
      },
      { passive: true }
    );
  };

  // -------------------------
  // Virtual List Engine（0 依赖 / 10w 级数据量可用）
  // -------------------------

  const runtimeMetrics = {
    vlistLastUpdateMs: 0,
    vlistMounted: 0,
    vlistRange: "",
  };

  const VLIST = {
    // 超过此数量时自动启用虚拟列表（避免一次性 innerHTML 生成巨量 DOM）
    enableThreshold: 2200,
    overscanRows: 10,
    guidesRowHeight: 152,
    topicsRowHeight: 168,
  };

  const clampInt = (value, min, max) => {
    const n = Number(value);
    const i = Number.isFinite(n) ? Math.trunc(n) : 0;
    return Math.min(max, Math.max(min, i));
  };

  const createVirtualList = (host, { rowHeight, overscanRows = VLIST.overscanRows } = {}) => {
    if (!host) return null;

    const originalInline = {
      position: host.style.position || "",
      height: host.style.height || "",
      display: host.style.display || "",
      overflow: host.style.overflow || "",
    };

    host.style.position = "relative";
    host.style.display = "block";
    host.style.overflow = "visible";
    host.innerHTML = "";

    /** @type {{ key: string, data: any }[]} */
    let items = [];
    let renderRevision = 1;

    const pool = [];
    const mounted = new Map(); // key -> element
    let raf = 0;
    let destroyed = false;

    const getScrollY = () => {
      try {
        return window.scrollY || window.pageYOffset || 0;
      } catch (_) {
        return 0;
      }
    };

    const getViewportHeight = () => {
      try {
        return window.innerHeight || document.documentElement.clientHeight || 0;
      } catch (_) {
        return 0;
      }
    };

    const schedule = () => {
      if (destroyed) return;
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    const ensureRow = () => {
      const el = pool.pop() || document.createElement("div");
      el.className = "vlist-row";
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.right = "0";
      el.style.height = `${rowHeight}px`;
      el.style.willChange = "transform";
      return el;
    };

    const releaseRow = (el) => {
      try {
        el.remove();
      } catch (_) {}
      pool.push(el);
    };

    const update = () => {
      raf = 0;
      if (destroyed) return;

      const t0 = (() => {
        try {
          return performance.now();
        } catch (_) {
          return Date.now();
        }
      })();

      const count = items.length;
      host.style.height = `${count * rowHeight}px`;

      const rect = host.getBoundingClientRect();
      const hostTop = rect.top + getScrollY();
      const y = getScrollY() - hostTop;
      const viewport = getViewportHeight();

      const overscanPx = Math.max(0, overscanRows) * rowHeight;
      const start = clampInt((y - overscanPx) / rowHeight, 0, Math.max(0, count - 1));
      const end = clampInt((y + viewport + overscanPx) / rowHeight, 0, Math.max(0, count - 1));

      const desired = new Map(); // key -> index
      for (let i = start; i <= end; i += 1) {
        const entry = items[i];
        if (!entry) continue;
        desired.set(entry.key, i);
      }

      // 移除不可见行
      Array.from(mounted.keys()).forEach((key) => {
        if (desired.has(key)) return;
        const el = mounted.get(key);
        mounted.delete(key);
        if (el) releaseRow(el);
      });

      // 渲染/定位可见行（滚动时只做 transform 更新；数据变化时才重绘内容）
      desired.forEach((idx, key) => {
        const entry = items[idx];
        if (!entry) return;

        let el = mounted.get(key);
        if (!el) {
          el = ensureRow();
          el.dataset.vkey = key;
          mounted.set(key, el);
          host.appendChild(el);
        }

        const topPx = idx * rowHeight;
        el.style.transform = `translate3d(0, ${topPx}px, 0)`;

        const lastRev = Number(el.dataset.vrev || 0) || 0;
        if (lastRev !== renderRevision) {
          try {
            entry.render(el, entry.data);
            el.dataset.vrev = String(renderRevision);
          } catch (_) {
            // ignore
          }
        }
      });

      try {
        const t1 = (() => {
          try {
            return performance.now();
          } catch (_) {
            return Date.now();
          }
        })();
        runtimeMetrics.vlistLastUpdateMs = Math.max(0, t1 - t0);
        runtimeMetrics.vlistMounted = mounted.size;
        runtimeMetrics.vlistRange = `${start}-${end}/${count}`;
      } catch (_) {}
    };

    const onScroll = () => schedule();
    const onResize = () => schedule();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    const setItems = (nextItems) => {
      items = Array.isArray(nextItems) ? nextItems : [];
      renderRevision += 1;
      schedule();
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;

      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);

      Array.from(mounted.values()).forEach((el) => releaseRow(el));
      mounted.clear();
      pool.length = 0;

      host.style.position = originalInline.position;
      host.style.height = originalInline.height;
      host.style.display = originalInline.display;
      host.style.overflow = originalInline.overflow;
      host.innerHTML = "";
    };

    // 首次渲染
    schedule();

    return { setItems, update: schedule, destroy };
  };

  // Motion（内建 WAAPI 轻量适配层）
  // - 提供最小可用的 `animate()` 与 `stagger()`，满足本站动效需求
  // - 无第三方依赖；不支持 WAAPI 的浏览器安全降级为 no-op
  const createMotionLite = () => {
    const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

    const toMs = (seconds) => {
      const n = Number(seconds);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.round(n * 1000));
    };

    const toCssEasing = (easing) => {
      if (
        Array.isArray(easing) &&
        easing.length === 4 &&
        easing.every((x) => typeof x === "number" && Number.isFinite(x))
      ) {
        const [x1, y1, x2, y2] = easing;
        return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
      }
      if (typeof easing === "string" && easing.trim()) return easing.trim();
      return "linear";
    };

    const normalizeTargets = (target) => {
      if (!target) return [];

      if (typeof target === "string") {
        try {
          return Array.from(document.querySelectorAll(target));
        } catch (_) {
          return [];
        }
      }

      if (target instanceof Element) return [target];

      // Array / NodeList / HTMLCollection
      if (Array.isArray(target) || (typeof target.length === "number" && typeof target !== "function")) {
        try {
          return Array.from(target).filter((x) => x instanceof Element);
        } catch (_) {
          return [];
        }
      }

      return [];
    };

    const pick = (value, index) => {
      if (!Array.isArray(value)) return value;
      if (value.length === 0) return undefined;
      return value[Math.min(index, value.length - 1)];
    };

    const withUnit = (value, unit) => {
      if (value == null) return null;
      if (isFiniteNumber(value)) return `${value}${unit}`;
      const s = String(value).trim();
      if (!s) return null;
      return s;
    };

    const buildTransform = (base, frame) => {
      const parts = [];

      const baseStr = String(base || "").trim();
      if (baseStr && baseStr !== "none") parts.push(baseStr);

      // 若显式提供 transform，则优先使用（但仍保留 base）
      if (Object.prototype.hasOwnProperty.call(frame, "transform")) {
        const t = String(frame.transform || "").trim();
        if (t && t !== "none") parts.push(t);
        return parts.length ? parts.join(" ") : undefined;
      }

      const x = frame.x;
      const y = frame.y;
      const scale = frame.scale;
      const rotate = frame.rotate;

      const hasXY = x != null || y != null;
      if (hasXY) {
        const tx = withUnit(x ?? 0, "px") ?? "0px";
        const ty = withUnit(y ?? 0, "px") ?? "0px";
        parts.push(`translate(${tx}, ${ty})`);
      }

      if (scale != null) parts.push(`scale(${scale})`);

      if (rotate != null) {
        const r = withUnit(rotate, "deg") ?? "0deg";
        parts.push(`rotate(${r})`);
      }

      return parts.length ? parts.join(" ") : undefined;
    };

    const normalizeKeyframes = (keyframes, baseTransform) => {
      if (!keyframes) return [];
      if (Array.isArray(keyframes)) return keyframes;

      const keys = Object.keys(keyframes);
      let count = 0;

      for (const k of keys) {
        const v = keyframes[k];
        if (Array.isArray(v)) count = Math.max(count, v.length);
      }
      if (count === 0) count = 1;

      const frames = [];
      for (let i = 0; i < count; i += 1) {
        const frame = {};

        for (const k of keys) {
          const v = pick(keyframes[k], i);
          if (v !== undefined) frame[k] = v;
        }

        const transform = buildTransform(baseTransform, frame);
        if (transform !== undefined) frame.transform = transform;

        // 移除 motion-only 的快捷字段，避免污染 WAAPI
        delete frame.x;
        delete frame.y;
        delete frame.scale;
        delete frame.rotate;

        frames.push(frame);
      }

      return frames;
    };

    const safeFinished = (anim) => {
      try {
        const p = anim?.finished;
        if (p && typeof p.then === "function") return p.catch(() => {});
      } catch (_) {}
      return Promise.resolve();
    };

    const Motion = { __lite: true };

    Motion.animate = (target, keyframes, options = {}) => {
      const elements = normalizeTargets(target);
      if (elements.length === 0) return null;

      const first = elements[0];
      if (!first || typeof first.animate !== "function") return null;

      const duration = toMs(options.duration);
      const easing = toCssEasing(options.easing);
      const fill = options.fill || "both";

      const delayOpt = options.delay;
      const direction = options.direction;
      const iterations = options.iterations;

      const animations = [];

      for (let i = 0; i < elements.length; i += 1) {
        const el = elements[i];
        if (!el || typeof el.animate !== "function") continue;

        const baseTransform = (() => {
          try {
            return getComputedStyle(el).transform || "";
          } catch (_) {
            return "";
          }
        })();

        const frames = normalizeKeyframes(keyframes, baseTransform);

        const delaySeconds = typeof delayOpt === "function" ? delayOpt(i, elements.length) : delayOpt;
        const delay = toMs(delaySeconds);

        const waapiOptions = { duration, delay, easing, fill };
        if (direction != null) waapiOptions.direction = direction;
        if (iterations != null) waapiOptions.iterations = iterations;

        try {
          const anim = el.animate(frames, waapiOptions);
          animations.push(anim);
        } catch (_) {
          // ignore
        }
      }

      if (animations.length === 0) return null;
      if (animations.length === 1) return animations[0];

      // 与 Motion 的“返回控制对象”行为对齐：至少提供 finished
      return {
        animations,
        finished: Promise.allSettled(animations.map(safeFinished)).then(() => {}),
      };
    };

    Motion.stagger = (step = 0.1, { startDelay = 0, from = 0 } = {}) => {
      const stepNum = Number(step);
      const startNum = Number(startDelay);
      const safeStep = Number.isFinite(stepNum) ? stepNum : 0;
      const safeStart = Number.isFinite(startNum) ? startNum : 0;

      const originIndex = (total) => {
        const len = Math.max(0, Number(total) || 0);
        if (typeof from === "number" && Number.isFinite(from)) return from;

        const key = String(from || "").trim().toLowerCase();
        if (key === "last") return Math.max(0, len - 1);
        if (key === "center") return Math.max(0, len - 1) / 2;
        return 0;
      };

      return (index, total) => {
        const i = Number(index) || 0;
        const o = originIndex(total);
        const dist = Math.abs(o - i);
        return safeStart + safeStep * dist;
      };
    };

    return Motion;
  };

  const MotionLite = (() => {
    try {
      if (typeof Element === "undefined") return null;
      if (typeof Element.prototype.animate !== "function") return null;
      return createMotionLite();
    } catch (_) {
      return null;
    }
  })();

  const getMotion = () => MotionLite;

  // Motion tokens（全站统一：便于回归与调参）
  const MOTION = {
    easeOut: [0.22, 1, 0.36, 1],
    easeIn: [0.4, 0, 1, 1],
    durFast: 0.16,
    durBase: 0.22,
    durSlow: 0.28,
  };

  const motionAnimate = (el, keyframes, options = {}) => {
    const Motion = prefersReducedMotion() ? null : getMotion();
    if (!Motion || !el) return null;
    try {
      return Motion.animate(el, keyframes, { duration: MOTION.durBase, easing: MOTION.easeOut, ...options });
    } catch (_) {
      return null;
    }
  };

  const motionFinished = (anim) => {
    try {
      const p = anim?.finished;
      if (p && typeof p.then === "function") return p.catch(() => {});
    } catch (_) {}
    return Promise.resolve();
  };

  const motionStagger = (step = 0.03, options = undefined) => {
    const Motion = prefersReducedMotion() ? null : getMotion();
    if (!Motion || typeof Motion.stagger !== "function") return null;
    try {
      return Motion.stagger(step, options);
    } catch (_) {
      return null;
    }
  };

  const motionPulse = (el, { scale = 1.045, duration = MOTION.durSlow } = {}) => {
    return motionAnimate(el, { scale: [1, scale, 1] }, { duration });
  };

  const motionSpark = (el) => {
    return motionAnimate(
      el,
      {
        scale: [1, 1.25, 1.02, 1],
        rotate: [0, -8, 6, 0],
        filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(0px)"],
      },
      { duration: 0.34 }
    );
  };

  const motionFlash = (el) => {
    return motionAnimate(
      el,
      {
        filter: ["brightness(1)", "brightness(1.08)", "brightness(1)"],
        opacity: [1, 1, 1],
      },
      { duration: 0.32 }
    );
  };

  const animateSavePill = (btn, isSaved) => {
    if (!btn) return;
    const star = $(".save-star", btn);
    const target = star || btn;
    if (isSaved) {
      motionSpark(target);
      return;
    }
    motionAnimate(target, { scale: [1, 0.92, 1], rotate: [0, 6, 0], opacity: [1, 0.92, 1] }, { duration: 0.24 });
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

  // -------------------------
  // Micro Interactions（Spotlight / Ripple）
  // - Spotlight：卡片 hover 追光（CSS ::after + JS 写入 --fx-x/--fx-y）
  // - Ripple：点击波纹（注入 span.fx-ripple；纯 UI，无业务语义）
  // 约束：尊重 prefers-reduced-motion / prefers-reduced-transparency / 高对比度
  // -------------------------

  const initMicroInteractions = () => {
    // Spotlight：仅在“hover + fine pointer”环境启用（移动端/触摸屏默认跳过）
    const canSpotlight = () => {
      if (prefersReducedMotion()) return false;
      try {
        if (document.documentElement.dataset.contrast === "high") return false;
      } catch (_) {}

      try {
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-transparency: reduce)").matches
        ) {
          return false;
        }
      } catch (_) {}

      try {
        return Boolean(
          window.matchMedia &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
        );
      } catch (_) {
        return false;
      }
    };

    const SPOTLIGHT_SELECTOR =
      ".game-card, .discussion-card, .article-card, .bento-card, .mini-card, .topic-card, .update-card, .reply-card, .recent-card";

    if (canSpotlight()) {
      let active = null;
      let raf = 0;
      let lastX = 0;
      let lastY = 0;

      const apply = () => {
        raf = 0;
        if (!active) return;

        let rect = null;
        try {
          rect = active.getBoundingClientRect();
        } catch (_) {
          rect = null;
        }
        if (!rect) return;

        const x = Math.min(Math.max(0, lastX - rect.left), rect.width);
        const y = Math.min(Math.max(0, lastY - rect.top), rect.height);

        try {
          active.style.setProperty("--fx-x", `${x}px`);
          active.style.setProperty("--fx-y", `${y}px`);
        } catch (_) {}
      };

      const schedule = () => {
        if (raf) return;
        raf = window.requestAnimationFrame(apply);
      };

      document.addEventListener(
        "pointermove",
        (e) => {
          try {
            if (document.documentElement.dataset.contrast === "high") return;
          } catch (_) {}

          const el = e.target?.closest?.(SPOTLIGHT_SELECTOR) || null;
          active = el;
          if (!active) return;
          lastX = e.clientX;
          lastY = e.clientY;
          schedule();
        },
        { passive: true }
      );
    }

    const INTERACT_SELECTOR = ".btn, .btn-small, .icon-button, .chip, .tag";

    const isPrimaryPointer = (e) => {
      if (!e) return false;
      // touch/pen：button 可能为 undefined
      if (e.button == null) return true;
      return e.button === 0;
    };

    // Magnetic + Press + Ripple：点击/悬停的“物理感”
    // - 约束：Reduced Motion 下不启用（避免强制动画）；高对比度模式下不启用磁吸
    if (!prefersReducedMotion()) {
      // Press：让触摸设备也获得稳定的按压反馈（不依赖 :active 的浏览器差异）
      const pressed = new Set();
      const clearPressed = () => {
        pressed.forEach((el) => {
          try {
            el.classList.remove("is-pressed");
          } catch (_) {}
        });
        pressed.clear();
      };

      window.addEventListener("blur", clearPressed);
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.hidden) clearPressed();
        },
        { passive: true }
      );
      document.addEventListener("pointerup", clearPressed, { capture: true, passive: true });
      document.addEventListener("pointercancel", clearPressed, { capture: true, passive: true });

      // Ripple：点击即时反馈（可在 CSS 中统一手感；JS 只负责注入与定位）
      const MAX_RIPPLES = 2;

      const cleanupRipples = (host) => {
        if (!host) return;
        try {
          const list = Array.from(host.querySelectorAll(".fx-ripple"));
          if (list.length <= MAX_RIPPLES) return;
          list
            .slice(0, Math.max(0, list.length - MAX_RIPPLES))
            .forEach((el) => el.remove());
        } catch (_) {}
      };

      document.addEventListener(
        "pointerdown",
        (e) => {
          if (!isPrimaryPointer(e)) return;
          const host = e.target?.closest?.(INTERACT_SELECTOR);
          if (!host) return;

          try {
            host.classList.add("is-pressed");
            pressed.add(host);
          } catch (_) {}

          let rect = null;
          try {
            rect = host.getBoundingClientRect();
          } catch (_) {
            rect = null;
          }
          if (!rect) return;

          const size = Math.max(rect.width, rect.height) * 1.35;
          const cx =
            (typeof e.clientX === "number" ? e.clientX : rect.left + rect.width / 2) -
            rect.left;
          const cy =
            (typeof e.clientY === "number" ? e.clientY : rect.top + rect.height / 2) -
            rect.top;

          const x = cx - size / 2;
          const y = cy - size / 2;

          const ripple = document.createElement("span");
          ripple.className = "fx-ripple";
          ripple.setAttribute("aria-hidden", "true");
          ripple.style.width = `${size}px`;
          ripple.style.height = `${size}px`;
          ripple.style.left = `${Math.round(x)}px`;
          ripple.style.top = `${Math.round(y)}px`;

          cleanupRipples(host);

          try {
            host.appendChild(ripple);
          } catch (_) {
            return;
          }

          const remove = () => {
            try {
              ripple.remove();
            } catch (_) {}
          };

          try {
            ripple.addEventListener("animationend", remove, { once: true });
          } catch (_) {}
          window.setTimeout(remove, 900);
        },
        { capture: true, passive: true }
      );

      // Magnetic：轻微“磁吸”跟随（rAF + spring），只改 CSS variables（UI/逻辑分离）
      const canMagnetic = () => {
        try {
          if (document.documentElement.dataset.contrast === "high") return false;
        } catch (_) {}

        try {
          if (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-transparency: reduce)").matches
          ) {
            return false;
          }
        } catch (_) {}

        try {
          return Boolean(
            window.matchMedia &&
              window.matchMedia("(hover: hover) and (pointer: fine)").matches
          );
        } catch (_) {
          return false;
        }
      };

      if (canMagnetic()) {
        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

        const physics = (() => {
          const items = new Map();
          let raf = 0;

          const getItem = (el) => {
            const existing = items.get(el);
            if (existing) return existing;
            const next = {
              el,
              x: 0,
              y: 0,
              vx: 0,
              vy: 0,
              tx: 0,
              ty: 0,
              lastT: 0,
            };
            items.set(el, next);
            return next;
          };

          const setTarget = (el, tx, ty) => {
            const item = getItem(el);
            item.tx = tx;
            item.ty = ty;
            if (!raf) raf = window.requestAnimationFrame(tick);
          };

          const release = (el) => {
            if (!el) return;
            const item = items.get(el);
            if (!item) return;
            item.tx = 0;
            item.ty = 0;
            if (!raf) raf = window.requestAnimationFrame(tick);
          };

          const tick = (t) => {
            raf = 0;
            const now = Number(t) || 0;

            items.forEach((item, el) => {
              if (!el || !(el instanceof Element)) {
                items.delete(el);
                return;
              }

              const dt = (() => {
                const prev = Number(item.lastT || 0) || 0;
                item.lastT = now;
                if (!prev) return 1 / 60;
                return clamp((now - prev) / 1000, 0.001, 0.033);
              })();

              // 经验参数：更像“Apple 的跟手”，不弹过头
              const stiffness = 240;
              const damping = 26;

              const ax = (item.tx - item.x) * stiffness - item.vx * damping;
              const ay = (item.ty - item.y) * stiffness - item.vy * damping;

              item.vx += ax * dt;
              item.vy += ay * dt;
              item.x += item.vx * dt;
              item.y += item.vy * dt;

              const done =
                Math.abs(item.tx - item.x) < 0.08 &&
                Math.abs(item.ty - item.y) < 0.08 &&
                Math.abs(item.vx) < 0.12 &&
                Math.abs(item.vy) < 0.12;

              try {
                el.style.setProperty("--fx-tx", `${item.x.toFixed(2)}px`);
                el.style.setProperty("--fx-ty", `${item.y.toFixed(2)}px`);
              } catch (_) {}

              if (done) {
                item.x = item.tx;
                item.y = item.ty;
                item.vx = 0;
                item.vy = 0;
                if (item.tx === 0 && item.ty === 0) {
                  try {
                    el.style.removeProperty("--fx-tx");
                    el.style.removeProperty("--fx-ty");
                  } catch (_) {}
                  items.delete(el);
                }
              }
            });

            if (items.size > 0) raf = window.requestAnimationFrame(tick);
          };

          return { setTarget, release };
        })();

        let active = null;
        let rafMove = 0;
        let lastX = 0;
        let lastY = 0;

        const updateTarget = () => {
          rafMove = 0;

          try {
            if (document.documentElement.dataset.contrast === "high") {
              if (active) physics.release(active);
              active = null;
              return;
            }
          } catch (_) {}

          if (!active) return;

          let rect = null;
          try {
            rect = active.getBoundingClientRect();
          } catch (_) {
            rect = null;
          }
          if (!rect) return;

          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const nx = rect.width > 0 ? clamp((lastX - cx) / (rect.width / 2), -1, 1) : 0;
          const ny = rect.height > 0 ? clamp((lastY - cy) / (rect.height / 2), -1, 1) : 0;

          const max = clamp(Math.min(rect.width, rect.height) * 0.06, 2.5, 8);
          physics.setTarget(active, nx * max, ny * max);
        };

        const scheduleMove = () => {
          if (rafMove) return;
          rafMove = window.requestAnimationFrame(updateTarget);
        };

        document.addEventListener(
          "pointermove",
          (e) => {
            const host = e.target?.closest?.(INTERACT_SELECTOR) || null;
            if (!host) {
              if (active) physics.release(active);
              active = null;
              return;
            }

            if (active && host !== active) physics.release(active);
            active = host;
            lastX = e.clientX;
            lastY = e.clientY;
            scheduleMove();
          },
          { passive: true }
        );

        document.addEventListener(
          "pointerleave",
          () => {
            if (active) physics.release(active);
            active = null;
          },
          { passive: true }
        );

        window.addEventListener("blur", () => {
          if (active) physics.release(active);
          active = null;
        });
      }
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

  const renderMetaList = (host, items, emptyText = "") => {
    if (!host) return;
    if (!items || items.length === 0) {
      host.innerHTML = emptyText
        ? `<div class="meta-item"><div class="meta-label">${escapeHtml(emptyText)}</div><div class="meta-value">—</div></div>`
        : "";
      return;
    }
    host.innerHTML = items
      .map(
        (item) => `
          <div class="meta-item">
            <div class="meta-label">${escapeHtml(item.label)}</div>
            <div class="meta-value">${escapeHtml(item.value)}</div>
          </div>
        `
      )
      .join("");
  };

  const renderMiniCards = (host, items, emptyText) => {
    if (!host) return;
    if (!items || items.length === 0) {
      host.innerHTML = `<div class="mini-card"><div><div class="mini-card-title">${escapeHtml(
        emptyText || "暂无内容"
      )}</div><div class="mini-card-desc">试试去游戏库/攻略库收藏一些内容。</div></div></div>`;
      return;
    }
    host.innerHTML = items
      .map((item) => {
        const icon = item.icon || "images/icons/rpg-icon.svg";
        const title = item.title || "未命名";
        const desc = item.desc || "";
        const href = item.href || "#";
        return `
          <a class="mini-card" href="${href}">
            <img src="${icon}" alt="${escapeHtml(title)}" loading="lazy">
            <div class="mini-card-body">
              <div class="mini-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
              <div class="mini-card-desc">${escapeHtml(desc)}</div>
            </div>
          </a>
        `;
      })
      .join("");
  };

  const renderChipList = (root, list, emptyText) => {
    if (!root) return;
    const items = normalizeTagList(list);
    if (items.length === 0) {
      root.innerHTML = emptyText ? `<span class="chip">${escapeHtml(emptyText)}</span>` : "";
      return;
    }
    root.innerHTML = items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  };

  const renderDnaBars = (root, bars) => {
    if (!root) return;
    const list = Array.isArray(bars) ? bars : [];
    if (list.length === 0) {
      root.innerHTML = '<div class="dna-empty">还没有足够的数据生成风格画像。</div>';
      return;
    }
    root.innerHTML = list
      .map(
        (bar) => `
          <div class="dna-bar">
            <span class="dna-label">${escapeHtml(bar.label)}</span>
            <div class="dna-track">
              <span class="dna-fill" style="width:${bar.pct}%; --dna-color:${escapeHtml(bar.tone)}"></span>
            </div>
            <span class="dna-value">${bar.pct}%</span>
          </div>
        `
      )
      .join("");
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
    const byId = new Map();

    const ensureRoot = () => {
      if (root) return root;
      root = document.createElement("div");
      root.className = "toast-root";
      root.setAttribute("aria-live", "polite");
      document.body.appendChild(root);
      return root;
    };

    const updateToastDom = (item, { title, message, tone }) => {
      if (!item) return;
      item.className = `toast toast-${tone}`;
      const titleEl = item.querySelector?.(".toast-title");
      const msgEl = item.querySelector?.(".toast-message");
      if (titleEl) titleEl.textContent = String(title || "");
      if (msgEl) msgEl.textContent = String(message || "");
    };

    const scheduleRemove = (item, remove, timeout) => {
      try {
        if (item._toastTimer) window.clearTimeout(item._toastTimer);
      } catch (_) {}
      const ms = Number(timeout);
      if (!Number.isFinite(ms) || ms <= 0) return;
      item._toastTimer = window.setTimeout(remove, ms);
    };

    return ({ id, title, message, tone = "info", timeout = 2600 } = {}) => {
      const host = ensureRoot();
      const key = String(id || "").trim();
      let item = key ? byId.get(key) : null;
      const isUpdate = Boolean(item && item.isConnected);

      if (!isUpdate) {
        item = document.createElement("div");
        item.className = `toast toast-${tone}`;
        item.innerHTML = `
          <div class="toast-title">${escapeHtml(title || "")}</div>
          <div class="toast-message">${escapeHtml(message || "")}</div>
        `;
        if (key) {
          item.dataset.toastId = key;
          byId.set(key, item);
        }
        host.appendChild(item);

        motionAnimate(
          item,
          { opacity: [0, 1], y: [10, 0], filter: ["blur(10px)", "blur(0px)"] },
          { duration: MOTION.durSlow }
        );

        item.addEventListener("click", () => {
          try {
            item._toastRemove?.();
          } catch (_) {}
        });
      } else {
        updateToastDom(item, { title, message, tone });
        motionPulse(item, { scale: 1.01, duration: MOTION.durBase });
      }

      // 通过 nonce 避免“旧 timer/旧 remove”误删新 toast
      const nonce = Number(item._toastNonce || 0) + 1;
      item._toastNonce = nonce;

      const remove = () => {
        if (!item || !item.isConnected) return;
        if (Number(item._toastNonce || 0) !== nonce) return;

        const finalize = () => {
          if (Number(item._toastNonce || 0) !== nonce) return;
          try {
            item.remove();
          } catch (_) {}
          if (key) byId.delete(key);
        };

        const anim = motionAnimate(
          item,
          { opacity: [1, 0], y: [0, -8], scale: [1, 0.98], filter: ["blur(0px)", "blur(10px)"] },
          { duration: MOTION.durFast }
        );

        if (anim) {
          motionFinished(anim).then(finalize).catch(finalize);
          return;
        }

        item.classList.add("toast-hide");
        window.setTimeout(finalize, 240);
      };

      item._toastRemove = remove;
      scheduleRemove(item, remove, timeout);
    };
  })();

  // -------------------------
  // Error Boundary（全局错误边界：本地记录 + 轻量提示）
  // -------------------------

  let errorBoundaryInstalled = false;
  let lastErrorToastAt = 0;

  const toastRuntimeErrorOnce = () => {
    const now = Date.now();
    if (now - lastErrorToastAt < 8000) return;
    lastErrorToastAt = now;

    toast({
      id: "gkb-runtime-error",
      title: "页面发生异常",
      message: "已记录到本地，可在指挥舱 → 系统诊断导出诊断包。",
      tone: "warn",
      timeout: 4200,
    });
  };

  const initErrorBoundary = () => {
    if (errorBoundaryInstalled) return;
    errorBoundaryInstalled = true;

    // 捕获 JS 运行时异常（以及资源加载错误）
    window.addEventListener(
      "error",
      (event) => {
        const targetTag = String(event?.target?.tagName || "").toLowerCase();
        const hasRuntimeError = event?.error instanceof Error || Boolean(event?.message);
        const isResourceError = Boolean(targetTag) && !hasRuntimeError;
        const kind = isResourceError ? "resource" : "error";

        const err =
          event?.error instanceof Error
            ? event.error
            : new Error(
                String(event?.message || (isResourceError ? "Resource error" : "Runtime error"))
              );

        diagnostics.captureError(err, {
          kind,
          source: "window.error",
          meta: {
            filename: String(event?.filename || ""),
            lineno: Number(event?.lineno || 0) || 0,
            colno: Number(event?.colno || 0) || 0,
            tag: targetTag,
          },
        });

        logger.log(isResourceError ? "warn" : "error", err, {
          source: "window.error",
          kind,
          tag: targetTag,
          filename: String(event?.filename || ""),
          lineno: Number(event?.lineno || 0) || 0,
        });

        // 资源错误通常较噪（图标缺失/扩展干扰），默认不弹 toast
        if (!isResourceError) toastRuntimeErrorOnce();
      },
      true
    );

    // 捕获 Promise 未处理拒绝
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event?.reason;
      const err =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");

      diagnostics.captureError(err, {
        kind: "unhandledrejection",
        source: "window.unhandledrejection",
      });

      logger.error(err, { source: "window.unhandledrejection" });

      toastRuntimeErrorOnce();
    });

    // CSP 违规对排障非常关键（尤其在离线/PWA场景）
    document.addEventListener("securitypolicyviolation", (event) => {
      diagnostics.captureError(new Error("CSP violation"), {
        kind: "securitypolicyviolation",
        source: "document.securitypolicyviolation",
        meta: {
          blockedURI: String(event?.blockedURI || ""),
          violatedDirective: String(event?.violatedDirective || ""),
          effectiveDirective: String(event?.effectiveDirective || ""),
          disposition: String(event?.disposition || ""),
        },
      });

      logger.warn("CSP violation", {
        source: "document.securitypolicyviolation",
        blockedURI: String(event?.blockedURI || ""),
        violatedDirective: String(event?.violatedDirective || ""),
      });
    });
  };

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
  // Diagnostics Panel（本地可观测性：错误 / 埋点 / 健康快照）
  // -------------------------

  const exportDiagnosticsBundle = () => {
    const bundle = diagnostics.buildBundle({ includeTelemetry: true, includeHealth: true });
    const version = String(bundle?.version || "");
    const exportedAt = String(bundle?.exportedAt || new Date().toISOString());
    const date = exportedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const safeVersion = version || "unknown";
    const fileName = `gkb-diagnostics-${safeVersion}-${date}.json`;

    const ok = downloadTextFile(fileName, JSON.stringify(bundle, null, 2));
    toast({
      title: ok ? "已导出诊断包" : "导出失败",
      message: ok ? "已下载 diagnostics JSON（仅包含本地信息）。" : "浏览器不支持下载或权限受限。",
      tone: ok ? "success" : "warn",
      timeout: 3200,
    });
    return ok;
  };

  let diagDialogRoot = null;
  let diagDialogLastActive = null;

  const formatTs = (ts) => {
    const n = Number(ts || 0) || 0;
    if (!n) return "—";
    try {
      return new Date(n).toLocaleString("zh-CN");
    } catch (_) {
      return new Date(n).toISOString();
    }
  };

  const renderDiagList = (host, items, { emptyText = "暂无记录" } = {}) => {
    if (!host) return;
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      host.innerHTML = `<div class="diag-item diag-item-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }

    host.innerHTML = list
      .map((x) => {
        const title = escapeHtml(String(x.title || ""));
        const sub = escapeHtml(String(x.sub || ""));
        const meta = escapeHtml(String(x.meta || ""));
        return `
          <div class="diag-item">
            <div class="diag-item-title">${title}</div>
            ${sub ? `<div class="diag-item-sub">${sub}</div>` : ""}
            ${meta ? `<div class="diag-item-meta">${meta}</div>` : ""}
          </div>
        `;
      })
      .join("");
  };

  const renderDiagnosticsPanel = () => {
    if (!diagDialogRoot) return;

    const summaryEl = $("#diag-summary", diagDialogRoot);
    const errorsEl = $("#diag-errors", diagDialogRoot);
    const telemetryEl = $("#diag-telemetry", diagDialogRoot);
    const logsEl = $("#diag-logs", diagDialogRoot);
    const toggleBtn = $('[data-action="diag-toggle-telemetry"]', diagDialogRoot);
    const clearErrorsBtn = $('[data-action="diag-clear-errors"]', diagDialogRoot);
    const clearLogsBtn = $('[data-action="diag-clear-logs"]', diagDialogRoot);

    const bundle = diagnostics.buildBundle({ includeTelemetry: true, includeHealth: true });
    const health = bundle?.health || null;
    const report = health?.report || {};

    const online = (() => {
      try {
        return Boolean(navigator.onLine);
      } catch (_) {
        return true;
      }
    })();

    const lastErrorAt = Number(diagnostics.getSummary().lastErrorAt || 0) || 0;
    const logSummary = logger.getSummary();
    const lastLogAt = Number(logSummary.lastLogAt || 0) || 0;

    renderMetaList(summaryEl, [
      { label: "版本", value: String(bundle?.version || "—") },
      { label: "页面", value: String(bundle?.page || "—") },
      { label: "网络", value: online ? "在线" : "离线" },
      { label: "本地埋点", value: bundle?.telemetryEnabled ? "开启" : "关闭" },
      { label: "错误数", value: `${Number(diagnostics.getSummary().errorCount || 0) || 0}` },
      { label: "最近错误", value: lastErrorAt ? formatTs(lastErrorAt) : "—" },
      { label: "日志数", value: `${Number(logSummary.logCount || 0) || 0}` },
      { label: "最近日志", value: lastLogAt ? formatTs(lastLogAt) : "—" },
      { label: "CLS", value: String(report["性能/CLS"] ?? "—") },
      { label: "LCP(ms)", value: String(report["性能/LCP(ms)"] ?? "—") },
      { label: "FCP(ms)", value: String(report["性能/FCP(ms)"] ?? "—") },
      { label: "INP(ms)", value: String(report["性能/INP(ms)"] ?? "—") },
    ]);

    if (toggleBtn) {
      toggleBtn.textContent = bundle?.telemetryEnabled ? "关闭本地埋点" : "开启本地埋点";
    }
    if (clearErrorsBtn) clearErrorsBtn.disabled = (Number(diagnostics.getSummary().errorCount || 0) || 0) === 0;
    if (clearLogsBtn) clearLogsBtn.disabled = (Number(logSummary.logCount || 0) || 0) === 0;

    const errors = diagnostics
      .readErrors()
      .slice(-12)
      .reverse()
      .map((e) => ({
        title: `${formatTs(e.ts)} · ${String(e.kind || "error")}`,
        sub: String(e.message || ""),
        meta: e.page ? `page=${String(e.page)}` : "",
      }));
    renderDiagList(errorsEl, errors, { emptyText: "暂无错误记录（运行时异常会自动记录）" });

    const telemetryItems = (() => {
      try {
        return telemetry
          .read()
          .slice(-18)
          .reverse()
          .map((e) => {
            const name = String(e?.name || "");
            const page = String(e?.page || "");
            const meta = e?.meta && typeof e.meta === "object" ? e.meta : null;
            const metaText = meta
              ? Object.entries(meta)
                  .slice(0, 5)
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join(" · ")
              : "";
            return {
              title: `${formatTs(e.ts)} · ${name || "event"}`,
              sub: page ? `page=${page}` : "",
              meta: metaText,
            };
          });
      } catch (_) {
        return [];
      }
    })();
    renderDiagList(telemetryEl, telemetryItems, { emptyText: "暂无埋点事件（可在设置中开启）" });

    const logItems = logger
      .read()
      .slice(-18)
      .reverse()
      .map((e) => {
        const level = String(e?.level || "info");
        const page = String(e?.page || "");
        const meta = e?.meta && typeof e.meta === "object" ? e.meta : null;
        const metaText = meta
          ? Object.entries(meta)
              .slice(0, 5)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(" · ")
          : "";
        return {
          title: `${formatTs(e.ts)} · ${level}`,
          sub: String(e?.message || ""),
          meta: [page ? `page=${page}` : "", metaText].filter(Boolean).join(" · "),
        };
      });
    renderDiagList(logsEl, logItems, { emptyText: "暂无日志（仅 info/warn/error 会持久化）" });
  };

  const ensureDiagnosticsDialog = () => {
    if (diagDialogRoot) return diagDialogRoot;

    const root = document.createElement("div");
    root.className = "diag-root";
    root.hidden = true;
    root.dataset.state = "closed";
    root.innerHTML = `
      <div class="diag-backdrop" data-action="diag-close" aria-hidden="true"></div>
      <div class="diag-panel" role="dialog" aria-modal="true" aria-label="系统诊断">
        <div class="diag-header">
          <div class="diag-header-title">
            <div class="diag-title">系统诊断</div>
            <div class="diag-subtitle">错误边界 · 本地日志 · 本地埋点 · 性能快照</div>
          </div>
          <div class="diag-header-actions">
            <button type="button" class="btn btn-small btn-secondary" data-action="diag-export">导出诊断包</button>
            <button type="button" class="btn btn-small btn-secondary" data-action="diag-clear-errors">清空错误</button>
            <button type="button" class="btn btn-small btn-secondary" data-action="diag-clear-logs">清空日志</button>
            <button type="button" class="btn btn-small btn-secondary" data-action="diag-toggle-telemetry">关闭本地埋点</button>
            <button type="button" class="diag-close" data-action="diag-close" aria-label="关闭">Esc</button>
          </div>
        </div>
        <div class="diag-body">
          <div class="diag-section">
            <div class="diag-section-title">概览</div>
            <div class="meta-list" id="diag-summary" aria-live="polite"></div>
          </div>
          <div class="diag-grid">
            <div class="diag-section">
              <div class="diag-section-title">最近错误</div>
              <div class="diag-list" id="diag-errors"></div>
            </div>
            <div class="diag-section">
              <div class="diag-section-title">最近埋点</div>
              <div class="diag-list" id="diag-telemetry"></div>
            </div>
            <div class="diag-section">
              <div class="diag-section-title">最近日志</div>
              <div class="diag-list" id="diag-logs"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      if (root.hidden) return;
      document.body.classList.remove("diag-open");
      const finalize = () => {
        root.hidden = true;
        root.dataset.state = "closed";
        try {
          diagDialogLastActive?.focus?.();
        } catch (_) {}
      };

      const panel = $(".diag-panel", root);
      const backdrop = $(".diag-backdrop", root);

      const outPanel = motionAnimate(
        panel,
        { opacity: [1, 0], y: [0, 12], scale: [1, 0.985], filter: ["blur(0px)", "blur(10px)"] },
        { duration: MOTION.durFast }
      );
      const outBackdrop = motionAnimate(backdrop, { opacity: [1, 0] }, { duration: MOTION.durFast });

      if (outPanel || outBackdrop) {
        Promise.allSettled([motionFinished(outPanel), motionFinished(outBackdrop)]).finally(finalize);
        return;
      }

      root.dataset.state = prefersReducedMotion() ? "closed" : "closing";
      if (prefersReducedMotion()) finalize();
      else window.setTimeout(finalize, 170);
    };

    const open = () => {
      if (!root.hidden) return;
      diagDialogLastActive = document.activeElement;

      renderDiagnosticsPanel();

      root.hidden = false;
      root.dataset.state = "opening";
      document.body.classList.add("diag-open");
      window.requestAnimationFrame(() => {
        root.dataset.state = "open";
      });

      const panel = $(".diag-panel", root);
      const backdrop = $(".diag-backdrop", root);
      motionAnimate(backdrop, { opacity: [0, 1] }, { duration: MOTION.durFast });
      motionAnimate(
        panel,
        { opacity: [0, 1], y: [18, 0], scale: [0.985, 1], filter: ["blur(12px)", "blur(0px)"] },
        { duration: MOTION.durBase }
      );

      window.setTimeout(() => {
        try {
          $(".diag-close", root)?.focus?.();
        } catch (_) {}
      }, 0);
    };

    root.addEventListener("click", (e) => {
      const action = e.target?.dataset?.action || "";
      if (action === "diag-close") close();
      if (action === "diag-export") exportDiagnosticsBundle();
      if (action === "diag-clear-errors") {
        diagnostics.clearErrors();
        toast({ title: "已清空", message: "错误日志已清空。", tone: "info" });
        renderDiagnosticsPanel();
      }
      if (action === "diag-clear-logs") {
        logger.clear();
        toast({ title: "已清空", message: "日志已清空。", tone: "info" });
        renderDiagnosticsPanel();
      }
      if (action === "diag-toggle-telemetry") {
        const next = !telemetry.isEnabled();
        telemetry.setEnabled(next);
        toast({
          title: "本地埋点已切换",
          message: next ? "已开启本地埋点（仅保存在本地）。" : "已关闭本地埋点。",
          tone: "info",
        });
        renderDiagnosticsPanel();
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
    diagDialogRoot = root;

    // 给外部调用的句柄（例如 Command Palette / Dashboard）
    root._diagOpen = open;
    root._diagClose = close;

    return root;
  };

  const openDiagnosticsDialog = () => {
    const root = ensureDiagnosticsDialog();
    root._diagOpen?.();
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

  const uid = () => {
    try {
      if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (_) {}
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const base64UrlEncode = (text) => {
    const raw = String(text ?? "");
    if (!raw) return "";
    try {
      if ("TextEncoder" in window) {
        const bytes = new TextEncoder().encode(raw);
        let bin = "";
        bytes.forEach((b) => {
          bin += String.fromCharCode(b);
        });
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      }
    } catch (_) {
      // fallback below
    }
    try {
      return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    } catch (_) {
      return "";
    }
  };

  const base64UrlDecode = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    try {
      const bin = atob(padded);
      if ("TextDecoder" in window) {
        const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(escape(bin));
    } catch (_) {
      return "";
    }
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
      meta.setAttribute("content", theme === "dark" ? "#0b0f16" : "#f5f7fb");
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
    if (saved === "high" || saved === "normal") {
      applyContrast(saved, { persist: false });
      return;
    }

    // boot.js 可能已根据系统偏好写入 dataset（prefers-contrast / forced-colors）
    const booted = document.documentElement.dataset.contrast === "high";
    applyContrast(booted ? "high" : "normal", { persist: false });
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
    let buttons = [];

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

    const getTelemetryLabel = () => (telemetry.isEnabled() ? "关闭本地埋点" : "开启本地埋点");

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
          badge: "诊断",
          title: "打开系统诊断面板",
          subtitle: "查看错误/本地埋点/性能快照",
          run: openDiagnosticsDialog,
        },
        {
          kind: "action",
          badge: "诊断",
          title: "导出诊断包",
          subtitle: "下载 diagnostics JSON（便于提交 Issue/PR）",
          run: exportDiagnosticsBundle,
        },
        {
          kind: "action",
          badge: "诊断",
          title: getTelemetryLabel(),
          subtitle: "仅保存在本地浏览器（不上传）",
          run: () => {
            const next = !telemetry.isEnabled();
            telemetry.setEnabled(next);
            toast({
              title: "本地埋点已切换",
              message: next ? "已开启本地埋点（仅保存在本地）。" : "已关闭本地埋点。",
              tone: "info",
            });
          },
        },
        ...(diagnostics.getSummary().errorCount > 0
          ? [
              {
                kind: "action",
                badge: "诊断",
                title: `清空错误日志（${diagnostics.getSummary().errorCount}）`,
                subtitle: "清空本地错误记录（不会影响收藏/进度等）",
                run: () => {
                  diagnostics.clearErrors();
                  toast({ title: "已清空", message: "错误日志已清空。", tone: "info" });
                },
              },
            ]
          : []),
        ...(logger.getSummary().logCount > 0
          ? [
              {
                kind: "action",
                badge: "诊断",
                title: `清空日志（${logger.getSummary().logCount}）`,
                subtitle: "清空本地日志（不会影响收藏/进度等）",
                run: () => {
                  logger.clear();
                  toast({ title: "已清空", message: "日志已清空。", tone: "info" });
                },
              },
            ]
          : []),
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
        { kind: "link", badge: "导航", title: "打开指挥舱", subtitle: "最近访问/收藏/进度汇总", href: "dashboard.html" },
        { kind: "link", badge: "导航", title: "打开更新中心", subtitle: "NEW / UPDATED 雷达", href: "updates.html" },
        { kind: "link", badge: "导航", title: "打开路线规划", subtitle: "拖拽排序 + 分享链接", href: "planner.html" },
        { kind: "link", badge: "导航", title: "打开探索", subtitle: "本地个性化推荐 + 一键路线", href: "discover.html" },
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
      buttons = [];
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

      buttons = $$(".cmdk-item", list);
      selected = 0;
      if (buttons.length > 0) buttons[0].setAttribute("aria-selected", "true");
    };

    const syncSelection = (next) => {
      if (buttons.length === 0) return;
      const prev = selected;
      const clamped = Math.max(0, Math.min(next, buttons.length - 1));
      if (clamped === prev) return;
      selected = clamped;
      if (buttons[prev]) buttons[prev].setAttribute("aria-selected", "false");
      if (buttons[selected]) buttons[selected].setAttribute("aria-selected", "true");
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
      const panel = $(".cmdk-panel", root);
      const backdrop = $(".cmdk-backdrop", root);
      motionAnimate(backdrop, { opacity: [0, 1] }, { duration: MOTION.durFast });
      motionAnimate(
        panel,
        { opacity: [0, 1], y: [18, 0], scale: [0.985, 1], filter: ["blur(12px)", "blur(0px)"] },
        { duration: MOTION.durBase }
      );
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
      const panel = $(".cmdk-panel", root);
      const backdrop = $(".cmdk-backdrop", root);
      const panelAnim = motionAnimate(
        panel,
        { opacity: [1, 0], y: [0, 12], scale: [1, 0.985], filter: ["blur(0px)", "blur(10px)"] },
        { duration: 0.18, easing: MOTION.easeIn }
      );
      const backdropAnim = motionAnimate(backdrop, { opacity: [1, 0] }, { duration: MOTION.durFast, easing: MOTION.easeIn });
      if (panelAnim || backdropAnim) {
        Promise.allSettled([motionFinished(panelAnim), motionFinished(backdropAnim)]).finally(finalize);
        return;
      }
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

  const initHeaderQuickLinks = () => {
    const host = $(".header-actions");
    if (!host) return;

    const hasHref = (href) => {
      try {
        return Boolean(host.querySelector(`a[href="${CSS.escape(href)}"]`));
      } catch (_) {
        return Boolean(host.querySelector(`a[href="${href.replace(/"/g, '\\"')}"]`));
      }
    };

    const insert = ({ href, label, text, svgPath }) => {
      if (!href) return;
      if (hasHref(href)) return;
      const a = document.createElement("a");
      a.className = "icon-button quick-link";
      a.href = href;
      a.setAttribute("aria-label", label || text || "打开");
      a.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="${svgPath}"/>
        </svg>
        <span class="icon-button-text">${escapeHtml(text || "")}</span>
      `;
      const before = $(".theme-toggle", host) || null;
      host.insertBefore(a, before);
    };

    insert({
      href: "dashboard.html",
      label: "打开指挥舱",
      text: "指挥舱",
      svgPath: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
    });
    insert({
      href: "updates.html",
      label: "打开更新中心",
      text: "更新",
      svgPath: "M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z",
    });
    insert({
      href: "planner.html",
      label: "打开路线规划",
      text: "路线",
      svgPath: "M7 17a3 3 0 1 1 2.83-4H14a3 3 0 1 1 0 2H9.83A3 3 0 0 1 7 17zm0-4a1 1 0 1 0 0 2a1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2a1 1 0 0 0 0-2zM7 7a3 3 0 1 1 2.83-4H17a1 1 0 1 1 0 2H9.83A3 3 0 0 1 7 7z",
    });
    insert({
      href: "discover.html",
      label: "打开探索",
      text: "探索",
      svgPath: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.5 5.5l-2.7 7.3-7.3 2.7 2.7-7.3 7.3-2.7zM10.9 10.9l-1.1 3 3-1.1 1.1-3-3 1.1z",
    });
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

    const VT_KEY = "gkb-vt";
    const supportsViewTransition = (() => {
      try {
        if (typeof document.startViewTransition !== "function") return false;
        return "viewTransitionName" in document.documentElement.style;
      } catch (_) {
        return false;
      }
    })();

    let activeVtTargets = [];

    const clearVtTargets = () => {
      activeVtTargets.forEach((el) => {
        try {
          el.style.viewTransitionName = "";
        } catch (_) {}
      });
      activeVtTargets = [];
    };

    const setVtTarget = (el, name) => {
      if (!el) return;
      try {
        el.style.viewTransitionName = name;
        activeVtTargets.push(el);
      } catch (_) {}
    };

    const writeVtToken = (kind, id) => {
      try {
        sessionStorage.setItem(VT_KEY, JSON.stringify({ kind, id, ts: Date.now() }));
      } catch (_) {}
    };

    const prepareSharedElements = (kind, a, url) => {
      if (!supportsViewTransition) return false;

      let id = "";
      try {
        id = String(url.searchParams.get("id") || "").trim();
      } catch (_) {
        id = "";
      }
      if (!id) return false;

      let card = null;
      if (kind === "topic") card = a.closest?.(".topic-card");
      else if (kind === "guide") card = a.closest?.(".guide-card") || a.closest?.(".game-card");
      else card = a.closest?.(".game-card");
      if (!card) return false;

      const media =
        kind === "topic"
          ? card.querySelector?.(".topic-badges") || card.querySelector?.(".topic-tags") || card
          : card.querySelector?.(".game-image, .game-card-image") || card.querySelector?.("img, svg") || card;
      const title =
        kind === "topic"
          ? card.querySelector?.(".topic-title") || card.querySelector?.("h3") || card
          : card.querySelector?.(".game-card-title, h3") || card;

      clearVtTargets();
      setVtTarget(card, "vt-card");
      setVtTarget(media, "vt-media");
      setVtTarget(title, "vt-title");
      writeVtToken(kind, id);

      // 若后续跳转被阻止（例如业务逻辑 preventDefault），避免名称“粘住”影响同页动效。
      window.setTimeout(() => {
        if (!document.hidden) clearVtTargets();
      }, 2500);

      return true;
    };

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

        if (supportsViewTransition) {
          try {
            const page = url.pathname.split("/").pop();
            if (page === "game.html") prepareSharedElements("game", a, url);
            else if (page === "guide-detail.html") prepareSharedElements("guide", a, url);
            else if (page === "forum-topic.html") prepareSharedElements("topic", a, url);
          } catch (_) {}
          return; // 交给浏览器原生 VT navigation
        }

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
      clearVtTargets();
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
  const OFFLINE_PACK_TOAST_ID = "offline-pack";

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
      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "正在缓存离线包",
        message: "离线包正在准备中，请稍候…",
        tone: "info",
        timeout: 0,
      });
      return;
    }

    const v = detectAssetVersion() || String(getData()?.version || "") || "unknown";
    offlinePackStorageKey = `${STORAGE_KEYS.offlinePackPrefix}${v}`;
    if (storage.get(offlinePackStorageKey) === "1") {
      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "离线包已就绪",
        message: "常用图标与页面已缓存。",
        tone: "success",
        timeout: 2600,
      });
      return;
    }

    const urls = collectOfflinePackUrls();
    if (urls.length === 0) {
      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "无可缓存资源",
        message: "当前页面未加载数据，稍后再试。",
        tone: "warn",
        timeout: 4200,
      });
      return;
    }

    offlinePackInFlight = true;
    offlinePackRequestId = Date.now();
    toast({
      id: OFFLINE_PACK_TOAST_ID,
      title: "开始缓存离线包",
      message: `准备中 0/${urls.length}（图标/封面/深度页）。`,
      tone: "info",
      timeout: 0,
    });

    const ok = await requestSwPrecache(urls);
    if (!ok) {
      offlinePackInFlight = false;
      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "缓存失败",
        message: "当前环境未启用 Service Worker（需要 HTTPS/localhost）。",
        tone: "warn",
        timeout: 5200,
      });
      return;
    }

    // 若 SW 未回消息，避免永远锁死
    window.setTimeout(() => {
      if (!offlinePackInFlight) return;
      offlinePackInFlight = false;
      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "缓存进行中",
        message: "可能仍在后台缓存（未收到进度回执）。稍后可再试。",
        tone: "info",
        timeout: 4200,
      });
    }, 12000);
  };

  const initServiceWorkerMessaging = () => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;

      const type = String(data.type || "");
      const reqId = Number(data.requestId || 0);
      if (!reqId || reqId !== offlinePackRequestId) return;

      if (type === "GKB_PRECACHE_PROGRESS") {
        if (!offlinePackInFlight) return;
        const ok = Number(data.ok || 0) || 0;
        const fail = Number(data.fail || 0) || 0;
        const total = Number(data.total || ok + fail) || ok + fail;
        const done = Number(data.done || ok + fail) || ok + fail;
        toast({
          id: OFFLINE_PACK_TOAST_ID,
          title: "正在缓存离线包",
          message: `进度 ${Math.min(done, total)}/${total}（成功 ${ok} / 失败 ${fail}）`,
          tone: fail > 0 ? "warn" : "info",
          timeout: 0,
        });
        return;
      }

      if (type !== "GKB_PRECACHE_DONE") return;

      offlinePackInFlight = false;

      const ok = Number(data.ok || 0) || 0;
      const fail = Number(data.fail || 0) || 0;
      const total = Number(data.total || ok + fail) || ok + fail;

      if (offlinePackStorageKey) storage.set(offlinePackStorageKey, "1");

      toast({
        id: OFFLINE_PACK_TOAST_ID,
        title: "离线包已缓存",
        message: fail > 0 ? `已缓存 ${ok}/${total} 项，${fail} 项失败（可稍后重试）。` : `已缓存 ${ok}/${total} 项资源。`,
        tone: fail > 0 ? "warn" : "success",
        timeout: 4200,
      });
    });
  };

  const initConnectivityToasts = () => {
    let lastOnline = Boolean(netStore.getState()?.online);

    const notify = (isOnline) => {
      const next = Boolean(isOnline);
      toast({
        title: next ? "网络已恢复" : "当前离线",
        message: next
          ? "已恢复联网，可正常更新与获取最新内容。"
          : "你仍可浏览已缓存页面；需要联网才能首次缓存新页面。",
        tone: next ? "info" : "warn",
        timeout: 3200,
      });
    };

    // 首次加载即离线：提示一次
    if (!lastOnline) notify(false);

    netStore.subscribe((s) => {
      const nextOnline = Boolean(s?.online);
      if (nextOnline === lastOnline) return;
      lastOnline = nextOnline;
      notify(nextOnline);
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
    window.requestAnimationFrame(() => {
      document.body.classList.add("page-loaded");
      initCinematicEntrance();
    });
  };

  const initCinematicEntrance = () => {
    if (prefersReducedMotion()) return;
    const Motion = getMotion();
    if (!Motion) return;

    const { animate, stagger } = Motion;

    const header = $("header");
    if (header) {
      const nodes = [
        $(".logo-container", header),
        ...$$("nav a", header),
        ...$$(".header-actions .icon-button", header),
        ...$$(".header-actions .theme-toggle", header),
      ].filter(Boolean);

      if (nodes.length > 0) {
        try {
          animate(
            nodes,
            { opacity: [0, 1], y: [-10, 0], filter: ["blur(10px)", "blur(0px)"] },
            { duration: 0.5, delay: stagger(0.04), easing: [0.22, 1, 0.36, 1] }
          );
        } catch (_) {
          // ignore
        }
      }
    }

    const banner = $(".banner-content");
    if (banner) {
      const items = Array.from(banner.children);
      if (items.length > 0) {
        try {
          animate(
            items,
            { opacity: [0, 1], y: [14, 0], filter: ["blur(10px)", "blur(0px)"] },
            { duration: 0.55, delay: stagger(0.08, { startDelay: 0.12 }), easing: [0.22, 1, 0.36, 1] }
          );
        } catch (_) {
          // ignore
        }
      }
    }
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
                <div class="mini-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
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
      document.body.classList.remove("compare-open");
      const finalize = () => {
        root.hidden = true;
        root.dataset.state = "closed";
        try {
          compareDialogLastActive?.focus?.();
        } catch (_) {}
      };

      const panel = $(".compare-panel", root);
      const backdrop = $(".compare-backdrop", root);

      const outPanel = motionAnimate(
        panel,
        { opacity: [1, 0], y: [0, 12], scale: [1, 0.985], filter: ["blur(0px)", "blur(10px)"] },
        { duration: MOTION.durFast }
      );
      const outBackdrop = motionAnimate(backdrop, { opacity: [1, 0] }, { duration: MOTION.durFast });

      if (outPanel || outBackdrop) {
        Promise.allSettled([motionFinished(outPanel), motionFinished(outBackdrop)]).finally(finalize);
        return;
      }

      root.dataset.state = prefersReducedMotion() ? "closed" : "closing";
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
                <div class="compare-game-title" title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</div>
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

    const panel = $(".compare-panel", root);
    const backdrop = $(".compare-backdrop", root);

    const canMotion = !prefersReducedMotion() && Boolean(getMotion());

    // Motion 版本：先写入初始样式再开场，避免 CSS transition 与 Motion 互相抢 transform
    if (canMotion) {
      try {
        if (panel) {
          panel.style.opacity = "0";
          panel.style.transform = "translateY(18px) scale(0.985)";
          panel.style.filter = "blur(12px)";
        }
        if (backdrop) backdrop.style.opacity = "0";
      } catch (_) {}
    } else {
      // 保证 CSS 方案可接管（避免遗留 inline style 抢优先级）
      try {
        if (panel) {
          panel.style.opacity = "";
          panel.style.transform = "";
          panel.style.filter = "";
        }
        if (backdrop) backdrop.style.opacity = "";
      } catch (_) {}
    }

    root.hidden = false;
    document.body.classList.add("compare-open");

    const inBackdrop = canMotion ? motionAnimate(backdrop, { opacity: [0, 1] }, { duration: MOTION.durFast }) : null;
    const inPanel = canMotion
      ? motionAnimate(
          panel,
          { opacity: [0, 1], y: [18, 0], scale: [0.985, 1], filter: ["blur(12px)", "blur(0px)"] },
          { duration: MOTION.durBase }
        )
      : null;

    if (canMotion && (inPanel || inBackdrop)) {
      root.dataset.state = "open";
      Promise.allSettled([motionFinished(inPanel), motionFinished(inBackdrop)]).finally(() => {
        try {
          if (panel) {
            panel.style.opacity = "";
            panel.style.transform = "";
            panel.style.filter = "";
          }
          if (backdrop) backdrop.style.opacity = "";
        } catch (_) {}
      });
    } else {
      try {
        if (panel) {
          panel.style.opacity = "";
          panel.style.transform = "";
          panel.style.filter = "";
        }
        if (backdrop) backdrop.style.opacity = "";
      } catch (_) {}
      root.dataset.state = "opening";
      window.requestAnimationFrame(() => {
        root.dataset.state = "open";
      });
    }

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
    let lastCompareIds = compareIds.slice();

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
          motionPulse($(".compare-bar-inner", bar), { scale: 1.01, duration: 0.32 });
          openGameCompare(ids);
          return;
        }

        if (action === "compare-clear") {
          clearCompareGames();
          syncCompareUi();
          toast({ title: "已清空", message: "对比列表已重置。", tone: "info" });
          motionPulse($(".compare-bar-inner", bar), { scale: 1.01, duration: 0.32 });
          return;
        }

        const removeBtn = e.target?.closest?.("[data-remove-id]");
        const removeId = removeBtn?.dataset?.removeId || "";
        if (removeId) {
          const commit = () => {
            const next = readCompareGames().filter((x) => x !== removeId);
            writeCompareGames(next);
            syncCompareUi();
          };

          const anim = motionAnimate(
            removeBtn,
            { opacity: [1, 0], scale: [1, 0.96], filter: ["blur(0px)", "blur(8px)"] },
            { duration: MOTION.durFast }
          );
          if (anim) motionFinished(anim).then(commit).catch(commit);
          else commit();
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
          motionAnimate(
            $(".compare-bar-inner", bar),
            { opacity: [0, 1], y: [6, 0], scale: [0.99, 1], filter: ["blur(10px)", "blur(0px)"] },
            { duration: MOTION.durBase }
          );
        });
        return;
      }

      if (bar.hidden) return;
      bar.dataset.state = prefersReducedMotion() ? "closed" : "closing";
      motionAnimate(
        $(".compare-bar-inner", bar),
        { opacity: [1, 0], y: [0, 6], scale: [1, 0.99], filter: ["blur(0px)", "blur(10px)"] },
        { duration: MOTION.durFast }
      );
      const finalize = () => {
        bar.hidden = true;
        bar.dataset.state = "closed";
      };
      if (prefersReducedMotion()) finalize();
      else window.setTimeout(finalize, 190);
    };

    const syncCompareUi = () => {
      compareIds = readCompareGames();
      const prev = lastCompareIds;
      let added = "";
      let removed = "";
      try {
        const prevSet = new Set(prev);
        const nextSet = new Set(compareIds);
        added = compareIds.find((id) => !prevSet.has(id)) || "";
        removed = prev.find((id) => !nextSet.has(id)) || "";
      } catch (_) {
        added = "";
        removed = "";
      }
      lastCompareIds = compareIds.slice();

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

        if (added) {
          window.requestAnimationFrame(() => {
            let sel = null;
            try {
              sel = `[data-remove-id="${CSS.escape(added)}"]`;
            } catch (_) {
              sel = null;
            }
            const el = sel ? chips.querySelector(sel) : null;
            if (!el) return;
            motionAnimate(
              el,
              { opacity: [0, 1], y: [10, 0], scale: [0.98, 1], filter: ["blur(10px)", "blur(0px)"] },
              { duration: 0.24 }
            );
          });
        }

        if (added || removed) {
          motionPulse($(".compare-bar-inner", bar), { scale: 1.008, duration: 0.26 });
        }
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
          library: [],
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
      setChecked("library", s.library);
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
      library: getCheckedValues("library", root),
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
      const libraryMap = readGameLibraryMap();
      let shown = 0;

      const counts = {
        genre: new Map(),
        platform: new Map(),
        year: new Map(),
        rating: new Map(),
        library: new Map(),
        saved: 0,
      };

      const bump = (map, key) => {
        const k = String(key || "").trim();
        if (!k) return;
        map.set(k, (Number(map.get(k) || 0) || 0) + 1);
      };

      const ratingBucket = (value) => {
        const v = Number(value);
        if (!Number.isFinite(v)) return "<6";
        if (v >= 9) return "9+";
        if (v >= 8) return "8-9";
        if (v >= 7) return "7-8";
        if (v >= 6) return "6-7";
        return "<6";
      };

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

        const libraryStatus = gid ? getGameLibraryStatus(gid, libraryMap) : "none";
        card.dataset.library = libraryStatus;
        const okLibrary = s.library.length === 0 || s.library.includes(libraryStatus);

        const visible = okQuery && okGenre && okPlatform && okYear && okRating && okLibrary && okSaved;
        card.hidden = !visible;
        if (!visible) return;
        shown += 1;

        bump(counts.genre, genre);
        platformTokens.forEach((p) => bump(counts.platform, p));
        const y = Number(year);
        bump(counts.year, Number.isFinite(y) && y <= 2019 ? "older" : String(year || ""));
        bump(counts.rating, ratingBucket(rating));
        bump(counts.library, libraryStatus);
        if (gid && savedSet.has(gid)) counts.saved += 1;
      });

      if (emptyEl) emptyEl.hidden = shown !== 0;
      if (countEl) countEl.textContent = `共 ${shown} 个结果`;

      const syncCountsFor = (name, map) => {
        $$(`input[name="${name}"]`, root).forEach((el) => {
          const label = el.closest?.("label");
          if (!label) return;
          let span = $(".filter-count", label);
          if (!span) {
            span = document.createElement("span");
            span.className = "filter-count";
            label.appendChild(span);
          }
          const c = Number(map.get(el.value) || 0) || 0;
          span.textContent = `(${c})`;
          el.disabled = c === 0 && !el.checked;
        });
      };

      syncCountsFor("genre", counts.genre);
      syncCountsFor("platform", counts.platform);
      syncCountsFor("year", counts.year);
      syncCountsFor("rating", counts.rating);
      syncCountsFor("library", counts.library);
      syncCountsFor("saved", new Map([["saved", counts.saved]]));
    };

    const renderActiveFilters = (s) => {
      if (!activeFiltersEl) return;
      ensureActiveFilterDelegate();
      const chips = [];

      const pushChip = (label, onClear) => {
        chips.push({ label, onClear });
      };

      const labelGenre = (g) =>
        ({
          rpg: "角色扮演",
          strategy: "策略",
          action: "动作",
          adventure: "冒险",
          simulation: "模拟",
          other: "其他",
        }[String(g || "")] || String(g || ""));

      const labelPlatform = (p) =>
        ({
          pc: "PC",
          ps5: "PS5",
          ps4: "PS4",
          "xbox-series": "Xbox Series",
          "xbox-one": "Xbox One",
          switch: "Switch",
          mobile: "手机/平板",
        }[String(p || "")] || String(p || ""));

      const labelLibrary = (v) =>
        ({
          wishlist: "想玩",
          playing: "在玩",
          done: "已通关",
          none: "未设置",
        }[String(v || "")] || String(v || ""));

      if (s.query) {
        pushChip(`关键词：${s.query}`, () => {
          if (searchInput) searchInput.value = "";
        });
      }

      s.genres.forEach((g) =>
        pushChip(`类型：${labelGenre(g)}`, () => {
          $$('input[name="genre"]', root).forEach((el) => {
            if (el.value === g) el.checked = false;
          });
        })
      );

      s.platforms.forEach((p) =>
        pushChip(`平台：${labelPlatform(p)}`, () => {
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

      s.library.forEach((l) =>
        pushChip(`我的库：${labelLibrary(l)}`, () => {
          $$('input[name="library"]', root).forEach((el) => {
            if (el.value === l) el.checked = false;
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
        if (s.library.length > 0) params.set("library", s.library.join(","));
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

      const hasIntent =
        Boolean(s.query) ||
        s.genres.length > 0 ||
        s.platforms.length > 0 ||
        s.years.length > 0 ||
        s.ratings.length > 0 ||
        s.library.length > 0 ||
        Boolean(s.savedOnly);

      if (hasIntent) {
        const visible = Array.from(listEl.children).filter(
          (el) => el && el.classList?.contains?.("game-card") && !el.hidden
        );
        const urls = visible
          .slice(0, 6)
          .map((card) => card.querySelector?.('a.btn[href]')?.getAttribute?.("href") || "")
          .filter(Boolean);
        prefetchUrls(urls, { limit: 6, reason: "games_results" });
      }
    };

    // 初始化状态：URL > localStorage > default
    let s = readState();

    const readUrlParams = () => {
      try {
        const params = getSearchParams();
        if (!params) {
          return {
            reset: false,
            query: "",
            genres: [],
            platforms: [],
            years: [],
            ratings: [],
            library: [],
            savedOnly: false,
            sort: "",
            view: "",
          };
        }

        const reset = readSearchBool(params, "reset", { truthy: ["1"] });
        const sortKey = readSearchString(params, "sort");
        const view = readSearchString(params, "view");

        return {
          reset,
          query: readSearchString(params, ["q", "query"]),
          genres: readSearchList(params, "genre"),
          platforms: readSearchList(params, "platform"),
          years: readSearchList(params, "year"),
          ratings: readSearchList(params, "rating"),
          library: readSearchList(params, "library"),
          savedOnly: readSearchBool(params, "saved", { truthy: ["1"] }),
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
          library: [],
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
        library: [],
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

    if (url.library.length > 0) {
      const nextLibrary = filterKnown("library", url.library);
      if (nextLibrary.length > 0) s.library = nextLibrary;
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
      try {
        const s = stateFromUi();
        telemetry.log("games_filter", {
          source: String(e?.type || "ui").slice(0, 12),
          qLen: String(s.query || "").length,
          genres: s.genres.length,
          platforms: s.platforms.length,
          years: s.years.length,
          ratings: s.ratings.length,
          library: s.library.length,
          savedOnly: Boolean(s.savedOnly),
          sort: String(s.sort || "popular"),
          view: String(s.view || "grid"),
        });
      } catch (_) {}
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
      s = {
        query: "",
        genres: [],
        platforms: [],
        years: [],
        ratings: [],
        library: [],
        savedOnly: false,
        sort: "popular",
        view: "grid",
      };
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

    const renderInitialSkeleton = (count = 8) => {
      if (!grid) return;
      try {
        grid.setAttribute("aria-busy", "true");
      } catch (_) {}

      const card = () => `
        <div class="game-card guide-card is-skeleton-card" aria-hidden="true">
          <div class="game-card-image">
            <div class="skeleton skeleton-media"></div>
          </div>
          <div class="game-card-content">
            <div class="skeleton-stack">
              <div class="skeleton skeleton-line lg"></div>
              <div class="skeleton skeleton-line"></div>
              <div class="skeleton skeleton-line"></div>
              <div class="skeleton skeleton-line sm"></div>
            </div>
          </div>
        </div>
      `;

      grid.innerHTML = Array.from({ length: Math.max(1, Number(count || 0) || 8) })
        .map(card)
        .join("");

      if (countEl) countEl.textContent = "加载中…";
      if (empty) empty.hidden = true;
    };

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
        const params = getSearchParams();
        if (!params) return { reset: false, query: "", tags: [], savedOnly: false, sort: "" };

        const reset = readSearchBool(params, "reset", { truthy: ["1"] });
        const query = readSearchString(params, ["q", "query"]);
        const tags = readSearchList(params, ["tag", "tags"]);
        const savedOnly = readSearchBool(params, ["saved", "savedOnly"], { truthy: ["1", "true"] });
        const sort = readSearchString(params, "sort");

        return { reset, query, tags, savedOnly, sort };
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
        telemetry.log("guides_filter", { kind: "savedOnly", on: Boolean(state.savedOnly) });
        apply();
        return;
      }

      const t = btn.dataset.tag || "";
      if (!t) return;
      state.tags = state.tags.includes(t) ? state.tags.filter((x) => x !== t) : [...state.tags, t];
      writeState(state);
      renderTags();
      telemetry.log("guides_filter", { kind: "tag", tags: state.tags.length });
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
            <h3 class="game-card-title">
              <span class="game-card-title-text" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
              ${renderUpdateBadge(status)}
            </h3>
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
      telemetry.log("guide_save", { id: String(gid).slice(0, 48), saved: !had });

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
      animateSavePill(btn, !had);
      btn.closest?.(".guide-card")?.classList.toggle("is-saved", !had);
    });

    const urlFlags = (() => {
      const params = getSearchParams();
      return {
        forceVirtual: readSearchBool(params, ["virtual", "vlist"], { truthy: ["1", "true"] }),
      };
    })();

    let vlist = null;
    const ensureVlist = () => {
      if (vlist) return vlist;
      vlist = createVirtualList(grid, { rowHeight: VLIST.guidesRowHeight });
      return vlist;
    };
    const teardownVlist = () => {
      if (!vlist) return;
      vlist.destroy();
      vlist = null;
    };

    const apply = () => {
      try {
        grid.setAttribute("aria-busy", "true");
      } catch (_) {}
      const done = () => {
        try {
          grid.removeAttribute("aria-busy");
        } catch (_) {}
      };

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

      const shouldVirtualize =
        urlFlags.forceVirtual || (sorted.length >= VLIST.enableThreshold && !prefersReducedMotion());

      if (sorted.length === 0) {
        teardownVlist();
        withViewTransition(() => {
          grid.innerHTML = "";
          if (countEl) countEl.textContent = "共 0 条攻略";
          if (empty) empty.hidden = false;
        });
        done();
        syncUrl();
        return;
      }

      if (shouldVirtualize) {
        const renderer = (el, payload) => {
          const id = payload.id;
          const guide = payload.guide || {};
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
              ? `<div class="vlist-tags">${tags
                  .slice(0, 3)
                  .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
                  .join("")}</div>`
              : "";

          el.className = `vlist-row vlist-row-guide${isSaved ? " is-saved" : ""}`;
          el.innerHTML = `
            <div class="vlist-row-inner">
              <div class="vlist-media">
                <img src="${icon}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
              </div>
              <div class="vlist-main">
                <div class="vlist-title">
                  <span class="vlist-title-text">${escapeHtml(title)}</span>
                  ${renderUpdateBadge(status)}
                </div>
                <div class="vlist-desc">${escapeHtml(summary)}</div>
                ${chips}
                <div class="vlist-meta">
                  <span class="meta-pill small">${escapeHtml(updated)}</span>
                  <span class="meta-pill small">${escapeHtml(difficulty)}</span>
                  <span class="meta-pill small">阅读 ${escapeHtml(readingTime)}</span>
                </div>
              </div>
              <div class="vlist-actions">
                <a href="guide-detail.html?id=${encodeURIComponent(id)}" class="btn btn-small">阅读全文</a>
                <button type="button" class="save-pill ${isSaved ? "active" : ""}" data-guide-id="${escapeHtml(id)}" aria-pressed="${isSaved ? "true" : "false"}" aria-label="${escapeHtml(saveLabel)}">
                  <span class="save-star" aria-hidden="true">${saveStar}</span>
                  <span class="save-text">${escapeHtml(saveLabel)}</span>
                </button>
              </div>
            </div>
          `;
        };

        const list = ensureVlist();
        list.setItems(
          sorted.map(({ id, guide }) => ({
            key: String(id),
            data: { id, guide },
            render: renderer,
          }))
        );

        if (countEl) countEl.textContent = `共 ${sorted.length} 条攻略（虚拟列表）`;
        if (empty) empty.hidden = true;
        done();

        if (state.query || state.tags.length > 0 || state.savedOnly) {
          prefetchUrls(
            sorted.slice(0, 6).map(({ id }) => `guide-detail.html?id=${encodeURIComponent(id)}`),
            { limit: 6, reason: "guides_results" }
          );
        }
        syncUrl();
        return;
      }

      teardownVlist();
      withViewTransition(() => {
        grid.innerHTML = sorted.map(({ id, guide }) => renderCard(id, guide)).join("");
        if (countEl) countEl.textContent = `共 ${sorted.length} 条攻略`;
        if (empty) empty.hidden = true;
      });
      done();

      if (state.query || state.tags.length > 0 || state.savedOnly) {
        prefetchUrls(
          sorted.slice(0, 6).map(({ id }) => `guide-detail.html?id=${encodeURIComponent(id)}`),
          { limit: 6, reason: "guides_results" }
        );
      }
      syncUrl();
    };

    if (searchInput) searchInput.value = state.query || "";
    if (sortSelect) {
      const options = new Set($$("option", sortSelect).map((opt) => opt.value).filter(Boolean));
      if (!options.has(state.sort)) state.sort = "default";
      sortSelect.value = state.sort || "default";
    }
    renderTags();
    renderInitialSkeleton(8);
    window.requestAnimationFrame(() => apply());

    const syncFromInput = () => {
      state = { ...state, query: searchInput?.value?.trim() || "" };
      writeState(state);
      telemetry.log("guides_search", {
        qLen: state.query.length,
        tags: state.tags.length,
        savedOnly: Boolean(state.savedOnly),
        sort: String(state.sort || "default"),
      });
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
    const focusEl = $("#guide-focus");
    const focusTagsEl = $("#guide-focus-tags");
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

    let readingMinutes = 0;
    if (contentEl) {
      const fallbackText = contentEl.textContent || "";
      const words = fallbackText.replace(/\s+/g, "").length;
      const fallbackMinutes = Math.max(1, Math.round(words / 320));
      const override =
        typeof guide?.readingTime === "number" && Number.isFinite(guide.readingTime)
          ? Math.max(1, Math.round(guide.readingTime))
          : fallbackMinutes;
      readingMinutes = override;
      if (readingTimeEl) readingTimeEl.textContent = `阅读时长：约 ${override} 分钟`;
    }

    if (focusEl) {
      const sessions = readingMinutes <= 12 ? 1 : readingMinutes <= 25 ? 2 : 3;
      const perSession = readingMinutes ? Math.max(6, Math.round(readingMinutes / sessions)) : 10;
      const diff = difficultyRank(guide?.difficulty);
      const pace = diff >= 4 ? "高强度专注" : diff >= 3 ? "稳定推进" : "轻松浏览";
      renderMetaList(focusEl, [
        { label: "建议分段", value: `${sessions} 次` },
        { label: "单次时长", value: `${perSession} 分钟` },
        { label: "阅读节奏", value: pace },
      ]);
    }
    if (focusTagsEl) {
      renderChipList(focusTagsEl, guide?.tags, "可从目标/机制/节奏切入");
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
      motionFlash(saveBtn);
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
    const libraryPills = $("#game-library-pills");
    const libraryMeta = $("#game-library-meta");
    const focusEl = $("#game-focus");
    const focusTagsEl = $("#game-focus-tags");

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
              <img src="${icon2}" alt="${escapeHtml(t)}" loading="lazy">
              <div class="mini-card-body">
                <div class="mini-card-title" title="${escapeHtml(t)}">${escapeHtml(t)}</div>
                <div class="mini-card-desc">${escapeHtml(s)}</div>
              </div>
            </a>
          `;
        })
        .join("");
    }

    renderChipList(tagsEl, game?.tags, "暂无标签");
    renderChipList(highlightsEl, game?.highlights, "重点待补");

    if (focusEl) {
      const diff = difficultyRank(difficulty);
      const session = estimateGameSessionMinutes(game);
      const rhythm = diff >= 4 ? "硬核专注" : diff >= 3 ? "稳步推进" : "轻松体验";
      const tags = normalizeTagList(game?.tags);
      const focusTag = tags.find((t) => ["开放世界", "策略", "动作", "魂系", "叙事"].includes(t));
      renderMetaList(focusEl, [
        { label: "推荐节奏", value: rhythm },
        { label: "单次游玩", value: `${session} 分钟` },
        { label: "入门切点", value: focusTag || "机制/资源/节奏" },
      ]);
    }
    if (focusTagsEl) {
      renderChipList(focusTagsEl, game?.highlights || game?.tags, "先从核心玩法开始");
    }

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
      motionFlash(saveGameBtn);
    });

    const getLibraryLabel = (status) => {
      if (status === "wishlist") return "想玩";
      if (status === "playing") return "在玩";
      if (status === "done") return "已通关";
      return "未设置";
    };

    const syncGameLibrary = () => {
      if (!libraryPills) return;
      const map = readGameLibraryMap();
      const current = getGameLibraryStatus(id, map);

      $$(".library-pill", libraryPills).forEach((btn) => {
        const s = normalizeGameLibraryStatus(btn.dataset.status);
        const active = s !== "none" && s === current;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });

      if (libraryMeta) {
        const at = map?.[id]?.updatedAt ? new Date(map[id].updatedAt).toLocaleString("zh-CN") : "";
        libraryMeta.textContent = current === "none" ? "未设置" : `当前：${getLibraryLabel(current)}${at ? ` · ${at}` : ""}`;
      }
    };

    syncGameLibrary();

    libraryPills?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".library-pill");
      if (!btn || !libraryPills.contains(btn)) return;
      if (!id) return;

      const status = btn.dataset.status || "none";
      const next = setGameLibraryStatus(id, status);
      syncGameLibrary();

      motionPulse(btn, { scale: 1.07, duration: MOTION.durSlow });

      toast({
        title: next === "none" ? "已清除状态" : `已标记：${getLibraryLabel(next)}`,
        message: "已保存到本地浏览器，可在“指挥舱/筛选”中查看。",
        tone: next === "done" ? "success" : next === "none" ? "info" : "success",
      });
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
  // Dashboard Page
  // -------------------------

  const initDashboardPage = () => {
    if (getPage() !== "dashboard") return;

    const data = getData();
    if (!data) return;

    const statsEl = $("#dash-stats");
    const recentEl = $("#dash-recent");
    const savedEl = $("#dash-saved");
    const progressEl = $("#dash-progress");
    const updatesEl = $("#dash-updates");
    const dnaEl = $("#dash-dna");
    const dnaTagsEl = $("#dash-dna-tags");
    const momentumEl = $("#dash-momentum");
    const diagEl = $("#dash-diagnostics");

    const exportBtn = $("#dash-export");
    const importBtn = $("#dash-import");
    const resetBtn = $("#dash-reset");
    const markAllBtn = $("#dash-mark-all");
    const diagOpenBtn = $("#dash-diag-open");
    const diagExportBtn = $("#dash-diag-export");
    const diagClearBtn = $("#dash-diag-clear");
    const telemetryToggleBtn = $("#dash-telemetry-toggle");

    exportBtn?.addEventListener("click", exportLocalData);
    importBtn?.addEventListener("click", importLocalData);
    resetBtn?.addEventListener("click", resetLocalData);
    diagOpenBtn?.addEventListener("click", openDiagnosticsDialog);
    diagExportBtn?.addEventListener("click", exportDiagnosticsBundle);

    const renderDiagnostics = () => {
      if (!diagEl) return;
      const bundle = diagnostics.buildBundle({ includeTelemetry: true, includeHealth: true });
      const health = bundle?.health || null;
      const report = health?.report || {};

      const summary = diagnostics.getSummary();
      const lastAt = Number(summary.lastErrorAt || 0) || 0;
      const logSummary = logger.getSummary();
      const lastLogAt = Number(logSummary.lastLogAt || 0) || 0;

      renderMetaList(diagEl, [
        { label: "本地埋点", value: bundle?.telemetryEnabled ? "开启" : "关闭" },
        { label: "错误数", value: `${Number(summary.errorCount || 0) || 0}` },
        { label: "最近错误", value: lastAt ? formatTs(lastAt) : "—" },
        { label: "日志数", value: `${Number(logSummary.logCount || 0) || 0}` },
        { label: "最近日志", value: lastLogAt ? formatTs(lastLogAt) : "—" },
        { label: "CLS", value: String(report["性能/CLS"] ?? "—") },
        { label: "LCP(ms)", value: String(report["性能/LCP(ms)"] ?? "—") },
        { label: "FCP(ms)", value: String(report["性能/FCP(ms)"] ?? "—") },
        { label: "INP(ms)", value: String(report["性能/INP(ms)"] ?? "—") },
      ]);

      if (telemetryToggleBtn) {
        telemetryToggleBtn.textContent = bundle?.telemetryEnabled ? "关闭本地埋点" : "开启本地埋点";
      }

      if (diagClearBtn) diagClearBtn.disabled = (Number(summary.errorCount || 0) || 0) === 0;
    };

    diagClearBtn?.addEventListener("click", () => {
      diagnostics.clearErrors();
      toast({ title: "已清空", message: "错误日志已清空。", tone: "info" });
      renderDiagnostics();
    });

    telemetryToggleBtn?.addEventListener("click", () => {
      const next = !telemetry.isEnabled();
      telemetry.setEnabled(next);
      toast({
        title: "本地埋点已切换",
        message: next ? "已开启本地埋点（仅保存在本地）。" : "已关闭本地埋点。",
        tone: "info",
      });
      renderDiagnostics();
    });

    // 1) 概览
    const totalGames = Object.keys(data.games || {}).length;
    const totalGuides = Object.keys(data.guides || {}).length;
    const totalTopics = Object.keys(data.topics || {}).length;

    const savedGames = readStringList(STORAGE_KEYS.savedGames);
    const savedGuides = readStringList(STORAGE_KEYS.savedGuides);
    const savedTopics = readStringList(STORAGE_KEYS.savedTopics);
    const recentGames = readStringList(STORAGE_KEYS.recentGames);
    const recentGuides = readStringList(STORAGE_KEYS.recentGuides);

    renderMetaList(statsEl, [
      { label: "游戏库", value: `${totalGames} 款` },
      { label: "攻略库", value: `${totalGuides} 篇` },
      { label: "话题库", value: `${totalTopics} 个` },
      { label: "已收藏游戏", value: `${savedGames.length} 个` },
      { label: "已收藏攻略", value: `${savedGuides.length} 篇` },
      { label: "已收藏话题", value: `${savedTopics.length} 个` },
    ]);

    // 1.5) 风格 DNA & 动量
    const weights = buildInterestWeights(data);
    const dna = computePlaystyleDna(weights);
    renderDnaBars(dnaEl, dna.bars);
    renderChipList(dnaTagsEl, dna.topTags, "先收藏或访问一些内容以生成画像");

    const momentum = computeMomentum(data);
    renderMetaList(momentumEl, [
      { label: "动量指数", value: `${momentum.score}` },
      { label: "节奏状态", value: momentum.level },
      { label: "下一步", value: momentum.nextAction },
      { label: "路线条目", value: `${momentum.planCount}` },
    ]);

    renderDiagnostics();

    // 2) 最近访问
    const recentCards = [
      ...recentGames.slice(0, 4).map((id) => {
        const g = data.games?.[id];
        return {
          icon: g?.icon || "images/icons/rpg-icon.svg",
          title: g?.title || `游戏：${id}`,
          desc: g?.genre || "打开游戏详情",
          href: `game.html?id=${encodeURIComponent(id)}`,
        };
      }),
      ...recentGuides.slice(0, 4).map((id) => {
        const g = data.guides?.[id];
        const updated = g?.updated ? `更新 ${formatDate(g.updated)}` : "更新待补";
        return {
          icon: g?.icon || "images/icons/guide-icon.svg",
          title: g?.title || `攻略：${id}`,
          desc: `${updated} · ${g?.difficulty || "通用"}`,
          href: `guide-detail.html?id=${encodeURIComponent(id)}`,
        };
      }),
    ];
    renderMiniCards(recentEl, recentCards, "还没有最近访问记录");

    // 3) 收藏
    const savedCards = [
      ...savedGames.slice(0, 4).map((id) => {
        const g = data.games?.[id];
        return {
          icon: g?.icon || "images/icons/rpg-icon.svg",
          title: g?.title || `游戏：${id}`,
          desc: g?.genre || "打开游戏详情",
          href: `game.html?id=${encodeURIComponent(id)}`,
        };
      }),
      ...savedGuides.slice(0, 4).map((id) => {
        const g = data.guides?.[id];
        return {
          icon: g?.icon || "images/icons/guide-icon.svg",
          title: g?.title || `攻略：${id}`,
          desc: g?.summary || "打开攻略详情",
          href: `guide-detail.html?id=${encodeURIComponent(id)}`,
        };
      }),
      ...savedTopics.slice(0, 3).map((id) => {
        const t = data.topics?.[id];
        return {
          icon: "images/icons/community-icon.svg",
          title: t?.title || `话题：${id}`,
          desc: t?.category ? `分类：${t.category}` : "打开话题",
          href: `forum-topic.html?id=${encodeURIComponent(id)}`,
        };
      }),
    ];
    renderMiniCards(savedEl, savedCards, "你还没有收藏任何内容");

    // 4) 攻略进度汇总（扫描 localStorage：gkb-guide-checklist:<id>）
    const checklistKeys = listLocalStorageKeys().filter((k) => k.startsWith(STORAGE_KEYS.guideChecklistPrefix));
    const progressItems = checklistKeys
      .map((key) => {
        const id = key.slice(String(STORAGE_KEYS.guideChecklistPrefix).length);
        if (!id) return null;
        const guide = data.guides?.[id] || null;
        const steps = Array.isArray(guide?.steps) && guide.steps.length > 0 ? guide.steps : [];
        const total = steps.length || 0;
        const done = readStringList(key).length;
        if (!total) return null;
        const pct = Math.max(0, Math.min(100, Math.round((Math.min(done, total) / total) * 100)));
        return { id, guide, done: Math.min(done, total), total, pct };
      })
      .filter(Boolean)
      .filter((x) => x.pct > 0 && x.pct < 100)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8)
      .map((x) => {
        const title = x.guide?.title || `攻略：${x.id}`;
        const desc = `已完成 ${x.done}/${x.total} · ${x.pct}%`;
        return {
          icon: x.guide?.icon || "images/icons/guide-icon.svg",
          title,
          desc,
          href: `guide-detail.html?id=${encodeURIComponent(x.id)}`,
        };
      });
    renderMiniCards(progressEl, progressItems, "还没有发现进行中的攻略进度");

    // 5) 更新中心概览
    const countUpdate = (type, dict) => {
      let nNew = 0;
      let nUpdated = 0;
      Object.entries(dict || {}).forEach(([id, item]) => {
        const status = getUpdateStatus(type, id, item?.updated);
        if (status === "new") nNew += 1;
        if (status === "updated") nUpdated += 1;
      });
      return { nNew, nUpdated };
    };

    const updateCounts = {
      games: countUpdate("games", data.games),
      guides: countUpdate("guides", data.guides),
      topics: countUpdate("topics", data.topics),
    };

    const totalNew = updateCounts.games.nNew + updateCounts.guides.nNew + updateCounts.topics.nNew;
    const totalUpdated = updateCounts.games.nUpdated + updateCounts.guides.nUpdated + updateCounts.topics.nUpdated;

    renderMetaList(updatesEl, [
      { label: "NEW", value: `${totalNew}` },
      { label: "UPDATED", value: `${totalUpdated}` },
      { label: "当前版本", value: String(data.version || "—") },
    ]);

    markAllBtn?.addEventListener("click", () => {
      let touched = 0;
      Object.entries(data.games || {}).forEach(([id, g]) => {
        if (markItemSeen("games", id, g?.updated)) touched += 1;
      });
      Object.entries(data.guides || {}).forEach(([id, g]) => {
        if (markItemSeen("guides", id, g?.updated)) touched += 1;
      });
      Object.entries(data.topics || {}).forEach(([id, t]) => {
        if (markItemSeen("topics", id, t?.updated)) touched += 1;
      });

      toast({ title: "已标记", message: `已同步更新雷达（写入 ${touched} 项）。`, tone: "success" });

      const nextCounts = {
        games: countUpdate("games", data.games),
        guides: countUpdate("guides", data.guides),
        topics: countUpdate("topics", data.topics),
      };
      const nextNew = nextCounts.games.nNew + nextCounts.guides.nNew + nextCounts.topics.nNew;
      const nextUpdated = nextCounts.games.nUpdated + nextCounts.guides.nUpdated + nextCounts.topics.nUpdated;
      renderMetaList(updatesEl, [
        { label: "NEW", value: `${nextNew}` },
        { label: "UPDATED", value: `${nextUpdated}` },
        { label: "当前版本", value: String(data.version || "—") },
      ]);
    });
  };

  // -------------------------
  // Updates Page
  // -------------------------

  const initUpdatesPage = () => {
    if (getPage() !== "updates") return;

    const data = getData();
    if (!data) return;

    const summaryEl = $("#updates-summary");
    const grid = $("#updates-grid");
    const empty = $("#updates-empty");
    const searchInput = $("#updates-search");
    const searchBtn = $("#updates-search-btn");
    const typeSelect = $("#updates-type");
    const statusSelect = $("#updates-status");
    const countEl = $("#updates-count");
    const clearBtn = $("#updates-clear");
    const markAllBtn = $("#updates-mark-all");

    if (!grid) return;

    const typeLabel = (t) => (t === "games" ? "游戏" : t === "guides" ? "攻略" : t === "topics" ? "话题" : "内容");

    const typeIcon = (t) => {
      if (t === "games") return "images/icons/game-icon.svg";
      if (t === "guides") return "images/icons/guide-icon.svg";
      if (t === "topics") return "images/icons/user-avatar.svg";
      return "images/icons/game-icon.svg";
    };

    const hrefOf = (t, id) => {
      const safe = encodeURIComponent(String(id || ""));
      if (t === "games") return `game.html?id=${safe}`;
      if (t === "guides") return `guide-detail.html?id=${safe}`;
      if (t === "topics") return `forum-topic.html?id=${safe}`;
      return "index.html";
    };

    const allItems = [];
    const pushItem = (t, id, item) => {
      const title = String(item?.title || id || "—");
      const updated = String(item?.updated || "");
      const tags = Array.isArray(item?.tags) ? item.tags.map(String) : [];
      const extra =
        t === "games"
          ? [String(item?.genre || ""), String(item?.difficulty || ""), String(item?.year || "")]
          : t === "guides"
            ? [String(item?.difficulty || ""), String(item?.readingTime || ""), String(item?.summary || "")]
            : [String(item?.category || ""), String(item?.starter || ""), String(item?.summary || "")];
      const blob = `${title} ${tags.join(" ")} ${extra.join(" ")}`.toLowerCase();
      allItems.push({ type: t, id: String(id || ""), item, title, updated, tags, blob });
    };

    Object.entries(data.games || {}).forEach(([id, g]) => pushItem("games", id, g));
    Object.entries(data.guides || {}).forEach(([id, g]) => pushItem("guides", id, g));
    Object.entries(data.topics || {}).forEach(([id, t]) => pushItem("topics", id, t));

    const readStateFromUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const q = String(params.get("q") || "");
        const type = String(params.get("type") || "all");
        const status = String(params.get("status") || "changed");
        const validType = new Set(["all", "games", "guides", "topics"]);
        const validStatus = new Set(["changed", "new", "updated", "all"]);
        return {
          query: q,
          type: validType.has(type) ? type : "all",
          status: validStatus.has(status) ? status : "changed",
        };
      } catch (_) {
        return { query: "", type: "all", status: "changed" };
      }
    };

    let state = readStateFromUrl();

    const syncUrl = () => {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const q = String(state.query || "").trim();
        if (q) params.set("q", q);
        else params.delete("q");

        if (state.type && state.type !== "all") params.set("type", state.type);
        else params.delete("type");

        if (state.status && state.status !== "changed") params.set("status", state.status);
        else params.delete("status");

        url.search = params.toString();
        window.history.replaceState({}, "", url.toString());
      } catch (_) {}
    };

    const countUpdate = (t, dict) => {
      let nNew = 0;
      let nUpdated = 0;
      Object.entries(dict || {}).forEach(([id, item]) => {
        const status = getUpdateStatus(t, id, item?.updated);
        if (status === "new") nNew += 1;
        if (status === "updated") nUpdated += 1;
      });
      return { nNew, nUpdated };
    };

    const renderSummary = () => {
      const counts = {
        games: countUpdate("games", data.games),
        guides: countUpdate("guides", data.guides),
        topics: countUpdate("topics", data.topics),
      };
      let highImpact = 0;
      Object.values(data.games || {}).forEach((g) => {
        if (computeImpact("games", g) >= 75) highImpact += 1;
      });
      Object.values(data.guides || {}).forEach((g) => {
        if (computeImpact("guides", g) >= 75) highImpact += 1;
      });
      Object.values(data.topics || {}).forEach((t) => {
        if (computeImpact("topics", t) >= 75) highImpact += 1;
      });
      const totalNew = counts.games.nNew + counts.guides.nNew + counts.topics.nNew;
      const totalUpdated = counts.games.nUpdated + counts.guides.nUpdated + counts.topics.nUpdated;
      const radar = readUpdateRadar();
      const seededAt = radar?.seededAt ? new Date(radar.seededAt).toLocaleString("zh-CN") : "—";

      renderMetaList(summaryEl, [
        { label: "NEW", value: `${totalNew}` },
        { label: "UPDATED", value: `${totalUpdated}` },
        { label: "高影响", value: `${highImpact}` },
        { label: "已读基线", value: seededAt },
        { label: "当前版本", value: String(data.version || "—") },
      ]);
    };

    const renderCard = (x) => {
      const status = getUpdateStatus(x.type, x.id, x.updated);
      const badge = renderUpdateBadge(status);
      const impactScore = Math.round(computeImpact(x.type, x.item));
      const impactInfo = impactLevel(impactScore);
      const impactBadge = `<span class="impact-badge ${impactInfo.tone}">${escapeHtml(impactInfo.label)}</span>`;
      const href = hrefOf(x.type, x.id);
      const icon = x.item?.icon || typeIcon(x.type);
      const updatedText = x.updated ? `更新 ${formatDate(x.updated)}` : "更新待补";
      const tags = x.tags.slice(0, 4).map((t) => `<span class=\"chip\">${escapeHtml(t)}</span>`).join("");
      const canMark = Boolean(parseDateKey(x.updated)) && (status === "new" || status === "updated");
      const markText = canMark ? "标为已读" : "已读";

      return `
        <article class="update-card" data-type="${escapeHtml(x.type)}" data-id="${escapeHtml(x.id)}">
          <div class="update-card-head">
            <div class="update-card-badges">
              ${badge}
              ${impactBadge}
              <span class="chip chip-muted">${escapeHtml(typeLabel(x.type))}</span>
            </div>
            <div class="update-card-meta">${escapeHtml(updatedText)}</div>
          </div>
          <a class="update-card-main" href="${href}">
            <img class="update-card-icon" src="${icon}" alt="${escapeHtml(x.title)}" loading="lazy">
            <div class="update-card-body">
              <div class="update-card-title" title="${escapeHtml(x.title)}">${escapeHtml(x.title)}</div>
              <div class="update-card-sub">${escapeHtml(x.item?.summary || x.item?.genre || x.item?.category || "打开查看详情")}</div>
              <div class="chips update-card-tags">${tags}</div>
              <div class="impact-meter ${impactInfo.tone}">
                <span class="impact-fill" style="width:${clampNumber(impactScore, 0, 100)}%"></span>
                <span class="impact-value">${impactScore}</span>
              </div>
            </div>
          </a>
          <div class="update-card-actions">
            <a class="btn btn-small" href="${href}">打开</a>
            <button type="button" class="btn btn-small btn-secondary" data-action="updates-mark" ${canMark ? "" : "disabled"}>${markText}</button>
          </div>
        </article>
      `;
    };

    const animateCards = () => {
      if (prefersReducedMotion()) return;
      const nodes = $$(".update-card", grid);
      if (nodes.length === 0) return;
      const delay = motionStagger(0.03);
      motionAnimate(nodes, { opacity: [0, 1], y: [12, 0], filter: ["blur(10px)", "blur(0px)"] }, { duration: 0.34, delay });
    };

    const apply = () => {
      const q = String(state.query || "").trim().toLowerCase();
      const selectedType = state.type || "all";
      const selectedStatus = state.status || "changed";

      const filtered = allItems.filter((x) => {
        if (selectedType !== "all" && x.type !== selectedType) return false;
        if (q && !x.blob.includes(q)) return false;
        const status = getUpdateStatus(x.type, x.id, x.updated);
        if (selectedStatus === "new") return status === "new";
        if (selectedStatus === "updated") return status === "updated";
        if (selectedStatus === "changed") return status === "new" || status === "updated";
        return true;
      });

      const sorted = [...filtered].sort((a, b) => {
        const sb = getUpdateStatus(b.type, b.id, b.updated);
        const sa = getUpdateStatus(a.type, a.id, a.updated);
        const wb = sb === "new" ? 3 : sb === "updated" ? 2 : 1;
        const wa = sa === "new" ? 3 : sa === "updated" ? 2 : 1;
        if (wb !== wa) return wb - wa;
        return parseDateKey(b.updated) - parseDateKey(a.updated);
      });

      withViewTransition(() => {
        grid.innerHTML = sorted.map(renderCard).join("");
        const total = sorted.length;
        if (countEl) countEl.textContent = total ? `共 ${total} 条更新` : "";
        if (empty) empty.hidden = total !== 0 || Boolean(q);
      });
      syncUrl();
      animateCards();
    };

    const syncControls = () => {
      if (searchInput) searchInput.value = state.query || "";
      if (typeSelect) typeSelect.value = state.type || "all";
      if (statusSelect) statusSelect.value = state.status || "changed";
    };

    renderSummary();
    syncControls();
    apply();

    const syncFromInput = () => {
      state = { ...state, query: searchInput?.value?.trim() || "" };
      apply();
    };

    searchBtn?.addEventListener("click", syncFromInput);
    typeSelect?.addEventListener("change", () => {
      state = { ...state, type: String(typeSelect.value || "all") };
      apply();
    });
    statusSelect?.addEventListener("change", () => {
      state = { ...state, status: String(statusSelect.value || "changed") };
      apply();
    });

    if (searchInput) {
      let t = 0;
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          syncFromInput();
        }
      });
      searchInput.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(syncFromInput, 160);
      });
    }

    clearBtn?.addEventListener("click", () => {
      state = { query: "", type: "all", status: "changed" };
      syncControls();
      apply();
    });

    markAllBtn?.addEventListener("click", () => {
      let touched = 0;
      Object.entries(data.games || {}).forEach(([id, g]) => {
        if (markItemSeen("games", id, g?.updated)) touched += 1;
      });
      Object.entries(data.guides || {}).forEach(([id, g]) => {
        if (markItemSeen("guides", id, g?.updated)) touched += 1;
      });
      Object.entries(data.topics || {}).forEach(([id, t]) => {
        if (markItemSeen("topics", id, t?.updated)) touched += 1;
      });
      toast({ title: "已标记", message: `已同步更新雷达（写入 ${touched} 项）。`, tone: "success" });
      renderSummary();
      apply();
    });

    grid.addEventListener("click", (e) => {
      const btn = e.target?.closest?.('button[data-action="updates-mark"]');
      if (!btn) return;
      const card = btn.closest?.(".update-card");
      if (!card) return;
      const t = String(card.dataset.type || "");
      const id = String(card.dataset.id || "");
      const dict = t === "games" ? data.games : t === "guides" ? data.guides : data.topics;
      const item = dict?.[id] || null;
      const ok = markItemSeen(t, id, item?.updated);
      if (!ok) {
        toast({ title: "无法标记", message: "该条目缺少更新时间或写入失败。", tone: "warn" });
        return;
      }
      toast({ title: "已标为已读", message: "更新雷达已同步。", tone: "success" });
      renderSummary();
      apply();
    });
  };

  // -------------------------
  // Planner (Plans)
  // -------------------------

  const normalizePlanItem = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const type = String(raw.type || "").trim();
    const id = String(raw.id || "").trim();
    if (!id) return null;
    if (type !== "game" && type !== "guide") return null;
    return { type, id };
  };

  const readPlansState = () => {
    const parsed = safeJsonParse(storage.get(STORAGE_KEYS.plans), null);
    const base = { version: 1, currentId: "", plans: {} };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return base;

    const plans = {};
    const rawPlans = parsed.plans && typeof parsed.plans === "object" && !Array.isArray(parsed.plans) ? parsed.plans : {};
    Object.entries(rawPlans).forEach(([pid, plan]) => {
      const id = String(pid || "").trim();
      if (!id) return;
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) return;
      const name = String(plan.name || "").trim() || "未命名路线";
      const items = Array.isArray(plan.items) ? plan.items.map(normalizePlanItem).filter(Boolean) : [];
      plans[id] = {
        id,
        name: name.slice(0, 42),
        createdAt: Number(plan.createdAt || 0) || 0,
        updatedAt: Number(plan.updatedAt || 0) || 0,
        items: items.slice(0, 120),
      };
    });

    const ids = Object.keys(plans);
    const currentIdRaw = String(parsed.currentId || "").trim();
    const currentId = ids.includes(currentIdRaw) ? currentIdRaw : ids[0] || "";
    return { version: 1, currentId, plans };
  };

  const writePlansState = (state) => {
    try {
      return storage.set(STORAGE_KEYS.plans, JSON.stringify(state));
    } catch (_) {
      return false;
    }
  };

  const ensurePlansState = () => {
    const state = readPlansState();
    const ids = Object.keys(state.plans);
    if (ids.length > 0 && state.currentId) return state;
    const id = uid();
    const now = Date.now();
    const next = {
      version: 1,
      currentId: id,
      plans: { [id]: { id, name: "我的路线", createdAt: now, updatedAt: now, items: [] } },
    };
    writePlansState(next);
    return next;
  };

  const addItemToCurrentPlan = (item) => {
    const normalized = normalizePlanItem(item);
    if (!normalized) return { ok: false, added: false, planId: "" };
    const state = ensurePlansState();
    const planId = state.currentId;
    const plan = state.plans?.[planId];
    if (!plan) return { ok: false, added: false, planId: "" };

    const exists = plan.items.some((x) => x.type === normalized.type && x.id === normalized.id);
    if (exists) return { ok: true, added: false, planId };

    const next = {
      ...state,
      plans: { ...state.plans, [planId]: { ...plan, updatedAt: Date.now(), items: [...plan.items, normalized] } },
    };
    writePlansState(next);
    return { ok: true, added: true, planId };
  };

  const createPlanFromItems = (name, items) => {
    const state = ensurePlansState();
    const id = uid();
    const now = Date.now();
    const normalized = Array.isArray(items) ? items.map(normalizePlanItem).filter(Boolean) : [];
    const safeName = String(name || "").trim().slice(0, 42) || "新路线";
    const next = {
      ...state,
      currentId: id,
      plans: {
        ...state.plans,
        [id]: { id, name: safeName, createdAt: now, updatedAt: now, items: normalized.slice(0, 120) },
      },
    };
    writePlansState(next);
    return { id, state: next };
  };

  const initPlannerPage = () => {
    if (getPage() !== "planner") return;

    const data = getData();
    if (!data) return;

    const selectEl = $("#planner-select");
    const metaEl = $("#planner-meta");
    const listEl = $("#planner-list");
    const emptyEl = $("#planner-empty");

    const createBtn = $("#planner-create");
    const renameBtn = $("#planner-rename");
    const deleteBtn = $("#planner-delete");
    const shareBtn = $("#planner-share");
    const importBtn = $("#planner-import");
    const focusRange = $("#planner-focus-range");
    const focusValue = $("#planner-focus-value");
    const sprintEl = $("#planner-sprint");
    const sprintSummary = $("#planner-sprint-summary");
    const smartSortBtn = $("#planner-smart-sort");
    const sprintCopyBtn = $("#planner-sprint-copy");

    const addInput = $("#planner-add-input");
    const addBtn = $("#planner-add-btn");
    const suggestEl = $("#planner-suggest");

    if (!selectEl || !listEl) return;

    const animatePlanItemAdded = (idx) => {
      const el = listEl.querySelector(`.plan-item[data-idx="${idx}"]`);
      if (!el) return;
      motionAnimate(
        el,
        { opacity: [0, 1], y: [10, 0], scale: [0.99, 1], filter: ["blur(10px)", "blur(0px)"] },
        { duration: 0.24 }
      );
    };

    const animatePlanItemDropped = (idx) => {
      const el = listEl.querySelector(`.plan-item[data-idx="${idx}"]`);
      if (!el) return;
      motionAnimate(el, { scale: [1, 1.02, 1], filter: ["blur(0px)", "blur(0px)", "blur(0px)"] }, { duration: 0.3 });
    };

    const animatePlanItemRemoved = (el) => {
      if (!el) return Promise.resolve();
      if (prefersReducedMotion()) return Promise.resolve();

      let h = 0;
      let mt = "0px";
      let mb = "0px";
      try {
        h = Math.max(0, Math.round(el.getBoundingClientRect().height));
        const cs = window.getComputedStyle(el);
        mt = cs.marginTop || "0px";
        mb = cs.marginBottom || "0px";
      } catch (_) {}
      const heightPx = `${h || el.offsetHeight || 0}px`;

      try {
        el.style.overflow = "hidden";
        el.style.height = heightPx;
        el.style.marginTop = mt;
        el.style.marginBottom = mb;
      } catch (_) {}

      const anim = motionAnimate(
        el,
        {
          opacity: [1, 0],
          y: [0, -8],
          scale: [1, 0.985],
          height: [heightPx, "0px"],
          marginTop: [mt, "0px"],
          marginBottom: [mb, "0px"],
          filter: ["blur(0px)", "blur(10px)"],
        },
        { duration: 0.22 }
      );
      return motionFinished(anim);
    };

    const pool = [];
    Object.entries(data.games || {}).forEach(([id, g]) => {
      pool.push({
        type: "game",
        id: String(id || ""),
        title: String(g?.title || id),
        subtitle: String(g?.genre || ""),
        tags: Array.isArray(g?.tags) ? g.tags.map(String) : [],
        icon: g?.icon || "images/icons/game-icon.svg",
      });
    });
    Object.entries(data.guides || {}).forEach(([id, g]) => {
      pool.push({
        type: "guide",
        id: String(id || ""),
        title: String(g?.title || id),
        subtitle: String(g?.summary || ""),
        tags: Array.isArray(g?.tags) ? g.tags.map(String) : [],
        icon: g?.icon || "images/icons/guide-icon.svg",
      });
    });

    const normalizeQuery = (q) => String(q || "").trim().toLowerCase();
    const poolIndex = pool.map((x) => ({ ...x, blob: `${x.title} ${x.subtitle} ${x.tags.join(" ")}`.toLowerCase() }));

    let state = ensurePlansState();

    const openId = getParam("open");
    if (openId && state.plans?.[openId]) {
      state = { ...state, currentId: openId };
      writePlansState(state);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("open");
        window.history.replaceState({}, "", url.toString());
      } catch (_) {}
    }

    const maybeImportFromHash = () => {
      const hash = String(window.location.hash || "");
      const m = hash.match(/(?:^#|[&#])plan=([^&]+)/);
      if (!m) return false;
      const raw = base64UrlDecode(m[1]);
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object") return false;
      if (String(parsed.schema || "") !== "gkb-plan-share") return false;
      const created = createPlanFromItems(String(parsed.name || "分享路线"), parsed.items);
      state = created.state;
      toast({ title: "导入成功", message: `已导入路线：${state.plans[created.id].name}`, tone: "success" });
      try {
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.replaceState({}, "", url.toString());
      } catch (_) {}
      return true;
    };
    maybeImportFromHash();

    const readPlanSettings = () => {
      const parsed = safeJsonParse(storage.get(STORAGE_KEYS.planSettings), null);
      const focusMinutes = clampNumber(parsed?.focusMinutes || 45, 20, 120);
      return { focusMinutes };
    };

    const writePlanSettings = (settings) => storage.set(STORAGE_KEYS.planSettings, JSON.stringify(settings));

    let planSettings = readPlanSettings();

    const syncFocusLabel = () => {
      if (focusRange) focusRange.value = String(planSettings.focusMinutes);
      if (focusValue) focusValue.textContent = `${planSettings.focusMinutes} 分钟`;
    };

    const getPlan = () => state.plans?.[state.currentId] || null;

    const persist = () => writePlansState(state);

    const syncSelect = () => {
      const ids = Object.keys(state.plans);
      selectEl.innerHTML = ids
        .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(state.plans[id]?.name || "未命名路线")}</option>`)
        .join("");
      if (state.currentId && state.plans[state.currentId]) selectEl.value = state.currentId;
    };

    const computePlanMeta = (plan) => {
      const items = Array.isArray(plan?.items) ? plan.items : [];
      const games = items.filter((x) => x.type === "game").length;
      const guides = items.filter((x) => x.type === "guide").length;
      const minutes = items
        .filter((x) => x.type === "guide")
        .map((x) => Number(data.guides?.[x.id]?.readingTime || 0) || 0)
        .reduce((a, b) => a + b, 0);
      const inProgress = items
        .filter((x) => x.type === "guide")
        .map((x) => computeGuideProgress(x.id, data.guides?.[x.id]))
        .filter((p) => p.pct > 0 && p.pct < 100).length;
      const library = readGameLibraryMap();
      const playing = items.filter((x) => x.type === "game" && getGameLibraryStatus(x.id, library) === "playing").length;
      return [
        { label: "条目数", value: `${items.length}` },
        { label: "游戏", value: `${games}` },
        { label: "攻略", value: `${guides}` },
        { label: "阅读时长", value: minutes ? `约 ${minutes} 分钟` : "—" },
        { label: "进行中攻略", value: `${inProgress}` },
        { label: "在玩游戏", value: `${playing}` },
      ];
    };

    const renderList = (plan) => {
      const items = Array.isArray(plan?.items) ? plan.items : [];
      if (items.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      const library = readGameLibraryMap();
      listEl.innerHTML = items
        .map((x, idx) => {
          const isGuide = x.type === "guide";
          const entity = isGuide ? data.guides?.[x.id] : data.games?.[x.id];
          const title = String(entity?.title || `${isGuide ? "攻略" : "游戏"}：${x.id}`);
          const icon = String(entity?.icon || (isGuide ? "images/icons/guide-icon.svg" : "images/icons/game-icon.svg"));
          const href = isGuide ? `guide-detail.html?id=${encodeURIComponent(x.id)}` : `game.html?id=${encodeURIComponent(x.id)}`;
          const updated = entity?.updated ? `更新 ${formatDate(entity.updated)}` : "更新待补";

          let meta = updated;
          let chips = "";
          if (isGuide) {
            const p = computeGuideProgress(x.id, entity);
            if (p.total) meta = `${updated} · 进度 ${p.done}/${p.total}（${p.pct}%）`;
            chips = `<span class="chip chip-muted">攻略</span><span class="chip">${escapeHtml(entity?.difficulty || "通用")}</span>${p.total ? `<span class="chip">${p.pct}%</span>` : ""}`;
          } else {
            const s = getGameLibraryStatus(x.id, library);
            const label = s === "playing" ? "在玩" : s === "wishlist" ? "想玩" : s === "done" ? "已通关" : "未设置";
            meta = `${updated} · ${label}`;
            chips = `<span class="chip chip-muted">游戏</span><span class="chip">${escapeHtml(label)}</span>`;
          }

          return `
            <div class="plan-item" draggable="true" data-idx="${idx}">
              <div class="plan-handle" aria-hidden="true">⋮⋮</div>
              <a class="plan-main" href="${href}">
                <img class="plan-icon" src="${icon}" alt="${escapeHtml(title)}" loading="lazy">
                <div class="plan-body">
                  <div class="plan-title">${escapeHtml(title)}</div>
                  <div class="plan-sub">${escapeHtml(meta)}</div>
                  <div class="chips plan-chips">${chips}</div>
                </div>
              </a>
              <div class="plan-actions">
                <button type="button" class="btn btn-small btn-secondary" data-action="plan-remove" data-idx="${idx}">移除</button>
              </div>
            </div>
          `;
        })
        .join("");
    };

    const renderSprint = (plan) => {
      if (!sprintEl) return;
      const items = Array.isArray(plan?.items) ? plan.items : [];
      if (items.length === 0) {
        sprintEl.innerHTML = '<div class="empty-state small"><p class="empty-title">还没有路线内容</p><p class="empty-desc">添加游戏或攻略后，系统会自动生成冲刺节奏。</p></div>';
        renderMetaList(sprintSummary, [], "");
        return;
      }
      const schedule = buildSprintSchedule(plan, data, planSettings.focusMinutes);
      sprintEl.innerHTML = schedule.sessions
        .map((session, idx) => {
          const list = session.items
            .map((item) => `<span class="sprint-item ${escapeHtml(item.type)}">${escapeHtml(item.label)}</span>`)
            .join("");
          return `
            <div class="sprint-card">
              <div class="sprint-head">
                <span class="sprint-title">冲刺 ${idx + 1}</span>
                <span class="sprint-time">${Math.round(session.minutes)} 分钟</span>
              </div>
              <div class="sprint-items">${list}</div>
            </div>
          `;
        })
        .join("");

      renderMetaList(sprintSummary, [
        { label: "总时长", value: `${Math.round(schedule.totalMinutes)} 分钟` },
        { label: "冲刺段数", value: `${schedule.sessions.length}` },
        { label: "单次目标", value: `${planSettings.focusMinutes} 分钟` },
      ]);
    };

    const render = () => {
      const plan = getPlan();
      syncSelect();
      renderMetaList(metaEl, computePlanMeta(plan));
      renderList(plan);
      renderSprint(plan);
    };

    const setCurrent = (id) => {
      if (!id || !state.plans?.[id]) return;
      state = { ...state, currentId: id };
      persist();
      render();
    };

    selectEl.addEventListener("change", () => setCurrent(String(selectEl.value || "")));

    createBtn?.addEventListener("click", () => {
      const name = window.prompt("给新路线起个名字：", "我的新路线");
      if (name == null) return;
      const created = createPlanFromItems(name, []);
      state = created.state;
      render();
      toast({ title: "已创建", message: "新路线已保存到本地浏览器。", tone: "success" });
    });

    renameBtn?.addEventListener("click", () => {
      const plan = getPlan();
      if (!plan) return;
      const nextName = window.prompt("重命名路线：", plan.name || "");
      if (nextName == null) return;
      const name = String(nextName).trim().slice(0, 42) || plan.name;
      state = { ...state, plans: { ...state.plans, [plan.id]: { ...plan, name, updatedAt: Date.now() } } };
      persist();
      render();
      toast({ title: "已重命名", message: `当前路线：${name}`, tone: "success" });
    });

    deleteBtn?.addEventListener("click", () => {
      const plan = getPlan();
      if (!plan) return;
      const ok = window.confirm(`确认删除路线“${plan.name}”吗？（不可恢复）`);
      if (!ok) return;
      const nextPlans = { ...state.plans };
      delete nextPlans[plan.id];
      const ids = Object.keys(nextPlans);
      state =
        ids.length > 0
          ? { ...state, currentId: ids[0], plans: nextPlans }
          : ensurePlansState();
      persist();
      render();
      toast({ title: "已删除", message: "路线已移除（本地）。", tone: "info" });
    });

    const buildShareUrl = (plan) => {
      try {
        const payload = { schema: "gkb-plan-share", name: plan?.name || "分享路线", items: Array.isArray(plan?.items) ? plan.items : [] };
        const encoded = base64UrlEncode(JSON.stringify(payload));
        if (!encoded) return "";
        const url = new URL(window.location.href);
        url.pathname = url.pathname.replace(/[^/]*$/, "planner.html");
        url.search = "";
        url.hash = `plan=${encoded}`;
        return url.toString();
      } catch (_) {
        return "";
      }
    };

    shareBtn?.addEventListener("click", () => {
      const plan = getPlan();
      if (!plan) return;
      const url = buildShareUrl(plan);
      if (!url) {
        toast({ title: "复制失败", message: "无法生成分享链接。", tone: "warn" });
        return;
      }
      copyTextToClipboard(url).then((ok) => {
        toast({
          title: ok ? "分享链接已复制" : "复制失败",
          message: ok ? "已复制到剪贴板，发给朋友即可导入路线。" : "当前环境不支持剪贴板访问。",
          tone: ok ? "success" : "warn",
        });
      });
    });

    importBtn?.addEventListener("click", () => {
      const input = window.prompt("粘贴分享链接（或 #plan= 后的内容）：", "");
      if (!input) return;
      const text = String(input).trim();
      const m = text.match(/plan=([^&]+)/);
      const token = m ? m[1] : text;
      const raw = base64UrlDecode(token);
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object" || String(parsed.schema || "") !== "gkb-plan-share") {
        toast({ title: "导入失败", message: "链接格式不正确。", tone: "warn" });
        return;
      }
      const created = createPlanFromItems(String(parsed.name || "导入路线"), parsed.items);
      state = created.state;
      render();
      toast({ title: "导入成功", message: "路线已写入本地浏览器。", tone: "success" });
    });

    const hideSuggest = () => {
      if (!suggestEl) return;
      suggestEl.hidden = true;
      suggestEl.innerHTML = "";
    };

    const showSuggest = (q) => {
      if (!suggestEl) return;
      const query = normalizeQuery(q);
      if (!query) {
        hideSuggest();
        return;
      }
      const results = poolIndex.filter((x) => x.blob.includes(query)).slice(0, 8);
      if (results.length === 0) {
        hideSuggest();
        return;
      }
      suggestEl.innerHTML = results
        .map(
          (x) => `
            <button type="button" class="planner-suggest-item" data-type="${escapeHtml(x.type)}" data-id="${escapeHtml(x.id)}">
              <img src="${x.icon}" alt="${escapeHtml(x.title)}">
              <span class="planner-suggest-main">
                <span class="planner-suggest-title">${escapeHtml(x.title)}</span>
                <span class="planner-suggest-sub">${escapeHtml(x.subtitle || "")}</span>
              </span>
              <span class="planner-suggest-tag">${escapeHtml(x.type === "guide" ? "攻略" : "游戏")}</span>
            </button>
          `
        )
        .join("");
      suggestEl.hidden = false;
    };

    const addToPlan = (type, id) => {
      const result = addItemToCurrentPlan({ type, id });
      if (!result.ok) {
        toast({ title: "添加失败", message: "无法写入本地数据。", tone: "warn" });
        return;
      }
      if (!result.added) {
        toast({ title: "已在路线中", message: "该条目已存在，无需重复添加。", tone: "info" });
        return;
      }
      state = readPlansState();
      render();
      window.requestAnimationFrame(() => {
        const plan = getPlan();
        const idx = plan ? Math.max(0, (plan.items || []).length - 1) : -1;
        if (idx >= 0) animatePlanItemAdded(idx);
      });
      toast({ title: "已加入路线", message: "拖拽可排序，进度会自动汇总。", tone: "success" });
    };

    const addFirstSuggest = () => {
      const q = addInput?.value || "";
      const query = normalizeQuery(q);
      if (!query) return;
      const hit = poolIndex.find((x) => x.blob.includes(query));
      if (!hit) {
        toast({ title: "没找到", message: "换个关键词试试，例如 Boss / Build / 文明6。", tone: "info" });
        return;
      }
      addToPlan(hit.type, hit.id);
      if (addInput) addInput.value = "";
      hideSuggest();
    };

    addBtn?.addEventListener("click", addFirstSuggest);

    if (addInput) {
      let t = 0;
      addInput.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => showSuggest(addInput.value), 80);
      });
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addFirstSuggest();
        }
        if (e.key === "Escape") hideSuggest();
      });
      addInput.addEventListener("blur", () => window.setTimeout(hideSuggest, 120));
      addInput.addEventListener("focus", () => showSuggest(addInput.value));
    }

    suggestEl?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".planner-suggest-item");
      if (!btn) return;
      const type = String(btn.dataset.type || "");
      const id = String(btn.dataset.id || "");
      addToPlan(type, id);
      if (addInput) addInput.value = "";
      hideSuggest();
    });

    listEl.addEventListener("click", (e) => {
      const btn = e.target?.closest?.('button[data-action="plan-remove"]');
      if (!btn) return;
      const idx = Number(btn.dataset.idx || -1);
      const plan = getPlan();
      if (!plan) return;
      if (idx < 0 || idx >= plan.items.length) return;

      const row = btn.closest?.(".plan-item");
      const commit = () => {
        const nextItems = plan.items.filter((_, i) => i !== idx);
        state = { ...state, plans: { ...state.plans, [plan.id]: { ...plan, updatedAt: Date.now(), items: nextItems } } };
        persist();
        render();
        toast({ title: "已移除", message: "条目已从路线中删除。", tone: "info" });
      };

      animatePlanItemRemoved(row).then(commit).catch(commit);
    });

    // Drag & Drop reorder（轻量实现）
    let dragIdx = -1;
    let dropTarget = null;

    const setDropTarget = (el) => {
      if (dropTarget === el) return;
      try {
        dropTarget?.classList?.remove?.("is-drop-target");
      } catch (_) {}
      dropTarget = el;
      try {
        dropTarget?.classList?.add?.("is-drop-target");
      } catch (_) {}
    };

    const clearDropTarget = () => setDropTarget(null);

    listEl.addEventListener("dragstart", (e) => {
      const item = e.target?.closest?.(".plan-item");
      if (!item) return;
      dragIdx = Number(item.dataset.idx || -1);
      item.classList.add("is-dragging");
      setDropTarget(item);
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(dragIdx));
      } catch (_) {}
    });
    listEl.addEventListener("dragend", (e) => {
      e.target?.closest?.(".plan-item")?.classList?.remove?.("is-dragging");
      dragIdx = -1;
      clearDropTarget();
    });
    listEl.addEventListener("dragover", (e) => {
      const over = e.target?.closest?.(".plan-item");
      if (!over) return;
      e.preventDefault();
      setDropTarget(over);
    });
    listEl.addEventListener("drop", (e) => {
      const over = e.target?.closest?.(".plan-item");
      if (!over) return;
      e.preventDefault();
      const from = dragIdx;
      const to = Number(over.dataset.idx || -1);
      if (from < 0 || to < 0 || from === to) return;
      const plan = getPlan();
      if (!plan) return;
      const items = [...plan.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      state = { ...state, plans: { ...state.plans, [plan.id]: { ...plan, updatedAt: Date.now(), items } } };
      persist();
      withViewTransition(render);
      clearDropTarget();
      window.requestAnimationFrame(() => animatePlanItemDropped(to));
    });

    syncFocusLabel();
    focusRange?.addEventListener("input", () => {
      const next = clampNumber(Number(focusRange.value || 0), 20, 120);
      planSettings = { ...planSettings, focusMinutes: next };
      writePlanSettings(planSettings);
      syncFocusLabel();
      renderSprint(getPlan());
    });

    smartSortBtn?.addEventListener("click", () => {
      const plan = getPlan();
      if (!plan) return;
      const library = readGameLibraryMap();
      const ranked = plan.items
        .map((item, idx) => ({ item, idx, score: scorePlanItem(item, data, library) }))
        .sort((a, b) => (b.score || 0) - (a.score || 0) || a.idx - b.idx)
        .map((row) => row.item);
      state = { ...state, plans: { ...state.plans, [plan.id]: { ...plan, updatedAt: Date.now(), items: ranked } } };
      persist();
      render();
      toast({ title: "已完成智能排序", message: "优先推进进行中攻略与在玩游戏。", tone: "success" });
    });

    sprintCopyBtn?.addEventListener("click", () => {
      const plan = getPlan();
      if (!plan) return;
      const schedule = buildSprintSchedule(plan, data, planSettings.focusMinutes);
      if (schedule.sessions.length === 0) return;
      const lines = [
        `路线冲刺计划 · ${plan.name || "未命名路线"}`,
        `单次目标：${planSettings.focusMinutes} 分钟 | 共 ${schedule.sessions.length} 段`,
        ...schedule.sessions.map((session, idx) => {
          const list = session.items.map((item) => `- ${item.label}`).join(" / ");
          return `${idx + 1}. ${Math.round(session.minutes)} 分钟：${list}`;
        }),
      ];
      copyTextToClipboard(lines.join("\n")).then((ok) => {
        toast({
          title: ok ? "冲刺计划已复制" : "复制失败",
          message: ok ? "已写入剪贴板，可直接发给队友或备忘。" : "当前环境不支持剪贴板。",
          tone: ok ? "success" : "warn",
        });
      });
    });

    render();
  };

  // -------------------------
  // Discover Page (Recommendations)
  // -------------------------

  const initDiscoverPage = () => {
    if (getPage() !== "discover") return;

    const data = getData();
    if (!data) return;

    const tagsEl = $("#discover-tags");
    const intentsEl = $("#discover-intents");
    const dnaEl = $("#discover-dna");
    const dnaTagsEl = $("#discover-dna-tags");
    const guidesEl = $("#discover-guides");
    const gamesEl = $("#discover-games");
    const emptyEl = $("#discover-empty");
    const refreshBtn = $("#discover-refresh");
    const buildPlanBtn = $("#discover-build-plan");
    const onlyUnsavedEl = $("#discover-only-unsaved");

    const readPrefs = () => {
      const parsed = safeJsonParse(storage.get(STORAGE_KEYS.discoverPrefs), null);
      if (!parsed || typeof parsed !== "object") return { onlyUnsaved: true, intent: "" };
      return {
        onlyUnsaved: parsed.onlyUnsaved !== false,
        intent: String(parsed.intent || ""),
      };
    };
    const writePrefs = (prefs) => storage.set(STORAGE_KEYS.discoverPrefs, JSON.stringify(prefs));

    let prefs = readPrefs();
    if (onlyUnsavedEl) onlyUnsavedEl.checked = Boolean(prefs.onlyUnsaved);

    const mergeWeights = (base, extra) => {
      const next = { ...(base || {}) };
      Object.entries(extra || {}).forEach(([k, v]) => {
        next[k] = (Number(next[k] || 0) || 0) + (Number(v) || 0);
      });
      return next;
    };

    const topTags = (weights) =>
      Object.entries(weights || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 14)
        .map(([t]) => t);

    const scoreByTags = (weights, tags) => {
      let score = 0;
      normalizeTagList(tags).forEach((t) => {
        score += Number(weights?.[String(t)] || 0) || 0;
      });
      return score;
    };

    const computeRecommendations = (weights, { onlyUnsaved }) => {
      const savedGames = new Set(readStringList(STORAGE_KEYS.savedGames));
      const savedGuides = new Set(readStringList(STORAGE_KEYS.savedGuides));

      const guides = Object.entries(data.guides || {})
        .map(([id, g]) => {
          const tags = Array.isArray(g?.tags) ? g.tags : [];
          const gameTags = g?.gameId && data.games?.[g.gameId]?.tags ? data.games[g.gameId].tags : [];
          const combined = [...tags, ...gameTags];
          const base = scoreByTags(weights, combined);
          const recency = parseDateKey(g?.updated) / 100000000;
          return { id, guide: g, score: base + recency };
        })
        .filter((x) => x.score > 0.01)
        .filter((x) => (onlyUnsaved ? !savedGuides.has(x.id) : true))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);

      const games = Object.entries(data.games || {})
        .map(([id, g]) => {
          const tags = Array.isArray(g?.tags) ? g.tags : [];
          const base = scoreByTags(weights, tags);
          const rating = (Number(g?.rating || 0) || 0) / 10;
          const recency = parseDateKey(g?.updated) / 100000000;
          return { id, game: g, score: base + rating + recency };
        })
        .filter((x) => x.score > 0.01)
        .filter((x) => (onlyUnsaved ? !savedGames.has(x.id) : true))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);

      return { guides, games };
    };

    const renderTagChips = (tags) => {
      if (!tagsEl) return;
      tagsEl.innerHTML = (tags || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    };

    const renderIntentChips = () => {
      if (!intentsEl) return;
      const current = String(prefs.intent || "");
      const base = `
        <button type="button" class="chip chip-btn ${current ? "" : "active"}" data-intent="">
          不限
        </button>
      `;
      intentsEl.innerHTML =
        base +
        INTENT_PRESETS.map((preset) => {
          const active = current === preset.id ? "active" : "";
          return `<button type="button" class="chip chip-btn ${active}" data-intent="${escapeHtml(preset.id)}">${escapeHtml(
            preset.label
          )}</button>`;
        }).join("");
    };

    const renderRecs = (recs) => {
      const savedGuides = new Set(readStringList(STORAGE_KEYS.savedGuides));
      const savedGames = new Set(readStringList(STORAGE_KEYS.savedGames));

      if (guidesEl) {
        guidesEl.innerHTML = recs.guides
          .map(({ id, guide }) => {
            const title = String(guide?.title || `攻略：${id}`);
            const icon = guide?.icon || "images/icons/guide-icon.svg";
            const updated = guide?.updated ? `更新 ${formatDate(guide.updated)}` : "更新待补";
            const rt = Number(guide?.readingTime || 0) || 0;
            const saved = savedGuides.has(id);
            const href = `guide-detail.html?id=${encodeURIComponent(id)}`;
            return `
              <div class="mini-card mini-card-action" data-type="guide" data-id="${escapeHtml(id)}">
                <a class="mini-card-main" href="${href}">
                  <img src="${icon}" alt="${escapeHtml(title)}" loading="lazy">
                  <div class="mini-card-body">
                    <div class="mini-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                    <div class="mini-card-desc">${escapeHtml(`${updated} · ${guide?.difficulty || "通用"}${rt ? ` · ${rt} 分钟` : ""}`)}</div>
                  </div>
                </a>
                <div class="mini-card-actions">
                  <button type="button" class="btn btn-small" data-action="discover-add">加入路线</button>
                  <button type="button" class="btn btn-small btn-secondary" data-action="discover-save">${saved ? "已收藏" : "收藏"}</button>
                </div>
              </div>
            `;
          })
          .join("");
      }

      if (gamesEl) {
        gamesEl.innerHTML = recs.games
          .map(({ id, game }) => {
            const title = String(game?.title || `游戏：${id}`);
            const icon = game?.icon || "images/icons/game-icon.svg";
            const updated = game?.updated ? `更新 ${formatDate(game.updated)}` : "更新待补";
            const saved = savedGames.has(id);
            const href = `game.html?id=${encodeURIComponent(id)}`;
            const rating = Number(game?.rating || 0) || 0;
            return `
              <div class="mini-card mini-card-action" data-type="game" data-id="${escapeHtml(id)}">
                <a class="mini-card-main" href="${href}">
                  <img src="${icon}" alt="${escapeHtml(title)}" loading="lazy">
                  <div class="mini-card-body">
                    <div class="mini-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                    <div class="mini-card-desc">${escapeHtml(`${updated} · ${game?.genre || "类型待补"} · 评分 ${rating || "—"}`)}</div>
                  </div>
                </a>
                <div class="mini-card-actions">
                  <button type="button" class="btn btn-small" data-action="discover-add">加入路线</button>
                  <button type="button" class="btn btn-small btn-secondary" data-action="discover-save">${saved ? "已收藏" : "收藏"}</button>
                </div>
              </div>
            `;
          })
          .join("");
      }
    };

    let lastRecs = { guides: [], games: [] };

    const render = () => {
      const baseWeights = buildInterestWeights(data);
      const intentWeights = computeIntentWeights(prefs.intent);
      const weights = mergeWeights(baseWeights, intentWeights);
      const tags = topTags(weights);
      renderIntentChips();
      if (tags.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        if (tagsEl) tagsEl.innerHTML = "";
        if (dnaEl) dnaEl.innerHTML = "";
        if (dnaTagsEl) dnaTagsEl.innerHTML = "";
        if (guidesEl) guidesEl.innerHTML = "";
        if (gamesEl) gamesEl.innerHTML = "";
        lastRecs = { guides: [], games: [] };
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      renderTagChips(tags);
      const dna = computePlaystyleDna(weights);
      renderDnaBars(dnaEl, dna.bars);
      renderChipList(dnaTagsEl, dna.topTags, "暂无画像数据");
      lastRecs = computeRecommendations(weights, { onlyUnsaved: Boolean(prefs.onlyUnsaved) });
      renderRecs(lastRecs);
    };

    const handleAction = (btn) => {
      const card = btn.closest?.(".mini-card-action");
      if (!card) return;
      const type = String(card.dataset.type || "");
      const id = String(card.dataset.id || "");
      if (!id || (type !== "guide" && type !== "game")) return;

      if (btn.dataset.action === "discover-add") {
        const added = addItemToCurrentPlan({ type, id });
        if (!added.ok) {
          toast({ title: "添加失败", message: "无法写入本地路线数据。", tone: "warn" });
          return;
        }
        toast({
          title: added.added ? "已加入路线" : "已在路线中",
          message: "你可以在“路线规划”中拖拽排序与分享。",
          tone: added.added ? "success" : "info",
        });
        return;
      }

      if (btn.dataset.action === "discover-save") {
        if (type === "guide") {
          const set = new Set(readStringList(STORAGE_KEYS.savedGuides));
          const saved = set.has(id);
          if (saved) set.delete(id);
          else set.add(id);
          writeStringList(STORAGE_KEYS.savedGuides, Array.from(set));
          btn.textContent = saved ? "收藏" : "已收藏";
          toast({ title: saved ? "已取消收藏" : "已收藏", message: "已保存到本地浏览器。", tone: saved ? "info" : "success" });
          return;
        }
        if (type === "game") {
          const set = new Set(readStringList(STORAGE_KEYS.savedGames));
          const saved = set.has(id);
          if (saved) set.delete(id);
          else set.add(id);
          writeStringList(STORAGE_KEYS.savedGames, Array.from(set));
          btn.textContent = saved ? "收藏" : "已收藏";
          toast({ title: saved ? "已取消收藏" : "已收藏", message: "已保存到本地浏览器。", tone: saved ? "info" : "success" });
        }
      }
    };

    guidesEl?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-action]");
      if (!btn) return;
      handleAction(btn);
    });
    gamesEl?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-action]");
      if (!btn) return;
      handleAction(btn);
    });

    refreshBtn?.addEventListener("click", render);
    intentsEl?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-intent]");
      if (!btn || !intentsEl.contains(btn)) return;
      const intent = String(btn.dataset.intent || "");
      prefs = { ...prefs, intent };
      writePrefs(prefs);
      render();
    });
    onlyUnsavedEl?.addEventListener("change", () => {
      prefs = { ...prefs, onlyUnsaved: Boolean(onlyUnsavedEl.checked) };
      writePrefs(prefs);
      render();
    });

    buildPlanBtn?.addEventListener("click", () => {
      const items = [
        ...lastRecs.games.slice(0, 3).map((x) => ({ type: "game", id: x.id })),
        ...lastRecs.guides.slice(0, 8).map((x) => ({ type: "guide", id: x.id })),
      ];
      if (items.length === 0) {
        toast({ title: "暂无可用推荐", message: "先收藏或标记在玩的游戏，再来试试。", tone: "info" });
        return;
      }
      const name = `推荐路线 · ${new Date().toLocaleDateString("zh-CN")}`;
      const created = createPlanFromItems(name, items);
      toast({ title: "路线已生成", message: "已创建新路线，正在为你打开路线规划。", tone: "success" });
      window.setTimeout(() => {
        window.location.href = `planner.html?open=${encodeURIComponent(created.id)}`;
      }, 120);
    });

    render();
  };

  // -------------------------
  // Community Page
  // -------------------------

  const initCommunityPage = () => {
    if (getPage() !== "community") return;

    const data = getData();
    const topics = data?.topics;
    const grid = $("#community-topics");
    const trendsEl = $("#community-trends");
    const profileEl = $("#community-profile");
    if (!topics || !grid) return;

    const searchInput = $("#community-search");
    const searchBtn = $("#community-search-btn");
    const tagRoot = $("#community-tags");
    const sortSelect = $("#community-sort");
    const countEl = $("#community-count");
    const empty = $("#community-topics-empty");
    const clearBtn = $("#community-clear");

    const items = Object.entries(topics).map(([id, topic]) => {
      const tags = Array.isArray(topic?.tags) ? topic.tags.map(String) : [];
      const category = topic?.category ? [String(topic.category)] : [];
      const tagList = [...tags, ...category].filter(Boolean);
      const blob = `${String(topic?.title || id)} ${String(topic?.summary || "")} ${String(
        topic?.starter || ""
      )} ${tagList.join(" ")}`.toLowerCase();
      return { id, topic, tagList, blob };
    });
    const allTags = Array.from(new Set(items.flatMap((x) => x.tagList)))
      .slice(0, 18)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    const heatScores = new Map(items.map(({ id, topic }) => [id, computeTopicHeat(topic)]));

    const renderTrends = () => {
      if (!trendsEl) return;
      const ranked = [...items]
        .sort((a, b) => (heatScores.get(b.id) || 0) - (heatScores.get(a.id) || 0))
        .slice(0, 3);
      if (ranked.length === 0) {
        trendsEl.innerHTML = '<div class="empty-state small"><p class="empty-title">暂无热度数据</p></div>';
        return;
      }
      trendsEl.innerHTML = ranked
        .map(({ id, topic }) => {
          const heat = Math.round(heatScores.get(id) || 0);
          const title = topic?.title || id;
          return `
            <div class="trend-item">
              <div class="trend-head">
                <span class="trend-title">${escapeHtml(title)}</span>
                <span class="trend-score">${heat}</span>
              </div>
              <div class="trend-track">
                <span class="trend-fill" style="width:${clampNumber(heat, 0, 100)}%"></span>
              </div>
            </div>
          `;
        })
        .join("");
    };

    const renderProfile = () => {
      if (!profileEl) return;
      const categoryMap = {};
      items.forEach(({ topic }) => {
        const cat = String(topic?.category || "综合");
        categoryMap[cat] = (Number(categoryMap[cat] || 0) || 0) + 1;
      });
      const topCats = Object.entries(categoryMap)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 4)
        .map(([label, count]) => ({ label, value: `${count} 个` }));
      renderMetaList(profileEl, topCats, "暂无分类统计");
    };

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
        const params = getSearchParams();
        if (!params) return { reset: false, query: "", tags: [], savedOnly: false, sort: "" };

        const reset = readSearchBool(params, "reset", { truthy: ["1"] });
        const query = readSearchString(params, ["q", "query"]);
        const tags = readSearchList(params, ["tag", "tags"]);
        const savedOnly = readSearchBool(params, ["saved", "savedOnly"], { truthy: ["1", "true"] });
        const sort = readSearchString(params, "sort");
        return { reset, query, tags, savedOnly, sort };
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
      const heat = Math.round(heatScores.get(id) || 0);
      const heatBadge =
        heat >= 75 ? '<span class="badge heat hot">高热</span>' : heat >= 45 ? '<span class="badge heat warm">热度</span>' : "";
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
          <div class="topic-badges">${updateBadge}${hotBadge}${heatBadge}${categoryBadge}</div>
          </div>
          <h3 class="topic-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
          <p class="topic-summary">${escapeHtml(summary)}</p>
          ${tagList ? `<div class="topic-tags">${tagList}</div>` : ""}
          <div class="topic-stats">
            <span>发起人：${escapeHtml(starter)}</span>
            <span>回复：${Number.isFinite(replies) ? replies : 0}</span>
            <span>热度：${heat}</span>
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
      animateSavePill(btn, !had);
      btn.closest?.(".topic-card")?.classList.toggle("is-saved", !had);
    });

    const urlFlags = (() => {
      const params = getSearchParams();
      return {
        forceVirtual: readSearchBool(params, ["virtual", "vlist"], { truthy: ["1", "true"] }),
      };
    })();

    let vlist = null;
    const ensureVlist = () => {
      if (vlist) return vlist;
      vlist = createVirtualList(grid, { rowHeight: VLIST.topicsRowHeight });
      return vlist;
    };
    const teardownVlist = () => {
      if (!vlist) return;
      vlist.destroy();
      vlist = null;
    };

    const apply = () => {
      const q = (state.query || "").trim().toLowerCase();
      const tagSet = new Set(state.tags);

      const filtered = items.filter(({ id, blob, tagList }) => {
        const okQuery = !q || blob.includes(q);
        const okTags = tagSet.size === 0 || tagList.some((t) => tagSet.has(String(t)));
        const okSaved = !state.savedOnly || saved.has(id);
        return okQuery && okTags && okSaved;
      });

      const sorted = [...filtered];
      const sortKey = state.sort || "latest";
      sorted.sort((a, b) => {
        if (sortKey === "replies-desc") return Number(b.topic?.replies || 0) - Number(a.topic?.replies || 0);
        if (sortKey === "replies-asc") return Number(a.topic?.replies || 0) - Number(b.topic?.replies || 0);
        if (sortKey === "heat") return (heatScores.get(b.id) || 0) - (heatScores.get(a.id) || 0);
        if (sortKey === "title") {
          return String(a.topic?.title || a.id).localeCompare(String(b.topic?.title || b.id), "zh-Hans-CN");
        }
        return parseDateKey(b.topic?.updated) - parseDateKey(a.topic?.updated);
      });

      const shouldVirtualize =
        urlFlags.forceVirtual || (sorted.length >= VLIST.enableThreshold && !prefersReducedMotion());

      if (sorted.length === 0) {
        teardownVlist();
        withViewTransition(() => {
          grid.innerHTML = "";
          if (countEl) countEl.textContent = "共 0 个话题";
          if (empty) empty.hidden = false;
        });
        syncUrl();
        return;
      }

      if (shouldVirtualize) {
        const renderer = (el, payload) => {
          const id = payload.id;
          const topic = payload.topic || {};

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
          const heat = Math.round(heatScores.get(id) || 0);
          const heatBadge =
            heat >= 75 ? '<span class="badge heat hot">高热</span>' : heat >= 45 ? '<span class="badge heat warm">热度</span>' : "";
          const categoryBadge = topic.category ? `<span class="badge subtle">${escapeHtml(topic.category)}</span>` : "";
          const updateBadge = renderUpdateBadge(status);
          const tagList = [...category, ...tags]
            .filter(Boolean)
            .slice(0, 3)
            .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
            .join("");

          el.className = `vlist-row vlist-row-topic${isSaved ? " is-saved" : ""}`;
          el.innerHTML = `
            <div class="vlist-row-inner">
              <div class="vlist-main">
                <div class="vlist-title">
                  <span class="vlist-title-text">${escapeHtml(title)}</span>
                  <span class="vlist-badges">${updateBadge}${hotBadge}${heatBadge}${categoryBadge}</span>
                </div>
                <div class="vlist-desc">${escapeHtml(summary)}</div>
                ${tagList ? `<div class="vlist-tags">${tagList}</div>` : ""}
                <div class="vlist-meta">
                  <span class="meta-pill small">发起人 ${escapeHtml(starter)}</span>
                  <span class="meta-pill small">回复 ${Number.isFinite(replies) ? replies : 0}</span>
                  <span class="meta-pill small">热度 ${heat}</span>
                  <span class="meta-pill small">更新 ${escapeHtml(updated)}</span>
                </div>
              </div>
              <div class="vlist-actions">
                <a class="btn btn-small" href="forum-topic.html?id=${encodeURIComponent(id)}">加入讨论</a>
                <button type="button" class="save-pill ${isSaved ? "active" : ""}" data-topic-id="${escapeHtml(id)}" aria-pressed="${isSaved ? "true" : "false"}" aria-label="${escapeHtml(saveLabel)}">
                  <span class="save-star" aria-hidden="true">${saveStar}</span>
                  <span class="save-text">${escapeHtml(saveLabel)}</span>
                </button>
              </div>
            </div>
          `;
        };

        const list = ensureVlist();
        list.setItems(
          sorted.map(({ id, topic }) => ({
            key: String(id),
            data: { id, topic },
            render: renderer,
          }))
        );

        if (countEl) countEl.textContent = `共 ${sorted.length} 个话题（虚拟列表）`;
        if (empty) empty.hidden = true;
        syncUrl();
        return;
      }

      teardownVlist();
      withViewTransition(() => {
        grid.innerHTML = sorted.map(({ id, topic }) => renderCard(id, topic)).join("");
        if (countEl) countEl.textContent = `共 ${sorted.length} 个话题`;
        if (empty) empty.hidden = true;
      });
      syncUrl();
    };

    // 跨标签页同步：避免“每次筛选都读 localStorage”带来的同步卡顿
    window.addEventListener("storage", (e) => {
      if (!e) return;
      if (e.storageArea !== localStorage) return;
      if (e.key !== STORAGE_KEYS.savedTopics && e.key !== null) return;
      saved = new Set(readStringList(STORAGE_KEYS.savedTopics));
      apply();
    });

    if (searchInput) searchInput.value = state.query || "";
    if (sortSelect) {
      const options = new Set($$("option", sortSelect).map((opt) => opt.value).filter(Boolean));
      if (!options.has(state.sort)) state.sort = "latest";
      sortSelect.value = state.sort || "latest";
    }

    renderTags();
    renderTrends();
    renderProfile();
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
  // Docs Portal（交互式文档入口）
  // -------------------------

  const initDocsPortalPage = () => {
    const nav = $("#docs-nav");
    const content = $("#docs-content");
    const titleEl = $("#docs-title");
    const hintEl = $("#docs-hint");
    if (!nav || !content) return;

    const DOCS_UI = {
      hashScrollDelayMs: 40,
    };

    const DOCS = [
      { id: "STYLE_GUIDE", title: "风格与规范", file: "docs/STYLE_GUIDE.md" },
      { id: "DATA_MODEL", title: "数据模型", file: "docs/DATA_MODEL.md" },
      { id: "CONTRIBUTING", title: "贡献指南", file: "docs/CONTRIBUTING.md" },
      { id: "SECURITY", title: "安全策略", file: "docs/SECURITY.md" },
      { id: "CODE_OF_CONDUCT", title: "行为准则", file: "docs/CODE_OF_CONDUCT.md" },
      { id: "DEPLOYMENT", title: "部署与发布", file: "docs/DEPLOYMENT.md" },
    ];

    const normalizeDocId = (value) => {
      const raw = String(value || "")
        .trim()
        .replace(/\.md$/i, "")
        .replace(/[^\w-]/g, "_")
        .toUpperCase();
      if (!raw) return "";
      return raw;
    };

    const pickDoc = (raw) => {
      const id = normalizeDocId(raw);
      const hit = DOCS.find((d) => d.id === id);
      return hit || DOCS[0];
    };

    const slugify = (text) => {
      const raw = String(text || "").trim().toLowerCase();
      const s = raw
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      return s || "section";
    };

    const sanitizeHref = (href) => {
      const raw = String(href || "").trim();
      if (!raw) return null;
      if (raw.startsWith("//")) return null;

      const lower = raw.toLowerCase();
      if (lower.startsWith("javascript:")) return null;
      if (lower.startsWith("data:")) return null;
      if (lower.startsWith("vbscript:")) return null;
      if (lower.startsWith("file:")) return null;
      if (raw.startsWith("#")) return raw;
      if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return raw;
      return raw;
    };

    const renderInline = (text) => {
      const s = String(text || "");
      const out = [];
      let i = 0;
      while (i < s.length) {
        const ch = s[i];
        if (ch === "`") {
          const end = s.indexOf("`", i + 1);
          if (end > i) {
            const code = s.slice(i + 1, end);
            out.push(`<code>${escapeHtml(code)}</code>`);
            i = end + 1;
            continue;
          }
        }

        if (ch === "[") {
          const close = s.indexOf("]", i + 1);
          if (close > i && s[close + 1] === "(") {
            const end = s.indexOf(")", close + 2);
            if (end > close) {
              const label = s.slice(i + 1, close);
              const href = sanitizeHref(s.slice(close + 2, end));
              if (href) {
                out.push(
                  `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
                );
              } else {
                out.push(escapeHtml(label));
              }
              i = end + 1;
              continue;
            }
          }
        }

        // 普通文本：尽量批量推进
        const nextSpecial = (() => {
          const nextTick = s.indexOf("`", i + 1);
          const nextBracket = s.indexOf("[", i + 1);
          const candidates = [nextTick, nextBracket].filter((x) => x >= 0);
          return candidates.length > 0 ? Math.min(...candidates) : -1;
        })();

        const sliceEnd = nextSpecial >= 0 ? nextSpecial : s.length;
        out.push(escapeHtml(s.slice(i, sliceEnd)));
        i = sliceEnd;
      }
      return out.join("");
    };

    const renderMarkdown = (md) => {
      const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
      const html = [];

      let inCode = false;
      let codeLang = "";
      let codeBuf = [];

      let inUl = false;
      let inOl = false;

      const closeLists = () => {
        if (inUl) html.push("</ul>");
        if (inOl) html.push("</ol>");
        inUl = false;
        inOl = false;
      };

      const openUl = () => {
        if (!inUl) html.push("<ul>");
        inUl = true;
      };

      const openOl = () => {
        if (!inOl) html.push("<ol>");
        inOl = true;
      };

      const flushCode = () => {
        if (!inCode) return;
        const lang = String(codeLang || "").trim().toLowerCase();
        const klass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        html.push(`<pre><code${klass}>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeBuf = [];
      };

      for (const line of lines) {
        const raw = String(line || "");

        const fence = raw.match(/^```(.*)$/);
        if (fence) {
          if (inCode) {
            flushCode();
          } else {
            closeLists();
            inCode = true;
            codeLang = String(fence[1] || "").trim();
            codeBuf = [];
          }
          continue;
        }

        if (inCode) {
          codeBuf.push(raw);
          continue;
        }

        const trimmed = raw.trim();
        if (!trimmed) {
          closeLists();
          continue;
        }

        const h = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (h) {
          closeLists();
          const level = Math.min(4, h[1].length);
          const text = String(h[2] || "").trim();
          const id = slugify(text);
          html.push(`<h${level} id="${escapeHtml(id)}">${renderInline(text)}</h${level}>`);
          continue;
        }

        const ul = trimmed.match(/^[-*]\s+(.+)$/);
        if (ul) {
          if (inOl) closeLists();
          openUl();
          html.push(`<li>${renderInline(ul[1])}</li>`);
          continue;
        }

        const ol = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (ol) {
          if (inUl) closeLists();
          openOl();
          html.push(`<li>${renderInline(ol[2])}</li>`);
          continue;
        }

        closeLists();
        if (trimmed.startsWith(">")) {
          const q = trimmed.replace(/^>\s?/, "");
          html.push(`<blockquote><p>${renderInline(q)}</p></blockquote>`);
          continue;
        }

        html.push(`<p>${renderInline(trimmed)}</p>`);
      }

      flushCode();
      closeLists();

      return html.join("\n");
    };

    const renderNav = (activeId) => {
      nav.innerHTML = DOCS.map((d) => {
        const active = d.id === activeId;
        const aria = active ? ' aria-current="page"' : "";
        return `<a class="docs-nav-link${active ? " active" : ""}" href="docs.html?doc=${encodeURIComponent(
          d.id
        )}" data-doc="${escapeHtml(d.id)}"${aria}>${escapeHtml(d.title)}</a>`;
      }).join("");
    };

    const load = async (doc) => {
      renderNav(doc.id);
      if (titleEl) titleEl.textContent = doc.title;
      if (hintEl) hintEl.textContent = `来源：${doc.file}`;

      telemetry.log("docs_open", { doc: doc.id });

      try {
        content.setAttribute("aria-busy", "true");
      } catch (_) {}

      content.innerHTML = `
        <div class="docs-loading" role="status" aria-live="polite">
          <div class="ink-loader">
            <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <path class="ink-path" d="M10 36c10-18 22-26 34-24c8 1 12 8 10 16c-2 10-12 18-26 18c-10 0-18-4-18-10z"/>
            </svg>
            <div class="ink-loader-body" aria-hidden="true">
              <div class="skeleton-stack">
                <div class="skeleton skeleton-line lg"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line sm"></div>
              </div>
            </div>
          </div>
          <p>正在加载文档…（高延迟网络下会优先使用缓存并后台刷新）</p>
        </div>
      `;

      const v = detectAssetVersion() || String(getData()?.version || "") || "";
      const url = v ? `${doc.file}?v=${encodeURIComponent(v)}` : doc.file;

      try {
        const md = await netClient.requestText(url);
        content.innerHTML = renderMarkdown(md);

        // hash 锚点滚动（如 docs.html?doc=...#section-id）
        const hash = String(window.location.hash || "").replace(/^#/, "");
        if (hash) {
          window.setTimeout(() => {
            const target = document.getElementById(hash);
            target?.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
          }, DOCS_UI.hashScrollDelayMs);
        }
      } catch (_) {
        telemetry.log("docs_error", { doc: doc.id });
        content.innerHTML =
          '<div class="docs-error"><h2>文档加载失败</h2><p>可能处于离线状态或网络较差。你仍可访问已缓存的页面，或稍后重试。</p></div>';
      } finally {
        try {
          content.removeAttribute("aria-busy");
        } catch (_) {}
      }
    };

    const params = getSearchParams();
    const initial = readSearchString(params, ["doc", "d"]);
    let current = pickDoc(initial);

    renderNav(current.id);
    load(current);

    nav.addEventListener("click", (e) => {
      const a = e.target?.closest?.("a[data-doc]");
      if (!a) return;
      e.preventDefault();

      const next = pickDoc(a.dataset.doc || "");
      if (!next || next.id === current.id) return;
      current = next;

      try {
        const url = new URL(window.location.href);
        url.searchParams.set("doc", next.id);
        url.hash = "";
        window.history.pushState({ doc: next.id }, "", url.toString());
      } catch (_) {}

      load(next);
    });

    window.addEventListener("popstate", () => {
      const p = getSearchParams();
      const raw = readSearchString(p, ["doc", "d"]);
      const next = pickDoc(raw);
      if (!next || next.id === current.id) return;
      current = next;
      load(next);
    });
  };

  // -------------------------
  // Boot
  // -------------------------

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.add("js");
    try {
      const id = String(getParam("id") || "").trim();
      telemetry.log("page_view", { id: id ? id.slice(0, 48) : "", hasId: Boolean(id) });
    } catch (_) {}

    const run = (fn) => {
      try {
        fn();
      } catch (err) {
        diagnostics.captureError(err, { kind: "handled", source: "boot.run" });
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
    const critical = [
      initNetworkStateLoop,
      initErrorBoundary,
      initThemeToggle,
      initContrast,
      seedUpdateRadarIfNeeded,
      initCommandPalette,
      initHeaderQuickLinks,
      initNavigation,
      initSoftNavigation,
      initMicroInteractions,
      initLinkPrefetch,
      initBackToTop,
      initCopyLinkButtons,
      initPwaInstall,
      initConnectivityToasts,
      initServiceWorkerMessaging,
    ];
    critical.forEach(run);

    // 页面逻辑：按 data-page 精确调度（避免无意义的 init 调用）
    const page = getPage();
    const pageInits = {
      "all-games": initAllGamesPage,
      "all-guides": initAllGuidesPage,
      guide: initGuideDetailPage,
      game: initGamePage,
      dashboard: initDashboardPage,
      updates: initUpdatesPage,
      planner: initPlannerPage,
      discover: initDiscoverPage,
      community: initCommunityPage,
      forum: initForumTopicPage,
      docs: initDocsPortalPage,
    };
    const pageInit = pageInits[String(page || "")];
    if (typeof pageInit === "function") run(pageInit);

    // 视觉增强项（可延后）
    run(initPageLoaded);
    run(initScrollReveal);
    if (page === "home") {
      run(initHeroStats);
      run(initHomeRecent);
      run(initNewsletterForms);
    }
    runIdle(initParticles, { timeout: 1200 });
    runIdle(initServiceWorker, { timeout: 1500 });
  });
})();
