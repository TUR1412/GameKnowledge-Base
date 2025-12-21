import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, normalizeRelative, scanSite, stripQueryAndHash } from "../tools/check-links.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL_CHECK_LINKS = path.join(REPO_ROOT, "tools", "check-links.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-links-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("stripQueryAndHash：应移除 ? 与 #", () => {
  assert.equal(stripQueryAndHash("styles.css?v=20251221-2#x"), "styles.css");
  assert.equal(stripQueryAndHash("a/b/c.png#hash"), "a/b/c.png");
  assert.equal(stripQueryAndHash("a/b/c.png?v=1"), "a/b/c.png");
});

test("normalizeRelative：应过滤外链与协议，并归一化相对路径", () => {
  assert.equal(normalizeRelative("https://example.com/a.css"), "");
  assert.equal(normalizeRelative("http://example.com/a.css"), "");
  assert.equal(normalizeRelative("mailto:test@example.com"), "");
  assert.equal(normalizeRelative("tel:123"), "");
  assert.equal(normalizeRelative("#section"), "");

  assert.equal(normalizeRelative("./images/x.png?v=1"), "images/x.png");
  assert.equal(normalizeRelative(".\\images\\x.png"), "images\\x.png");
  assert.equal(normalizeRelative("../page.html"), "page.html");
  assert.equal(normalizeRelative("  scripts.js?v=1  "), "scripts.js");
});

test("scanSite：应能发现断链与缺失图片资源", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });

    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { version: "1", games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(root, "index.html"),
      `<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="styles.css?v=1">
    <link rel="manifest" href="manifest.webmanifest?v=1">
    <script src="boot.js?v=1"></script>
    <script src="data.js?v=1" defer></script>
    <script src="scripts.js?v=1" defer></script>
  </head>
  <body>
    <a href="missing.html">missing</a>
    <a href="#section">hash</a>
    <a href="maybe.htmlx">ignore</a>
    <img src="images/missing.png" alt="x">
  </body>
</html>`,
      "utf8"
    );

    const result = scanSite({ workspaceRoot: root });
    assert.ok(result.errors.some((e) => e.includes("[LINK] index.html")), "应包含断链错误");
    assert.ok(result.errors.some((e) => e.includes("[ASSET] index.html")), "应包含缺失资源错误");
  });
});

test("main：通过时返回 0，失败时返回 1（不直接 process.exit）", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "ok.png"), "x");

    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { version: "1", games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );

    const html = (body) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="styles.css?v=1">
    <link rel="manifest" href="manifest.webmanifest?v=1">
    <script src="boot.js?v=1"></script>
    <script src="data.js?v=1" defer></script>
    <script src="scripts.js?v=1" defer></script>
  </head>
  <body>${body}</body>
</html>`;

    fs.writeFileSync(path.join(root, "index.html"), html('<a href="page.html">ok</a><img src="images/ok.png">'), "utf8");
    fs.writeFileSync(path.join(root, "page.html"), html('<a href="index.html">home</a>'), "utf8");

    const out = [];
    const err = [];
    const okCode = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(okCode, 0);
    assert.ok(out.join("\n").includes("✅ 站点检查通过"));
    assert.equal(err.length, 0);

    fs.writeFileSync(path.join(root, "page.html"), html('<a href="nope.html">broken</a>'), "utf8");
    out.length = 0;
    err.length = 0;
    const failCode = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(failCode, 1);
    assert.ok(err.join("\n").includes("❌ 站点检查未通过"));
  });
});

test("scanSite：应覆盖缓存穿透/版本一致性/外链资源等分支", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "ok.png"), "x");

    // 先写一个“不含 version 字段”的 data.js：触发 dataVersion 缺失分支
    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );

    const html = ({ vStyles, vManifest, vBoot, vData, vScripts, extraBody = "" }) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="styles.css?v=${vStyles}">
    <link rel="manifest" href="manifest.webmanifest?v=${vManifest}">
    <script src="boot.js?v=${vBoot}"></script>
    <script src="data.js?v=${vData}" defer></script>
    <script src="scripts.js?v=${vScripts}" defer></script>
  </head>
  <body>${extraBody}</body>
</html>`;

    // 1) 单页内版本不一致（触发 unique.size > 1 分支）+ 外链资源（触发 EXT 分支）
    fs.writeFileSync(
      path.join(root, "index.html"),
      html({
        vStyles: 1,
        vManifest: 2,
        vBoot: 1,
        vData: 1,
        vScripts: 1,
        extraBody: '<script src="https://cdn.example.com/x.js"></script>',
      }),
      "utf8"
    );

    // 2) 缺少某个 ?v=（触发 “缺少 xxx 的 ?v=” 分支）
    fs.writeFileSync(
      path.join(root, "missing-v.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css?v=1">
    <script src="boot.js?v=1"></script>
    <script src="data.js?v=1" defer></script>
    <script src="scripts.js?v=1" defer></script>
  </head>
  <body></body>
</html>`,
      "utf8"
    );

    // 3) 全站版本不一致（触发 globalVersion 不一致分支）
    fs.writeFileSync(
      path.join(root, "page.html"),
      html({ vStyles: 9, vManifest: 9, vBoot: 9, vData: 9, vScripts: 9 }),
      "utf8"
    );

    const r1 = scanSite({ workspaceRoot: root });
    assert.ok(r1.errors.some((e) => e.includes("缺少") && e.includes("?v=")), "应包含缺少版本号的错误");
    assert.ok(r1.errors.some((e) => e.includes("核心资源版本号不一致")), "应包含单页内版本不一致错误");
    assert.ok(r1.errors.some((e) => e.includes("[EXT] index.html")), "应包含外链资源错误");
    assert.ok(r1.errors.some((e) => e.includes("版本号与全站不一致")), "应包含全站版本不一致错误");
    assert.ok(r1.errors.some((e) => e.includes("data.js: 未找到 data.version")), "应包含 data.version 缺失错误");

    // 再写一个“version 不匹配”的 data.js：触发 dataVersion !== globalVersion 分支
    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { version: "2", games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );
    const r2 = scanSite({ workspaceRoot: root });
    assert.ok(r2.errors.some((e) => e.includes("版本不一致") && e.includes("data.js")), "应包含 data.js version 不匹配错误");
  });
});

test("scanSite：当无法解析全站版本号时应跳过 data.js 对齐检查（分支覆盖）", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css">
    <link rel="manifest" href="manifest.webmanifest">
    <script src="boot.js"></script>
    <script src="data.js" defer></script>
    <script src="scripts.js" defer></script>
  </head>
  <body></body>
</html>`,
      "utf8"
    );

    const r = scanSite({ workspaceRoot: root });
    assert.equal(r.globalVersion, "");
    assert.ok(r.errors.some((e) => e.includes("[CACHE] index.html") && e.includes("缺少")), "应包含缺少 ?v= 的错误");
    assert.ok(!r.errors.some((e) => e.includes("data.js version=")), "不应触发 data.js 版本对齐检查");
  });
});

test("CLI：check-links.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "images", "ok.png"), "x");

    fs.writeFileSync(
      path.join(root, "data.js"),
      `(() => { window.GKB = window.GKB || {}; window.GKB.data = { version: "1", games: {}, guides: {}, topics: {} }; })();`,
      "utf8"
    );

    const html = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css?v=1">
    <link rel="manifest" href="manifest.webmanifest?v=1">
    <script src="boot.js?v=1"></script>
    <script src="data.js?v=1" defer></script>
    <script src="scripts.js?v=1" defer></script>
  </head>
  <body>
    <a href="page.html">ok</a>
    <img src="images/ok.png" alt="">
  </body>
</html>`;

    fs.writeFileSync(path.join(root, "index.html"), html, "utf8");
    fs.writeFileSync(path.join(root, "page.html"), html.replace("page.html", "index.html"), "utf8");

    const r = spawnSync(process.execPath, [TOOL_CHECK_LINKS], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
