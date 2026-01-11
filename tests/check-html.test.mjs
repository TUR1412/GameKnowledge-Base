import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateHtml } from "../tools/check-html.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-html.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-html-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const buildHtml = ({ img = "" } = {}) => `<!DOCTYPE html>
<html lang="zh-CN" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="test">
  <meta name="theme-color" content="#f5f7fb">
  <link rel="manifest" href="manifest.webmanifest?v=20260112-3">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()">
  <script src="boot.js?v=20260112-3"></script>
</head>
<body>
  <a class="skip-link" href="#main">跳到正文</a>
  <main id="main" tabindex="-1">
    ${img}
  </main>
</body>
</html>
`;

test("validateHtml：无 HTML 文件应失败", () => {
  withTempDir((root) => {
    const r = validateHtml({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("未找到根目录 HTML")));
  });
});

test("validateHtml：图片缺少 loading/decoding 应失败", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml({ img: '<img src="images/a.svg" alt="x">' }), "utf8");
    const r = validateHtml({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('loading="lazy|eager"')));
    assert.ok(r.errors.some((e) => e.includes('decoding="async|auto|sync"')));
  });
});

test("validateHtml：占位图缺少 width/height 应失败", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      buildHtml({
        img: '<img loading="lazy" decoding="async" src="images/placeholders/screenshot-ui.svg" alt="">',
      }),
      "utf8"
    );
    const r = validateHtml({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("占位图 <img> 缺少 width/height")));
  });
});

test("validateHtml：占位图带 width/height 应通过", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      buildHtml({
        img: '<img loading="lazy" decoding="async" src="images/placeholders/screenshot-ui.svg" alt="" width="300" height="200">',
      }),
      "utf8"
    );
    const r = validateHtml({ workspaceRoot: root });
    assert.equal(r.ok, true);
  });
});

test("validateHtml：通过分支", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      buildHtml({ img: '<img loading="lazy" decoding="async" src="images/a.svg" alt="">' }),
      "utf8"
    );
    const r = validateHtml({ workspaceRoot: root });
    assert.equal(r.ok, true);
  });
});

test("main：失败时返回 1 并输出错误", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml({ img: '<img src="images/a.svg" alt="x">' }), "utf8");
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ HTML 结构检查未通过"));
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      buildHtml({ img: '<img loading="lazy" decoding="async" src="images/a.svg" alt="">' }),
      "utf8"
    );
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ HTML 结构检查通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-html.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "index.html"),
      buildHtml({ img: '<img loading="lazy" decoding="async" src="images/a.svg" alt="">' }),
      "utf8"
    );

    const r = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
