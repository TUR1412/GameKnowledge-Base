import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  baseFromSitemapUrl,
  buildUrl,
  escapeXml,
  listRootHtml,
  loadDataFromDataJs,
  normalizeBase,
  parseSitemapUrlFromRobots,
  readText,
  writeText,
} from "../tools/lib/site.mjs";

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-site-lib-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("normalizeBase：应补齐结尾 /，空值返回空串", () => {
  assert.equal(normalizeBase(""), "");
  assert.equal(normalizeBase(null), "");
  assert.equal(normalizeBase("https://example.com"), "https://example.com/");
  assert.equal(normalizeBase("https://example.com/"), "https://example.com/");
  assert.equal(normalizeBase("  https://example.com/x  "), "https://example.com/x/");
});

test("buildUrl：应拼接 base 与 path，并消除多余前导 /", () => {
  assert.equal(buildUrl("https://a.com", "/x"), "https://a.com/x");
  assert.equal(buildUrl("https://a.com/", "x?y=1"), "https://a.com/x?y=1");
  assert.equal(buildUrl("", "/x"), "x");
});

test("escapeXml：应转义 XML 特殊字符", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXml(null), "");
});

test("parseSitemapUrlFromRobots：应从 robots.txt 提取 Sitemap URL（大小写不敏感）", () => {
  const robots = `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n`;
  assert.equal(parseSitemapUrlFromRobots(robots), "https://example.com/sitemap.xml");
  assert.equal(parseSitemapUrlFromRobots("no sitemap here"), "");
});

test("baseFromSitemapUrl：仅接受以 sitemap.xml 结尾的绝对 URL", () => {
  assert.equal(baseFromSitemapUrl("https://example.com/sitemap.xml"), "https://example.com/");
  assert.equal(baseFromSitemapUrl("https://example.com/x/sitemap.xml"), "https://example.com/x/");
  assert.equal(baseFromSitemapUrl("https://example.com/not-sitemap.txt"), "");
  assert.equal(baseFromSitemapUrl("not-a-url"), "");
});

test("listRootHtml：应列出根目录 HTML 并排序", () => {
  withTempDir((root) => {
    fs.writeFileSync(path.join(root, "b.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "a.html"), "<!doctype html>", "utf8");
    fs.writeFileSync(path.join(root, "c.txt"), "x", "utf8");

    assert.deepEqual(listRootHtml({ workspaceRoot: root }), ["a.html", "b.html"]);
  });
});

test("readText/writeText：应以 utf8 读写文本", () => {
  withTempDir((root) => {
    const filePath = path.join(root, "x.txt");
    writeText(filePath, "hello");
    assert.equal(readText(filePath), "hello");
  });
});

test("loadDataFromDataJs：应能在无 window 环境下加载 data.js（vm 沙箱）", () => {
  withTempDir((root) => {
    const dataJs = `(() => {
      const data = { version: "1", games: {}, guides: {}, topics: {} };
      window.GKB = window.GKB || {};
      window.GKB.data = data;
    })();`;
    fs.writeFileSync(path.join(root, "data.js"), dataJs, "utf8");

    const loaded = loadDataFromDataJs({ workspaceRoot: root });
    assert.ok(loaded);
    assert.equal(loaded.version, "1");
  });
});

test("loadDataFromDataJs：data.js 不存在时返回 null", () => {
  withTempDir((root) => {
    assert.equal(loadDataFromDataJs({ workspaceRoot: root }), null);
  });
});

