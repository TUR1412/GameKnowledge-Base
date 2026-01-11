import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateA11y } from "../tools/check-a11y.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-a11y.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-a11y-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const buildHtml = ({ lang = "zh-CN", title = "Test Title", desc = "Test description", body = "" } = {}) =>
  `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${desc}">
  </head>
  <body>
    ${body}
  </body>
</html>`;

test("validateA11y：无 HTML 文件应失败", () => {
  withTempDir((root) => {
    const r = validateA11y({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("未找到根目录 HTML")));
  });
});

test("validateA11y：workspaceRoot 不可读应失败", () => {
  withTempDir((root) => {
    const filePath = path.join(root, "not-a-dir.txt");
    fs.writeFileSync(filePath, "x", "utf8");
    const r = validateA11y({ workspaceRoot: filePath });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("无法读取目录")));
  });
});

test("validateA11y：缺少 lang/title/description 应失败", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml({ lang: "", title: "", desc: "" }), "utf8");
    const r = validateA11y({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少 lang")));
    assert.ok(r.errors.some((e) => e.includes("缺少 <title>")));
    assert.ok(r.errors.some((e) => e.includes("meta description")));
  });
});

test("validateA11y：检测到 inline style / on* handler 应失败", () => {
  withTempDir((root) => {
    const body = '<style>body{background:red}</style><div style="color:red" onclick="alert(1)">x</div>';
    fs.writeFileSync(path.join(root, "index.html"), buildHtml({ body }), "utf8");
    const r = validateA11y({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("inline style")));
    assert.ok(r.errors.some((e) => e.includes("on*")));
  });
});

test("validateA11y：主导航 active 链接必须带 aria-current", () => {
  withTempDir((root) => {
    const bad = buildHtml({
      body: '<nav id="site-nav" aria-label="主导航"><a href="index.html" class="active">Home</a></nav>',
    });
    fs.writeFileSync(path.join(root, "index.html"), bad, "utf8");
    const r1 = validateA11y({ workspaceRoot: root });
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => e.includes("aria-current")));

    const ok = buildHtml({
      body: '<nav id="site-nav" aria-label="主导航"><a href="index.html" class="active" aria-current="page">Home</a></nav>',
    });
    fs.writeFileSync(path.join(root, "index.html"), ok, "utf8");
    const r2 = validateA11y({ workspaceRoot: root });
    assert.equal(r2.ok, true);
  });
});

test("validateA11y：通过分支", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml(), "utf8");
    const r = validateA11y({ workspaceRoot: root });
    assert.equal(r.ok, true);
  });
});

test("main：失败时返回 1 并输出错误", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml({ title: "" }), "utf8");
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ A11y/SEO 基础检查未通过"));
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml(), "utf8");
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ A11y/SEO 基础检查通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-a11y.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), buildHtml(), "utf8");
    const r = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
