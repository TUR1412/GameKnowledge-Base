import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildData } from "../tools/build-data.mjs";
import { loadDataFromDataJs } from "../tools/lib/site.mjs";

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-build-data-branches-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const writeJson = (filePath, obj) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
};

const writeMeta = (root, { version = "20260127-1" } = {}) => {
  writeJson(path.join(root, "content", "meta.json"), {
    version,
    site: { name: "站点", tagline: "tag", description: "desc" },
  });
};

test("buildData：taxonomy.json 非法 JSON 应抛错（覆盖 readJsonOptional catch 分支）", () => {
  withTempDir((root) => {
    writeMeta(root);
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "taxonomy.json"), "{", "utf8");

    assert.throws(() => buildData({ workspaceRoot: root }), /JSON 解析失败/);
  });
});

test("buildData：taxonomy 表结构非法时应忽略 taxonomy（覆盖 loadTaxonomy 返回 null 分支）", () => {
  withTempDir((root) => {
    writeMeta(root);
    writeJson(path.join(root, "content", "taxonomy.json"), {
      version: 1,
      // 非对象：应触发 loadTaxonomy 返回 null，构建过程不做 tag/category 归一化与治理校验
      tags: [],
      topicCategories: {},
    });

    writeJson(path.join(root, "content", "games", "g1.json"), {
      title: "测试游戏",
      genre: "动作",
      rating: 9.1,
      year: 2025,
      updated: "2025-12-21",
      platforms: ["PC"],
      summary: "summary",
      icon: "images/icon.svg",
      modes: ["单人"],
      highlights: ["h"],
      tags: ["UnregisteredTag"],
    });

    const r = buildData({ workspaceRoot: root });
    assert.equal(r.ok, true);

    const data = loadDataFromDataJs({ workspaceRoot: root });
    assert.equal(data?.games?.g1?.tags?.[0], "UnregisteredTag");
  });
});

test("buildData：tags/category 应按 alias 归一化并去重（覆盖 normalizeWithAlias direct/lower + 去重分支）", () => {
  withTempDir((root) => {
    writeMeta(root);
    writeJson(path.join(root, "content", "taxonomy.json"), {
      version: 1,
      tags: { Boss: ["boss"] },
      topicCategories: { News: ["news"] },
    });

    writeJson(path.join(root, "content", "games", "g1.json"), {
      title: "测试游戏",
      genre: "动作",
      rating: 9.1,
      year: 2025,
      updated: "2025-12-21",
      platforms: ["PC"],
      summary: "summary",
      icon: "images/icon.svg",
      modes: ["单人"],
      highlights: ["h"],
      tags: ["boss", "BOSS", "Boss"],
      "a-b": 1,
    });

    writeJson(path.join(root, "content", "topics", "t1.json"), {
      title: "话题",
      starter: "用户",
      summary: "summary",
      category: "NEWS",
      replies: 1,
      updated: "2025-12-21",
      tags: ["Boss"],
    });

    const r = buildData({ workspaceRoot: root });
    assert.equal(r.ok, true);

    const data = loadDataFromDataJs({ workspaceRoot: root });
    // vm sandbox 返回的 Array 属于不同 realm，需归一化到当前 realm 再做深比较
    assert.deepEqual(Array.from(data?.games?.g1?.tags || []), ["Boss"]);
    assert.equal(data?.games?.g1?.["a-b"], 1);
    assert.equal(data?.topics?.t1?.category, "News");
  });
});

test("buildData：非法 tags/category 应返回 ok=false 并给出可定位错误（覆盖 errors push 分支）", () => {
  withTempDir((root) => {
    writeMeta(root);
    writeJson(path.join(root, "content", "taxonomy.json"), {
      version: 1,
      tags: { Boss: [] },
      topicCategories: { News: [] },
    });

    writeJson(path.join(root, "content", "games", "g1.json"), {
      title: "测试游戏",
      genre: "动作",
      rating: 9.1,
      year: 2025,
      updated: "2025-12-21",
      platforms: ["PC"],
      summary: "summary",
      icon: "images/icon.svg",
      modes: ["单人"],
      highlights: ["h"],
      // 覆盖 tags 非数组 / 空 tag / 未登记标签
      tags: "Boss",
    });

    writeJson(path.join(root, "content", "topics", "t1.json"), {
      title: "话题",
      starter: "用户",
      summary: "summary",
      category: "UnknownCategory",
      replies: 1,
      updated: "2025-12-21",
      tags: ["UnknownTag", ""],
    });

    const r = buildData({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("games.g1") && e.includes("tags 必须是数组")));
    assert.ok(r.errors.some((e) => e.includes("topics.t1") && e.includes("category 未登记")));
    assert.ok(r.errors.some((e) => e.includes("topics.t1") && e.includes("tags")));
  });
});
