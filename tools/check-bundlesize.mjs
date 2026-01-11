import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const toNumberOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

const readBytes = (filePath) => fs.readFileSync(filePath);

const gzipSizeBytes = (buf) => zlib.gzipSync(buf).length;

// 约定：kB 使用十进制（1000 bytes），与 Vite 构建输出一致。
// 为了避免浮点精度导致的 23.075 → 23.07，按 0.01kB = 10 bytes 做整数四舍五入。
const formatKb = (bytes) => {
  const kbTimes100 = Math.round(bytes / 10);
  return (kbTimes100 / 100).toFixed(2);
};

export const validateBundleSize = ({
  workspaceRoot = process.cwd(),
  distDir = path.join(workspaceRoot, "dist"),
  cssBudgetGzipKb = process.env.GKB_BUDGET_CSS_GZIP_KB,
  jsBudgetGzipKb = process.env.GKB_BUDGET_JS_GZIP_KB,
} = {}) => {
  const errors = [];

  const cssBudgetKb = toNumberOrNull(cssBudgetGzipKb) ?? 30;
  const jsBudgetKb = toNumberOrNull(jsBudgetGzipKb) ?? 80;

  const cssPath = path.join(distDir, "gkb.min.css");
  const jsPath = path.join(distDir, "gkb.min.js");

  const requireFile = (label, filePath) => {
    if (!fs.existsSync(filePath)) {
      errors.push(`[BUNDLE] 缺少 ${label}：${path.relative(workspaceRoot, filePath)}`);
    }
  };

  requireFile("CSS bundle", cssPath);
  requireFile("JS bundle", jsPath);

  if (errors.length > 0) {
    errors.push("[BUNDLE] 提示：请先运行 `npm run build:vite` 生成 dist 产物");
    return { ok: false, errors };
  }

  const cssBuf = readBytes(cssPath);
  const jsBuf = readBytes(jsPath);

  const cssGzipBytes = gzipSizeBytes(cssBuf);
  const jsGzipBytes = gzipSizeBytes(jsBuf);

  const cssBudgetBytes = Math.round(cssBudgetKb * 1000);
  const jsBudgetBytes = Math.round(jsBudgetKb * 1000);

  if (cssGzipBytes > cssBudgetBytes) {
    errors.push(
      `[BUNDLE] CSS gzip 超过预算：${formatKb(cssGzipBytes)}kB > ${cssBudgetKb.toFixed(2)}kB`
    );
  }
  if (jsGzipBytes > jsBudgetBytes) {
    errors.push(
      `[BUNDLE] JS gzip 超过预算：${formatKb(jsGzipBytes)}kB > ${jsBudgetKb.toFixed(2)}kB`
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      css: { gzipBytes: cssGzipBytes },
      js: { gzipBytes: jsGzipBytes },
      budgets: { cssBudgetGzipKb: cssBudgetKb, jsBudgetGzipKb: jsBudgetKb },
    };
  }

  return {
    ok: true,
    errors: [],
    css: { gzipBytes: cssGzipBytes },
    js: { gzipBytes: jsGzipBytes },
    budgets: { cssBudgetGzipKb: cssBudgetKb, jsBudgetGzipKb: jsBudgetKb },
  };
};

export const main = ({
  workspaceRoot = process.cwd(),
  stdout = console.log,
  stderr = console.error,
  cssBudgetGzipKb,
  jsBudgetGzipKb,
} = {}) => {
  const r = validateBundleSize({ workspaceRoot, cssBudgetGzipKb, jsBudgetGzipKb });
  if (!r.ok) {
    stderr("❌ Bundle Size 预算门禁未通过：");
    r.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  stdout(
    `✅ Bundle Size 预算门禁通过：css(gzip)=${formatKb(r.css.gzipBytes)}kB <= ${r.budgets.cssBudgetGzipKb.toFixed(
      2
    )}kB, js(gzip)=${formatKb(r.js.gzipBytes)}kB <= ${r.budgets.jsBudgetGzipKb.toFixed(2)}kB`
  );
  return 0;
};

const isRunAsScript = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
};

/* c8 ignore next */
if (isRunAsScript()) {
  process.exit(main());
}
