/* 游戏攻略网 - 启动脚本（尽可能早执行）
 *
 * 目标：
 * 1) 在 CSS 加载前确定主题，减少闪烁
 * 2) JS 可用时移除 .no-js（保证内容默认可见）
 */

(() => {
  "use strict";

  const THEME_KEY = "gkb-theme";
  const CONTRAST_KEY = "gkb-contrast";
  const VT_KEY = "gkb-vt";
  const root = document.documentElement;

  const readStoredTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (_) {
      return null;
    }
  };

  const getSystemTheme = () => {
    try {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    } catch (_) {
      return "light";
    }
  };

  const stored = readStoredTheme();
  const theme = stored === "light" || stored === "dark" ? stored : getSystemTheme();

  const readStoredContrast = () => {
    try {
      return localStorage.getItem(CONTRAST_KEY);
    } catch (_) {
      return null;
    }
  };

  const contrast = readStoredContrast();
  if (contrast === "high") root.dataset.contrast = "high";

  const syncThemeColor = (next) => {
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) return;
      // 尽量贴近页面背景，避免浏览器 UI（地址栏/状态栏）在深色主题下刺眼
      meta.setAttribute("content", next === "dark" ? "#0b0f14" : "#f6f1ea");
    } catch (_) {}
  };

  root.dataset.theme = theme;
  root.classList.remove("no-js");
  syncThemeColor(theme);

  // View Transition（跨文档共享元素）：为新页面首帧提前打标
  // 说明：必须在渲染前尽早写入 dataset，确保 CSS 选择器能在快照捕获前生效。
  try {
    const raw = sessionStorage.getItem(VT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const kind = String(parsed?.kind || "").trim();
      const id = String(parsed?.id || "").trim();
      const ts = Number(parsed?.ts || 0);

      const now = Date.now();
      const fresh = Number.isFinite(ts) && Math.abs(now - ts) <= 15000;
      const okKind = kind === "game" || kind === "guide";

      if (fresh && okKind && id) {
        root.dataset.vtKind = kind;
        root.dataset.vtId = id;
      }
    }
  } catch (_) {
    // sessionStorage/JSON 可能不可用（隐私模式/禁用），忽略即可。
  } finally {
    try {
      sessionStorage.removeItem(VT_KEY);
    } catch (_) {}
  }
})();
