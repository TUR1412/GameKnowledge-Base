import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");

const TOOL_BUILD_DATA = path.join(REPO_ROOT, "tools", "build-data.mjs");
const TOOL_EXPORT_CONTENT = path.join(REPO_ROOT, "tools", "export-content.mjs");
const TOOL_VALIDATE_DATA = path.join(REPO_ROOT, "tools", "validate-data.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-content-pipeline-"));
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

const writeDefaultTaxonomy = (root, { tags = ["Boss"], topicCategories = ["资讯"] } = {}) => {
  const taxonomy = { version: 1, tags: {}, topicCategories: {} };
  tags.forEach((t) => {
    taxonomy.tags[String(t)] = [];
  });
  topicCategories.forEach((c) => {
    taxonomy.topicCategories[String(c)] = [];
  });
  writeJson(path.join(root, "content", "taxonomy.json"), taxonomy);
};

const runNodeScript = (scriptPath, { cwd }) => {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });
};

test("build-data：缺少 content/meta.json 应失败", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    const r = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    assert.ok(String(r.stderr).includes("build-data"));
  });
});

test("build-data：content/meta.json 非法 JSON 应失败（覆盖 JSON 解析失败分支）", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "meta.json"), "{", "utf8");
    const r = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    assert.ok(String(r.stderr).includes("JSON 解析失败"));
  });
});

test("build-data：应报告非法文件名与非对象 JSON（覆盖分支）", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "icon.svg"), "<svg/>", "utf8");

    writeJson(path.join(root, "content", "meta.json"), {
      version: "20260127-1",
      site: { name: "站点", tagline: "tag", description: "desc" },
    });
    writeDefaultTaxonomy(root, { tags: [], topicCategories: ["资讯"] });

    // 非法文件名：.json -> id 为空
    writeJson(path.join(root, "content", "games", ".json"), { any: "x" });

    // JSON 必须是对象：数组会触发校验错误
    fs.writeFileSync(path.join(root, "content", "games", "bad.json"), "[]\n", "utf8");

    // 不创建 topics/：覆盖 listJsonFiles 的 dir 不存在分支
    fs.mkdirSync(path.join(root, "content", "guides"), { recursive: true });

    const r = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    const err = String(r.stderr);
    assert.ok(err.includes("非法文件名"));
    assert.ok(err.includes("JSON 必须是对象"));
  });
});

test("build-data：应生成 data.js 且重复生成无 diff，并能通过 validate-data", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "icon.svg"), "<svg/>", "utf8");

    writeJson(path.join(root, "content", "meta.json"), {
      version: "20260127-1",
      site: { name: "站点", tagline: "tag", description: "desc" },
    });
    writeDefaultTaxonomy(root, { tags: [], topicCategories: ["资讯"] });

    writeJson(path.join(root, "content", "games", "dark-souls3.json"), {
      title: "黑暗之魂3",
      genre: "动作角色",
      rating: 9.5,
      year: 2016,
      updated: "2025-12-21",
      platforms: ["PC"],
      summary: "summary",
      icon: "images/icon.svg",
      modes: ["单人"],
      highlights: ["h"],
      // 覆盖 formatJs 的多分支：boolean / null / empty array / empty object
      hasDeepGuide: false,
      subtitle: null,
      extraEmptyArr: [],
      extraEmptyObj: {},
    });

    writeJson(path.join(root, "content", "guides", "ds3-boss.json"), {
      title: "Boss 攻略",
      summary: "summary",
      updated: "2025-12-21",
      difficulty: "入门",
      readingTime: 5,
      gameId: "dark-souls3",
      icon: "images/icon.svg",
    });

    writeJson(path.join(root, "content", "topics", "upcoming-rpgs.json"), {
      title: "话题",
      starter: "用户",
      summary: "summary",
      category: "资讯",
      replies: 1,
      updated: "2025-12-21",
    });

    const r1 = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.equal(r1.status, 0);
    assert.equal(r1.signal, null);

    const dataPath = path.join(root, "data.js");
    assert.ok(fs.existsSync(dataPath));
    const first = fs.readFileSync(dataPath, "utf8");
    assert.ok(first.includes("window.GKB.data"));

    const r2 = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.equal(r2.status, 0);
    assert.equal(r2.signal, null);
    const second = fs.readFileSync(dataPath, "utf8");
    assert.equal(second, first);

    const v = runNodeScript(TOOL_VALIDATE_DATA, { cwd: root });
    assert.equal(v.status, 0);
    assert.equal(v.signal, null);
  });
});

test("export-content：缺少 data.js 应失败", () => {
  withTempDir((root) => {
    const r = runNodeScript(TOOL_EXPORT_CONTENT, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    assert.ok(String(r.stderr).includes("export-content"));
  });
});

test("export-content：应从 data.js 导出 content/，再 build-data 生成并通过 validate-data", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "icon.svg"), "<svg/>", "utf8");

    const dataJs = `(() => {
      const data = {
        version: "20260127-1",
        site: { name: "站点", tagline: "tag", description: "desc" },
        games: {
          "": { title: "skip-me" },
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
            highlights: ["h"],
            subtitle: null
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
            gameId: "g1"
          }
        },
        topics: {
          topic1: {
            title: "测试话题",
            starter: "测试用户",
            summary: "summary",
            category: "综合",
            replies: 1,
            updated: "2025-12-21"
          }
        }
      };
      window.GKB = window.GKB || {};
      window.GKB.data = data;
    })();`;

    fs.writeFileSync(path.join(root, "data.js"), dataJs, "utf8");

    const ex = runNodeScript(TOOL_EXPORT_CONTENT, { cwd: root });
    assert.equal(ex.status, 0);
    assert.equal(ex.signal, null);

    assert.ok(fs.existsSync(path.join(root, "content", "meta.json")));
    assert.ok(fs.existsSync(path.join(root, "content", "taxonomy.json")));
    assert.ok(fs.existsSync(path.join(root, "content", "games", "g1.json")));
    assert.ok(fs.existsSync(path.join(root, "content", "guides", "guide1.json")));
    assert.ok(fs.existsSync(path.join(root, "content", "topics", "topic1.json")));

    const b = runNodeScript(TOOL_BUILD_DATA, { cwd: root });
    assert.equal(b.status, 0);
    assert.equal(b.signal, null);

    const v = runNodeScript(TOOL_VALIDATE_DATA, { cwd: root });
    assert.equal(v.status, 0);
    assert.equal(v.signal, null);
  });
});

test("validate-data：content/ 存在但元数据不合格应失败（覆盖 content 校验失败分支）", () => {
  withTempDir((root) => {
    // 让 data.js 本身可通过校验（空表即可）
    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { games: {}, guides: {}, topics: {} }; })();\n`,
      "utf8"
    );

    // content/ 存在，但 meta.json 故意缺失 site 必填字段
    writeJson(path.join(root, "content", "meta.json"), {
      version: "20260127-1",
      site: { name: "", tagline: "", description: "" },
    });
    writeJson(path.join(root, "content", "taxonomy.json"), { version: 1, tags: {}, topicCategories: {} });

    const r = runNodeScript(TOOL_VALIDATE_DATA, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    assert.ok(String(r.stderr).includes("content/ 数据校验未通过"));
  });
});

test("validate-data：content/ JSON 解析失败应报错（覆盖 JSON 解析失败分支）", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { games: {}, guides: {}, topics: {} }; })();\n`,
      "utf8"
    );

    fs.mkdirSync(path.join(root, "content", "games"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "meta.json"), "{}", "utf8");
    fs.writeFileSync(
      path.join(root, "content", "taxonomy.json"),
      JSON.stringify({ version: 1, tags: {}, topicCategories: {} }, null, 2) + "\n",
      "utf8"
    );
    fs.writeFileSync(path.join(root, "content", "games", "bad.json"), "{", "utf8");

    const r = runNodeScript(TOOL_VALIDATE_DATA, { cwd: root });
    assert.notEqual(r.status, 0);
    assert.equal(r.signal, null);
    assert.ok(String(r.stderr).includes("JSON 解析失败"));
  });
});
