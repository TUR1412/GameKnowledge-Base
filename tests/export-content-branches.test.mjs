import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { exportContent } from "../tools/export-content.mjs";

const withTempDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gkb-export-content-branches-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("exportContent：应生成 taxonomy.json，并在二次导出时跳过覆盖（覆盖 tags/category 分支）", () => {
  withTempDir((root) => {
    const dataJs = `(() => {
      const data = {
        version: "20260127-1",
        site: { name: "站点", tagline: "tag", description: "desc" },
        games: {
          g1: { title: "x", tags: ["Boss", "", " boss "] }
        },
        guides: {
          guide1: { title: "y", tags: ["GuideTag"] }
        },
        topics: {
          topic1: { title: "t", starter: "u", summary: "s", category: "资讯", replies: 1, updated: "2025-12-21", tags: ["TopicTag"] }
        }
      };
      window.GKB = window.GKB || {};
      window.GKB.data = data;
    })();\n`;
    fs.writeFileSync(path.join(root, "data.js"), dataJs, "utf8");

    const outDir = path.join(root, "content");
    const r1 = exportContent({ workspaceRoot: root, outDir });
    assert.equal(r1.ok, true);
    assert.equal(r1.errors.length, 0);

    const taxonomyPath = path.join(outDir, "taxonomy.json");
    assert.ok(fs.existsSync(taxonomyPath));
    const firstTaxonomy = fs.readFileSync(taxonomyPath, "utf8");
    assert.ok(firstTaxonomy.includes("\"Boss\""));
    assert.ok(firstTaxonomy.includes("\"GuideTag\""));
    assert.ok(firstTaxonomy.includes("\"TopicTag\""));
    assert.ok(firstTaxonomy.includes("\"资讯\""));

    // 二次导出：taxonomy.json 已存在时应保持不变（只导出 meta/group）
    const r2 = exportContent({ workspaceRoot: root, outDir });
    assert.equal(r2.ok, true);
    const secondTaxonomy = fs.readFileSync(taxonomyPath, "utf8");
    assert.equal(secondTaxonomy, firstTaxonomy);
  });
});

