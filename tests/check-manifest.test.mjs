import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateManifest } from "../tools/check-manifest.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-manifest.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-manifest-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const write = (root, rel, content) => {
  const filePath = path.join(root, rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
};

const writeManifest = (root, obj) => {
  write(root, "manifest.webmanifest", JSON.stringify(obj, null, 2));
};

const makeOkManifest = () => ({
  name: "GameKnowledge-Base",
  short_name: "GKB",
  description: "test",
  lang: "zh-CN",
  start_url: "index.html",
  scope: "./",
  display: "standalone",
  background_color: "#0b0f16",
  theme_color: "#f5f7fb",
  icons: [{ src: "images/icons/favicon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" }],
  shortcuts: [
    {
      name: "Dashboard",
      short_name: "Dash",
      description: "test",
      url: "dashboard.html",
      icons: [{ src: "images/icons/favicon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" }],
    },
  ],
});

test("validateManifest：缺少 manifest.webmanifest 应失败", () => {
  withTempDir((root) => {
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少 manifest.webmanifest")));
  });
});

test("validateManifest：manifest JSON 不合法应失败", () => {
  withTempDir((root) => {
    write(root, "manifest.webmanifest", "{");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("不是合法 JSON")));
  });
});

test("validateManifest：manifest 不是 object 应失败", () => {
  withTempDir((root) => {
    write(root, "manifest.webmanifest", "[]");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("必须是 JSON object")));
  });
});

test("validateManifest：缺少字段与 icons 应失败（分支覆盖）", () => {
  withTempDir((root) => {
    writeManifest(root, {});
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少字段：name")));
    assert.ok(r.errors.some((e) => e.includes("icons 必须是非空数组")));
  });
});

test("validateManifest：display/颜色非法应失败（分支覆盖）", () => {
  withTempDir((root) => {
    writeManifest(root, {
      ...makeOkManifest(),
      display: "bad-display",
      theme_color: "blue",
      background_color: "rgb(0,0,0)",
    });
    write(root, "index.html", "<!doctype html>");
    write(root, "dashboard.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("display 值非法")));
    assert.ok(r.errors.some((e) => e.includes("theme_color 应为 hex")));
    assert.ok(r.errors.some((e) => e.includes("background_color 应为 hex")));
  });
});

test("validateManifest：start_url 外链应失败", () => {
  withTempDir((root) => {
    const m = makeOkManifest();
    m.start_url = "https://evil.example/index.html";
    writeManifest(root, m);
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("start_url 非法或包含外链")));
  });
});

test("validateManifest：start_url 指向不存在资源应失败", () => {
  withTempDir((root) => {
    const m = makeOkManifest();
    m.shortcuts = [];
    writeManifest(root, m);
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("start_url 指向不存在资源")));
  });
});

test("validateManifest：icons 外链与缺失资源应失败", () => {
  withTempDir((root) => {
    const m = makeOkManifest();
    m.icons = [
      {},
      { src: "https://evil.example/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "images/icons/missing.svg", sizes: "any", type: "image/svg+xml" },
      "bad",
    ];
    writeManifest(root, m);
    write(root, "index.html", "<!doctype html>");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("icons[0].src 缺失")));
    assert.ok(r.errors.some((e) => e.includes("icons[1].src 非法或包含外链")));
    assert.ok(r.errors.some((e) => e.includes("icons[2].src 引用不存在资源")));
    assert.ok(r.errors.some((e) => e.includes("icons[3] 必须是 object")));
  });
});

test("validateManifest：shortcuts 非数组/缺少 url 分支覆盖", () => {
  withTempDir((root) => {
    const m = makeOkManifest();
    m.shortcuts = { bad: true };
    writeManifest(root, m);
    write(root, "index.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const bad = validateManifest({ workspaceRoot: root });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.includes("shortcuts 必须是数组")));

    m.shortcuts = [{ name: "x" }];
    writeManifest(root, m);
    const missingUrl = validateManifest({ workspaceRoot: root });
    assert.equal(missingUrl.ok, false);
    assert.ok(missingUrl.errors.some((e) => e.includes("shortcuts[0].url 缺失")));
  });
});

test("validateManifest：shortcuts 条目/资源/图标分支覆盖", () => {
  withTempDir((root) => {
    const m = makeOkManifest();
    m.shortcuts = [
      null,
      {
        name: "x",
        url: "missing.html",
        icons: [
          {},
          "bad",
          { src: "https://evil.example/icon.svg" },
          { src: "images/icons/missing.svg" },
        ],
      },
    ];
    writeManifest(root, m);
    write(root, "index.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("shortcuts[0] 必须是 object")));
    assert.ok(r.errors.some((e) => e.includes("shortcuts[1].url 指向不存在资源")));
    assert.ok(r.errors.some((e) => e.includes("shortcuts[1].icons[0].src 缺失")));
    assert.ok(r.errors.some((e) => e.includes("shortcuts[1].icons[1] 必须是 object")));
    assert.ok(r.errors.some((e) => e.includes("shortcuts[1].icons[2].src 非法或包含外链")));
    assert.ok(r.errors.some((e) => e.includes("shortcuts[1].icons[3].src 引用不存在资源")));
  });
});

test("validateManifest：通过分支", () => {
  withTempDir((root) => {
    writeManifest(root, makeOkManifest());
    write(root, "index.html", "<!doctype html>");
    write(root, "dashboard.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const r = validateManifest({ workspaceRoot: root });
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    writeManifest(root, makeOkManifest());
    write(root, "index.html", "<!doctype html>");
    write(root, "dashboard.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ Manifest 检查通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-manifest.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    writeManifest(root, makeOkManifest());
    write(root, "index.html", "<!doctype html>");
    write(root, "dashboard.html", "<!doctype html>");
    write(root, "images/icons/favicon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

    const r = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
