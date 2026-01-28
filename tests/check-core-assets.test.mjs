import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateCoreAssets } from "../tools/check-core-assets.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-core-assets.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-core-assets-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const writeCoreFiles = (root, { scripts = "(()=>{})();", styles = "body{color:#000}", boot = "(function(){})();" } = {}) => {
  fs.writeFileSync(path.join(root, "scripts.js"), scripts, "utf8");
  fs.writeFileSync(path.join(root, "styles.css"), styles, "utf8");
  fs.writeFileSync(path.join(root, "boot.js"), boot, "utf8");
  fs.writeFileSync(path.join(root, "sw.js"), "const PRECACHE_URLS = [];", "utf8");
  fs.writeFileSync(path.join(root, "manifest.webmanifest"), "{}", "utf8");
};

test("validateCoreAssets：缺少关键文件应失败", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "scripts.js"), "(()=>{})();", "utf8");
    const r = validateCoreAssets({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少 styles.css")));
    assert.ok(r.errors.some((e) => e.includes("缺少 boot.js")));
  });
});

test("validateCoreAssets：超过预算应失败", () => {
  withTempDir((root) => {
    writeCoreFiles(root, { scripts: "x".repeat(5000) });
    const r = validateCoreAssets({ workspaceRoot: root, scriptsBudgetGzipKb: 0 });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("scripts.js gzip 超过预算")));
  });
});

test("validateCoreAssets：通过分支", () => {
  withTempDir((root) => {
    writeCoreFiles(root);
    const r = validateCoreAssets({ workspaceRoot: root, scriptsBudgetGzipKb: 999, stylesBudgetGzipKb: 999 });
    assert.equal(r.ok, true);
    assert.ok(Number(r.files.scripts.gzipBytes) > 0);
    assert.ok(Number(r.files.styles.gzipBytes) > 0);
  });
});

test("validateCoreAssets：预算参数非法应回退默认值（覆盖 toNumberOrNull isFinite=false 分支）", () => {
  withTempDir((root) => {
    writeCoreFiles(root);
    const r = validateCoreAssets({ workspaceRoot: root, scriptsBudgetGzipKb: "not-a-number", stylesBudgetGzipKb: "NaN" });
    assert.equal(r.ok, true);
    assert.equal(r.budgets.scriptsGzipKb, 120);
    assert.equal(r.budgets.stylesGzipKb, 60);
  });
});

test("main：失败时返回 1 并输出错误", () => {
  withTempDir((root) => {
    writeCoreFiles(root);
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, scriptsBudgetGzipKb: 0, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ Core Assets 预算门禁未通过"));
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    writeCoreFiles(root);
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, scriptsBudgetGzipKb: 999, stylesBudgetGzipKb: 999, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ Core Assets 预算门禁通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-core-assets.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    writeCoreFiles(root);
    const r = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
