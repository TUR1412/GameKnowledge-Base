import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateBundleSize } from "../tools/check-bundlesize.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-bundlesize.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-bundlesize-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const writeDist = (root, { css = "body{color:#000}", js = "console.log('x')" } = {}) => {
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "gkb.min.css"), css, "utf8");
  fs.writeFileSync(path.join(dist, "gkb.min.js"), js, "utf8");
};

test("validateBundleSize：缺少 dist 产物应失败", () => {
  withTempDir((root) => {
    const r = validateBundleSize({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少 CSS bundle")), "应包含 CSS bundle 缺失");
    assert.ok(r.errors.some((e) => e.includes("npm run build:vite")), "应提示先构建 dist");
  });
});

test("validateBundleSize：超过预算应失败", () => {
  withTempDir((root) => {
    writeDist(root);
    const r = validateBundleSize({ workspaceRoot: root, cssBudgetGzipKb: 0, jsBudgetGzipKb: 0 });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("CSS gzip 超过预算")), "应包含 CSS 超预算错误");
    assert.ok(r.errors.some((e) => e.includes("JS gzip 超过预算")), "应包含 JS 超预算错误");
  });
});

test("validateBundleSize：通过分支", () => {
  withTempDir((root) => {
    writeDist(root, { css: "a{b:c}", js: "(()=>{const x=1;return x;})();" });
    const r = validateBundleSize({ workspaceRoot: root, cssBudgetGzipKb: 999, jsBudgetGzipKb: 999 });
    assert.equal(r.ok, true);
    assert.ok(Number(r.css.gzipBytes) > 0);
    assert.ok(Number(r.js.gzipBytes) > 0);
  });
});

test("main：失败时返回 1 并输出错误", () => {
  withTempDir((root) => {
    writeDist(root);
    const out = [];
    const err = [];
    const code = main({
      workspaceRoot: root,
      cssBudgetGzipKb: 0,
      jsBudgetGzipKb: 0,
      stdout: out.push.bind(out),
      stderr: err.push.bind(err),
    });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ Bundle Size 预算门禁未通过"));
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    writeDist(root);
    const out = [];
    const err = [];
    const code = main({
      workspaceRoot: root,
      cssBudgetGzipKb: 999,
      jsBudgetGzipKb: 999,
      stdout: out.push.bind(out),
      stderr: err.push.bind(err),
    });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ Bundle Size 预算门禁通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-bundlesize.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    writeDist(root);

    const pass = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(pass.status, 0);
    assert.equal(pass.signal, null);

    const fail = spawnSync(process.execPath, [TOOL], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GKB_BUDGET_CSS_GZIP_KB: "0", GKB_BUDGET_JS_GZIP_KB: "0" },
    });
    assert.equal(fail.status, 1);
    assert.equal(fail.signal, null);
  });
});
