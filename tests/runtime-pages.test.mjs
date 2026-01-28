import test from "node:test";
import assert from "node:assert/strict";

import { resolvePageInit, runPageInit } from "../src/runtime/pages/registry.mjs";

const createDeps = (names, calls) => {
  const deps = {};
  names.forEach((name) => {
    deps[name] = () => calls.push(name);
  });
  return deps;
};

test("resolvePageInit：未知 page 应返回 null", () => {
  assert.equal(resolvePageInit("", {}), null);
  assert.equal(resolvePageInit("unknown", {}), null);
});

test("runPageInit：命中应执行且不命中不执行", () => {
  const calls = [];
  const deps = createDeps(["initAllGamesPage"], calls);
  assert.equal(runPageInit("unknown", deps), false);
  assert.equal(calls.length, 0);

  assert.equal(runPageInit("all-games", deps), true);
  assert.deepEqual(calls, ["initAllGamesPage"]);
});

test("resolvePageInit：应按 data-page 精确调度（避免无关 init）", () => {
  const cases = [
    {
      page: "home",
      expected: ["initHeroStats", "initHomeRecent", "initNewsletterForms"],
    },
    { page: "all-games", expected: ["initAllGamesPage"] },
    { page: "all-guides", expected: ["initAllGuidesPage"] },
    { page: "guide", expected: ["initGuideDetailPage"] },
    { page: "game", expected: ["initGamePage"] },
    { page: "dashboard", expected: ["initDashboardPage"] },
    { page: "updates", expected: ["initUpdatesPage"] },
    { page: "planner", expected: ["initPlannerPage"] },
    { page: "discover", expected: ["initDiscoverPage"] },
    { page: "community", expected: ["initCommunityPage"] },
    { page: "forum", expected: ["initForumTopicPage"] },
    { page: "docs", expected: ["initDocsPortalPage"] },
  ];

  const allNames = Array.from(
    new Set(
      cases
        .flatMap((c) => c.expected)
        .concat([
          "initHeroStats",
          "initHomeRecent",
          "initNewsletterForms",
          "initAllGamesPage",
          "initAllGuidesPage",
          "initGuideDetailPage",
          "initGamePage",
          "initDashboardPage",
          "initUpdatesPage",
          "initPlannerPage",
          "initDiscoverPage",
          "initCommunityPage",
          "initForumTopicPage",
          "initDocsPortalPage",
        ])
    )
  );

  for (const c of cases) {
    const calls = [];
    const deps = createDeps(allNames, calls);
    const fn = resolvePageInit(c.page, deps);
    assert.equal(typeof fn, "function");
    fn();
    assert.deepEqual(calls, c.expected);
  }
});

