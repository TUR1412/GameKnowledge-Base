export const PAGE_KEYS = [
  "home",
  "all-games",
  "all-guides",
  "guide",
  "game",
  "dashboard",
  "updates",
  "planner",
  "discover",
  "community",
  "forum",
  "docs",
];

/**
 * 创建页面级 init 路由表（按 data-page 精确调度）。
 *
 * 说明：
 * - 该模块是“结构化入口”，不关心具体实现细节；实现由 deps 注入（便于单测与逐步迁移）。
 * - 目标是确保任意页面只初始化自己需要的逻辑，避免脚本巨石化后出现“全站无差别 init”的隐性成本。
 *
 * @param {Record<string, Function>} deps init 依赖注入
 * @returns {Record<string, Function>} page->init 映射
 */
export const createPageInits = (deps = {}) => {
  const safe = (fn) => (typeof fn === "function" ? fn : null);

  const inits = {
    home: () => {
      safe(deps.initHeroStats)?.();
      safe(deps.initHomeRecent)?.();
      safe(deps.initNewsletterForms)?.();
    },
    "all-games": () => safe(deps.initAllGamesPage)?.(),
    "all-guides": () => safe(deps.initAllGuidesPage)?.(),
    guide: () => safe(deps.initGuideDetailPage)?.(),
    game: () => safe(deps.initGamePage)?.(),
    dashboard: () => safe(deps.initDashboardPage)?.(),
    updates: () => safe(deps.initUpdatesPage)?.(),
    planner: () => safe(deps.initPlannerPage)?.(),
    discover: () => safe(deps.initDiscoverPage)?.(),
    community: () => safe(deps.initCommunityPage)?.(),
    forum: () => safe(deps.initForumTopicPage)?.(),
    docs: () => safe(deps.initDocsPortalPage)?.(),
  };

  return inits;
};

/**
 * 根据 data-page 选择对应 init（未知页面返回 null）。
 *
 * @param {string} page data-page 值
 * @param {Record<string, Function>} deps init 依赖注入
 * @returns {Function|null} page init
 */
export const resolvePageInit = (page, deps = {}) => {
  const key = String(page || "").trim();
  if (!key) return null;
  const inits = createPageInits(deps);
  const fn = inits[key];
  return typeof fn === "function" ? fn : null;
};

/**
 * 执行页面 init（返回是否命中）。
 *
 * @param {string} page data-page 值
 * @param {Record<string, Function>} deps init 依赖注入
 * @returns {boolean} 是否命中并执行
 */
export const runPageInit = (page, deps = {}) => {
  const fn = resolvePageInit(page, deps);
  if (!fn) return false;
  fn();
  return true;
};

