import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractPrecacheBody,
  main,
  parseDoubleQuotedStrings,
  parseTemplateStrings,
  validateServiceWorker,
} from "../tools/check-sw.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const TOOL_CHECK_SW = path.join(REPO_ROOT, "tools", "check-sw.mjs");

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-check-sw-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("extractPrecacheBody：应提取 PRECACHE_URLS 数组体", () => {
  const sw = `
    const PRECACHE_URLS = [
      "index.html",
      \`styles.css?v=\${VERSION}\`
    ];
  `;
  const body = extractPrecacheBody(sw);
  assert.ok(body.includes("\"index.html\""));
  assert.ok(body.includes("`styles.css?v=${VERSION}`"));
});

test("extractPrecacheBody / parse*：无匹配输入应返回空结果（分支覆盖）", () => {
  assert.equal(extractPrecacheBody("const X = 1;"), "");
  assert.deepEqual(parseDoubleQuotedStrings("no strings here"), []);
  assert.deepEqual(parseTemplateStrings("no templates here"), []);
});

test("parseDoubleQuotedStrings：应解析双引号字符串（含转义）", () => {
  const body = `"a", "b", "c\\\\d", "a\\\"b"`;
  const items = parseDoubleQuotedStrings(body);
  assert.deepEqual(items, ["a", "b", "c\\d", 'a"b']);
});

test("parseDoubleQuotedStrings：JSON.parse 失败时应回退原值", () => {
  const body = `"a\\q"`;
  const items = parseDoubleQuotedStrings(body);
  assert.deepEqual(items, ["a\\q"]);
});

test("parseTemplateStrings：应解析模板字符串", () => {
  const body = "`a` `b${x}` `c`";
  const items = parseTemplateStrings(body);
  assert.deepEqual(items, ["a", "b${x}", "c"]);
});

test("validateServiceWorker：通过与失败分支", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "page.html"), "<!doctype html>", "utf8");

    const swOk = `
      const VERSION = (() => {
        try { return new URL(self.location.href).searchParams.get("v") || "dev"; } catch (_) { return "dev"; }
      })();
      const CACHE_NAME = \`gkb-cache-\${VERSION}\`;

      const PRECACHE_URLS = [
        "index.html",
        "page.html",
        \`styles.css?v=\${VERSION}\`,
        \`data.js?v=\${VERSION}\`,
        \`scripts.js?v=\${VERSION}\`,
        \`vendor/motion.js?v=\${VERSION}\`,
        \`boot.js?v=\${VERSION}\`,
        \`manifest.webmanifest?v=\${VERSION}\`
      ];
    `;
    fs.writeFileSync(path.join(root, "sw.js"), swOk, "utf8");

    const ok = validateServiceWorker({ workspaceRoot: root });
    assert.equal(ok.ok, true);
    assert.equal(ok.errors.length, 0);
    assert.equal(ok.counts.html, 2);

    const swBad = swOk.replace("`scripts.js?v=${VERSION}`,", "");
    fs.writeFileSync(path.join(root, "sw.js"), swBad, "utf8");
    const bad = validateServiceWorker({ workspaceRoot: root });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.includes("scripts.js?v=${VERSION}")));

    // 缺少 VERSION 读取 / CACHE_NAME 绑定
    const swNoVersion = swOk.replace('searchParams.get("v")', 'searchParams.get("x")');
    fs.writeFileSync(path.join(root, "sw.js"), swNoVersion, "utf8");
    const noVersion = validateServiceWorker({ workspaceRoot: root });
    assert.equal(noVersion.ok, false);
    assert.ok(noVersion.errors.some((e) => e.includes("searchParams.get(\"v\")")));

    const swNoCache = swOk.replace("gkb-cache-${VERSION}", "gkb-cache-${X}");
    fs.writeFileSync(path.join(root, "sw.js"), swNoCache, "utf8");
    const noCache = validateServiceWorker({ workspaceRoot: root });
    assert.equal(noCache.ok, false);
    assert.ok(noCache.errors.some((e) => e.includes("gkb-cache-${VERSION}")));

    // 缺少 HTML 入口页预缓存
    const swNoHtml = swOk.replace('"page.html",', "");
    fs.writeFileSync(path.join(root, "sw.js"), swNoHtml, "utf8");
    const noHtml = validateServiceWorker({ workspaceRoot: root });
    assert.equal(noHtml.ok, false);
    assert.ok(noHtml.errors.some((e) => e.includes("缺少 HTML：page.html")));

    // 外链资源禁止
    const swExt = swOk.replace('"page.html",', '"page.html", "https://evil.example/x.js",');
    fs.writeFileSync(path.join(root, "sw.js"), swExt, "utf8");
    const ext = validateServiceWorker({ workspaceRoot: root });
    assert.equal(ext.ok, false);
    assert.ok(ext.errors.some((e) => e.includes("外链资源")));

    // 禁止预缓存未版本化静态资源（.js/.css/.webmanifest）
    const variants = [
      swOk.replace("`styles.css?v=${VERSION}`,", '"styles.css",'),
      swOk.replace("`scripts.js?v=${VERSION}`,", '"scripts.js",'),
      swOk.replace("`manifest.webmanifest?v=${VERSION}`", '"manifest.webmanifest"'),
    ];
    variants.forEach((text) => {
      fs.writeFileSync(path.join(root, "sw.js"), text, "utf8");
      const unversioned = validateServiceWorker({ workspaceRoot: root });
      assert.equal(unversioned.ok, false);
      assert.ok(unversioned.errors.some((e) => e.includes("未版本化")));
    });
  });
});

test("main：不依赖 process.exit，可被测试驱动", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "sw.js"), "const PRECACHE_URLS = [];", "utf8");
    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(code, 1);
    assert.ok(err.join("\n").includes("❌ SW 检查未通过"));
  });
});

test("main：通过时返回 0 并输出统计信息", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "page.html"), "<!doctype html>", "utf8");

    const swOk = `
      const VERSION = (() => {
        try { return new URL(self.location.href).searchParams.get("v") || "dev"; } catch (_) { return "dev"; }
      })();
      const CACHE_NAME = \`gkb-cache-\${VERSION}\`;
      const PRECACHE_URLS = [
        "index.html",
        "page.html",
        \`styles.css?v=\${VERSION}\`,
        \`data.js?v=\${VERSION}\`,
        \`scripts.js?v=\${VERSION}\`,
        \`vendor/motion.js?v=\${VERSION}\`,
        \`boot.js?v=\${VERSION}\`,
        \`manifest.webmanifest?v=\${VERSION}\`
      ];
    `;
    fs.writeFileSync(path.join(root, "sw.js"), swOk, "utf8");

    const out = [];
    const err = [];
    const code = main({ workspaceRoot: root, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
    assert.equal(code, 0);
    assert.ok(out.join("\n").includes("✅ SW 检查通过"));
    assert.equal(err.length, 0);
  });
});

test("validateServiceWorker：缺少 sw.js 应失败", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>", "utf8");
    const r = validateServiceWorker({ workspaceRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes("缺少 sw.js")));
  });
});

test("CLI：check-sw.mjs 作为脚本运行应 process.exit(main())", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "page.html"), "<!doctype html>", "utf8");

    const swOk = `
      const VERSION = (() => {
        try { return new URL(self.location.href).searchParams.get("v") || "dev"; } catch (_) { return "dev"; }
      })();
      const CACHE_NAME = \`gkb-cache-\${VERSION}\`;
      const PRECACHE_URLS = [
        "index.html",
        "page.html",
        \`styles.css?v=\${VERSION}\`,
        \`data.js?v=\${VERSION}\`,
        \`scripts.js?v=\${VERSION}\`,
        \`vendor/motion.js?v=\${VERSION}\`,
        \`boot.js?v=\${VERSION}\`,
        \`manifest.webmanifest?v=\${VERSION}\`
      ];
    `;
    fs.writeFileSync(path.join(root, "sw.js"), swOk, "utf8");

    const r = spawnSync(process.execPath, [TOOL_CHECK_SW], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
  });
});
