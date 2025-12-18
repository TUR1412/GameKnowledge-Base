/* 游戏攻略网 - 启动脚本（尽可能早执行）
 *
 * 目标：
 * 1) 在 CSS 加载前确定主题，减少闪烁
 * 2) JS 可用时移除 .no-js（保证内容默认可见）
 */

(() => {
  "use strict";

  const THEME_KEY = "gkb-theme";
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

  root.dataset.theme = theme;
  root.classList.remove("no-js");
})();

