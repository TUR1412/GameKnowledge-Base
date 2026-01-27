export const STORAGE_KEYS = {
  theme: "gkb-theme",
  contrast: "gkb-contrast",
  accent: "gkb-accent",
  density: "gkb-density",
  motion: "gkb-motion",
  transparency: "gkb-transparency",
  particles: "gkb-particles",
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

export const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

export const createStorage = (backend) => {
  return {
    get(key) {
      try {
        return backend.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        backend.setItem(key, value);
        return true;
      } catch (_) {
        return false;
      }
    },
    remove(key) {
      try {
        backend.removeItem(key);
        return true;
      } catch (_) {
        return false;
      }
    },
  };
};

export const readStringList = (storage, key) => {
  const list = safeJsonParse(storage.get(key), []);
  if (!Array.isArray(list)) return [];
  return list.map((x) => String(x || "").trim()).filter(Boolean);
};

export const writeStringList = (storage, key, list) => {
  const next = Array.from(new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter(Boolean)));
  storage.set(key, JSON.stringify(next));
  return next;
};

