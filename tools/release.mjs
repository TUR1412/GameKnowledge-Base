import { spawnSync } from "node:child_process";

const runNode = (args, { cwd = process.cwd() } = {}) => {
  const r = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  if (r.error) throw r.error;
  return r.status ?? 1;
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { check: args.has("--check") };
};

const main = () => {
  const { check } = parseArgs();

  if (check) {
    // CI / gate-only mode: no writes
    return runNode(["tools/check-all.mjs"]);
  }

  const steps = [
    ["tools/build-data.mjs"],
    ["tools/inject-seo.mjs"],
    ["tools/bump-version.mjs"],
    ["tools/generate-sitemap.mjs"],
    ["tools/generate-feed.mjs"],
    ["tools/check-all.mjs"],
  ];

  for (const args of steps) {
    const code = runNode(args);
    if (code !== 0) return code;
  }

  return 0;
};

process.exit(main());

