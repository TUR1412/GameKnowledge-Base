import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main, validateRuntime } from "../tools/check-runtime.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL = path.join(REPO_ROOT, "tools", "check-runtime.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-runtime-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("validateRuntime：缺少关键文件应失败", () => {
  withTempDir((root) => {
    const r = validateRuntime({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("scripts.js")));
    assert.ok(r.errors.some((e) => e.includes("styles.css")));
    assert.ok(r.errors.some((e) => e.includes("dashboard.html")));
  });
});

test("validateRuntime：通过与失败分支", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "scripts.js"),
      `
        const STORAGE_KEYS = {
          diagnosticsErrors: "gkb-diagnostics-errors",
          diagnosticsLogs: "gkb-diagnostics-logs",
        };
        const initErrorBoundary = () => {};
        const openDiagnosticsDialog = () => {};
        window.GKB = { runtime: {} };
        window.GKB.runtime.logger = {};
      `,
      "utf8"
    );
    fs.writeFileSync(path.join(root, "styles.css"), ".diag-root{} .diag-panel{}", "utf8");
    fs.writeFileSync(
      path.join(root, "dashboard.html"),
      '<div id="dash-diagnostics"></div><button id="dash-diag-open"></button><button id="dash-diag-export"></button>',
      "utf8"
    );

    const ok = validateRuntime({ workspaceRoot: root });
    assert.equal(ok.ok, true);

    // 缺少 diagnostics logs key
    const badScripts = readText(path.join(root, "scripts.js")).replace("gkb-diagnostics-logs", "gkb-x");
    fs.writeFileSync(path.join(root, "scripts.js"), badScripts, "utf8");
    const bad = validateRuntime({ workspaceRoot: root });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.includes("gkb-diagnostics-logs")));
  });
});

test("main：不依赖 process.exit，可被测试驱动", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "scripts.js"), "x", "utf8");
    fs.writeFileSync(path.join(root, "styles.css"), "x", "utf8");
    fs.writeFileSync(path.join(root, "dashboard.html"), "x", "utf8");

    const err = [];
    const code = main({ workspaceRoot: root, stderr: err.push.bind(err) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ Runtime 关键能力检查未通过"));
  });
});

test("main：通过时返回 0 并输出提示", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "scripts.js"),
      'const initErrorBoundary = () => {}; const openDiagnosticsDialog = () => {}; const x = "gkb-diagnostics-errors gkb-diagnostics-logs"; window.GKB = { runtime: {} }; window.GKB.runtime.logger = {};',
      "utf8"
    );
    fs.writeFileSync(path.join(root, "styles.css"), ".diag-root{} .diag-panel{}", "utf8");
    fs.writeFileSync(
      path.join(root, "dashboard.html"),
      '<div id="dash-diagnostics"></div><button id="dash-diag-open"></button><button id="dash-diag-export"></button>',
      "utf8"
    );

    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: out.push.bind(out), stderr: err.push.bind(err) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ Runtime 关键能力检查通过"));
    assert.equal(err.length, 0);
  });
});

test("CLI：check-runtime.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.writeFileSync(
      path.join(root, "scripts.js"),
      'const initErrorBoundary = () => {}; const openDiagnosticsDialog = () => {}; const x = "gkb-diagnostics-errors gkb-diagnostics-logs"; window.GKB = { runtime: {} }; window.GKB.runtime.logger = {};',
      "utf8"
    );
    fs.writeFileSync(path.join(root, "styles.css"), ".diag-root{} .diag-panel{}", "utf8");
    fs.writeFileSync(
      path.join(root, "dashboard.html"),
      '<div id="dash-diagnostics"></div><button id="dash-diag-open"></button><button id="dash-diag-export"></button>',
      "utf8"
    );

    const r = spawnSync(process.execPath, [TOOL], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
