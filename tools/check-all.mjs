import { spawnSync } from "node:child_process";

const run = (cmd, args, { cwd = process.cwd() } = {}) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.error) throw r.error;
  return r.status ?? 1;
};

const main = () => {
  const checks = [
    // JS syntax
    ["node", ["--check", "boot.js"]],
    ["node", ["--check", "scripts.js"]],
    ["node", ["--check", "data.js"]],
    ["node", ["--check", "sw.js"]],
    ["node", ["--check", "tools/check-all.mjs"]],
    ["node", ["--check", "tools/check-links.mjs"]],
    ["node", ["--check", "tools/check-html.mjs"]],
    ["node", ["--check", "tools/check-sitemap.mjs"]],
    ["node", ["--check", "tools/check-sw.mjs"]],
    ["node", ["--check", "tools/bump-version.mjs"]],
    ["node", ["--check", "tools/generate-feed.mjs"]],
    ["node", ["--check", "tools/generate-sitemap.mjs"]],
    ["node", ["--check", "tools/lib/site.mjs"]],
    ["node", ["--check", "tools/validate-data.mjs"]],

    // Unit tests + coverage thresholds (CI parity)
    [
      "node",
      [
        "--test",
        "--experimental-test-coverage",
        "--test-coverage-lines=95",
        "--test-coverage-functions=95",
        "--test-coverage-branches=90",
      ],
    ],

    // Optional: ultimate minify build (kept as a sanity check)
    // 说明：避免 Windows 下 spawn 直接调用 npm/npx 的 .cmd 解析差异，这里直接执行 Vite CLI。
    ["node", ["node_modules/vite/bin/vite.js", "build"]],

    // Site integrity checks (CI parity)
    ["node", ["tools/check-links.mjs"]],
    ["node", ["tools/check-html.mjs"]],
    ["node", ["tools/check-sitemap.mjs"]],
    ["node", ["tools/check-sw.mjs"]],
    ["node", ["tools/generate-feed.mjs", "--check"]],
    ["node", ["tools/validate-data.mjs"]],
  ];

  for (const [cmd, args] of checks) {
    const code = run(cmd, args);
    if (code !== 0) return code;
  }

  return 0;
};

process.exit(main());
