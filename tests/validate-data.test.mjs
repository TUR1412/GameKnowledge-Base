import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isDateString, loadDataFromDataJs, main, validateData, validateTags } from "../tools/validate-data.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL_VALIDATE_DATA = path.join(REPO_ROOT, "tools", "validate-data.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-validate-data-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("isDateString：仅接受 YYYY-MM-DD", () => {
  assert.equal(isDateString("2025-12-21"), true);
  assert.equal(isDateString("2025-1-01"), false);
  assert.equal(isDateString("2025/12/21"), false);
  assert.equal(isDateString(""), false);
});

test("validateTags：tags 必须是非空字符串数组（或缺省）", () => {
  assert.deepEqual(validateTags({ where: "x", tags: undefined }), []);
  assert.deepEqual(validateTags({ where: "x", tags: null }), []);
  assert.ok(validateTags({ where: "x", tags: "not-array" }).length > 0);
  assert.ok(validateTags({ where: "x", tags: ["ok", ""] }).length > 0);
});

test("validateData：最小可用数据应通过校验", () => {
  const data = {
    games: {
      g1: {
        title: "测试游戏",
        genre: "动作",
        rating: 9.1,
        year: 2025,
        updated: "2025-12-21",
        platforms: ["PC"],
        summary: "summary",
        icon: "images/icon.svg",
        modes: ["单人"],
        tags: ["tag"],
        highlights: ["h"],
        hasDeepGuide: true,
        deepGuideHref: "deep.html",
      },
    },
    guides: {
      guide1: {
        title: "测试攻略",
        summary: "summary",
        updated: "2025-12-21",
        difficulty: "入门",
        readingTime: 5,
        icon: "images/icon.svg",
        tags: ["tag"],
        gameId: "g1",
      },
    },
    topics: {
      topic1: {
        title: "测试话题",
        starter: "测试用户",
        summary: "summary",
        category: "综合",
        tags: ["tag"],
        replies: 1,
        updated: "2025-12-21",
      },
    },
  };

  const existsRel = (rel) => rel === "images/icon.svg" || rel === "deep.html";
  const result = validateData({ data, workspaceRoot: "/tmp", existsRel });
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.counts, { games: 1, guides: 1, topics: 1 });
});

test("validateData：应覆盖常见错误分支（含 safeExistsRel fallback）", () => {
  const data = {
    games: {
      "": null,
      g2: {
        title: "",
        genre: "",
        rating: "9",
        year: "2025",
        updated: "2025-1-01",
        platforms: [],
        summary: "",
        icon: "not-images/icon.svg",
        modes: [],
        tags: ["", "ok"],
        highlights: [""],
        hasDeepGuide: true,
        deepGuideHref: "",
      },
      g3: {
        title: "ok",
        genre: "ok",
        rating: 9,
        year: 2025,
        updated: "2025-12-21",
        platforms: ["PC"],
        summary: "ok",
        icon: "images/missing.svg",
        modes: ["单人"],
        tags: [],
        highlights: ["h"],
        hasDeepGuide: true,
        deepGuideHref: "deep-missing.html",
      },
    },
    guides: {
      guideBad: {
        title: "",
        summary: "",
        updated: "bad",
        difficulty: "",
        readingTime: "x",
        gameId: "not-exist",
        icon: "images/missing.svg",
        tags: ["", "x"],
      },
      guideNoIcon: {
        title: "ok",
        summary: "ok",
        updated: "2025-12-21",
        difficulty: "入门",
        readingTime: 1,
        gameId: "",
        tags: "not-array",
      },
    },
    topics: {
      topicBad: {
        title: "",
        starter: "",
        summary: "",
        category: "",
        tags: "not-array",
        replies: "1",
        updated: "2025/12/21",
      },
    },
  };

  // workspaceRoot 传 undefined：覆盖 safeExistsRel 的 try/catch fallback 分支
  const result = validateData({ data, workspaceRoot: undefined });
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.includes("id 不能为空")));
  assert.ok(result.errors.some((e) => e.includes("icon 必须是 images/")));
  assert.ok(result.errors.some((e) => e.includes("icon 文件不存在")));
  assert.ok(result.errors.some((e) => e.includes("deepGuideHref")));
  assert.ok(result.errors.some((e) => e.includes("platforms 必须是非空数组")));
  assert.ok(result.errors.some((e) => e.includes("readingTime 必须是数字")));
  assert.ok(result.errors.some((e) => e.includes("tags 必须是数组")));
});

test("validateData：guides/topics 必须是对象（分支覆盖）", () => {
  const data = {
    games: {},
    guides: { guideX: null },
    topics: { topicX: "not-object" },
  };
  const result = validateData({ data, workspaceRoot: "x", existsRel: () => true });
  assert.ok(result.errors.some((e) => e.includes("guides.guideX") && e.includes("必须是对象")));
  assert.ok(result.errors.some((e) => e.includes("topics.topicX") && e.includes("必须是对象")));
});

test("loadDataFromDataJs / main：应能从 data.js 载入并校验通过", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "icon.svg"), "<svg/>", "utf8");
    fs.writeFileSync(path.join(root, "deep.html"), "<!doctype html>", "utf8");

    const dataJs = `(() => {
      const data = {
        version: "1",
        games: {
          g1: {
            title: "测试游戏",
            genre: "动作",
            rating: 9.1,
            year: 2025,
            updated: "2025-12-21",
            platforms: ["PC"],
            summary: "summary",
            icon: "images/icon.svg",
            modes: ["单人"],
            tags: ["tag"],
            highlights: ["h"],
            hasDeepGuide: true,
            deepGuideHref: "deep.html"
          }
        },
        guides: {
          guide1: {
            title: "测试攻略",
            summary: "summary",
            updated: "2025-12-21",
            difficulty: "入门",
            readingTime: 5,
            icon: "images/icon.svg",
            tags: ["tag"],
            gameId: "g1"
          }
        },
        topics: {
          topic1: {
            title: "测试话题",
            starter: "测试用户",
            summary: "summary",
            category: "综合",
            tags: ["tag"],
            replies: 1,
            updated: "2025-12-21"
          }
        }
      };
      window.GKB = window.GKB || {};
      window.GKB.data = data;
    })();`;
    fs.writeFileSync(path.join(root, "data.js"), dataJs, "utf8");

    const loaded = loadDataFromDataJs({ workspaceRoot: root });
    assert.ok(loaded);
    assert.equal(loaded.version, "1");

    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ data.js 数据校验通过"));
    assert.equal(err.length, 0);
  });
});

test("main：缺少 data.js 时应返回 1", () => {
  withTempDir((root) => {
    const code = main({ workspaceRoot: root, stdout: () => {}, stderr: () => {} });
    assert.equal(code, 1);
  });
});

test("main：data.js 存在但不合法时应返回 1", () => {
  withTempDir((root) => {
    const badDataJs = `(() => {
      const data = { version: "1", games: { g1: { title: "" } }, guides: {}, topics: {} };
      window.GKB = window.GKB || {};
      window.GKB.data = data;
    })();`;
    fs.writeFileSync(path.join(root, "data.js"), badDataJs, "utf8");

    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ data.js 数据校验未通过"));
  });
});

test("CLI：validate-data.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );

    const r = spawnSync(process.execPath, [TOOL_VALIDATE_DATA], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
