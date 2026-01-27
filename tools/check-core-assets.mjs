import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const toNumberOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

// 约定：kB 使用十进制（1000 bytes），与 Vite 构建输出一致。
// 为了避免浮点精度导致的 23.075 → 23.07，按 0.01kB = 10 bytes 做整数四舍五入。
const formatKb = (bytes) => {
  const kbTimes100 = Math.round(Number(bytes || 0) / 10);
  return (kbTimes100 / 100).toFixed(2);
};

const gzipSizeBytes = (buf) => zlib.gzipSync(buf).length;

const readBytes = (filePath) => fs.readFileSync(filePath);

const requireFile = (errors, label, relPath, workspaceRoot) => {
  const filePath = path.join(workspaceRoot, relPath);
  if (!fs.existsSync(filePath)) {
    errors.push(`[CORE] 缺少 ${label}：${relPath}`);
    return null;
  }
  return filePath;
};

const measureFile = (filePath) => {
  const buf = readBytes(filePath);
  return { rawBytes: buf.length, gzipBytes: gzipSizeBytes(buf) };
};

export const validateCoreAssets = ({
  workspaceRoot = process.cwd(),
  scriptsBudgetGzipKb = process.env.GKB_BUDGET_SCRIPTS_GZIP_KB,
  stylesBudgetGzipKb = process.env.GKB_BUDGET_STYLES_GZIP_KB,
  bootBudgetGzipKb = process.env.GKB_BUDGET_BOOT_GZIP_KB,
  swBudgetGzipKb = process.env.GKB_BUDGET_SW_GZIP_KB,
  manifestBudgetGzipKb = process.env.GKB_BUDGET_MANIFEST_GZIP_KB,
} = {}) => {
  const errors = [];

  const budgets = {
    scriptsGzipKb: toNumberOrNull(scriptsBudgetGzipKb) ?? 120,
    stylesGzipKb: toNumberOrNull(stylesBudgetGzipKb) ?? 60,
    bootGzipKb: toNumberOrNull(bootBudgetGzipKb) ?? 10,
    swGzipKb: toNumberOrNull(swBudgetGzipKb) ?? 10,
    manifestGzipKb: toNumberOrNull(manifestBudgetGzipKb) ?? 5,
  };

  const scriptsPath = requireFile(errors, "scripts.js", "scripts.js", workspaceRoot);
  const stylesPath = requireFile(errors, "styles.css", "styles.css", workspaceRoot);
  const bootPath = requireFile(errors, "boot.js", "boot.js", workspaceRoot);
  const swPath = requireFile(errors, "sw.js", "sw.js", workspaceRoot);
  const manifestPath = requireFile(errors, "manifest.webmanifest", "manifest.webmanifest", workspaceRoot);

  if (errors.length > 0) return { ok: false, errors, budgets, files: null };

  const scripts = measureFile(scriptsPath);
  const styles = measureFile(stylesPath);
  const boot = measureFile(bootPath);
  const sw = measureFile(swPath);
  const manifest = measureFile(manifestPath);

  const checkBudget = (label, actualGzipBytes, budgetKb) => {
    const budgetBytes = Math.round(Number(budgetKb || 0) * 1000);
    if (actualGzipBytes > budgetBytes) {
      errors.push(`[CORE] ${label} gzip 超过预算：${formatKb(actualGzipBytes)}kB > ${Number(budgetKb).toFixed(2)}kB`);
    }
  };

  checkBudget("scripts.js", scripts.gzipBytes, budgets.scriptsGzipKb);
  checkBudget("styles.css", styles.gzipBytes, budgets.stylesGzipKb);
  checkBudget("boot.js", boot.gzipBytes, budgets.bootGzipKb);
  checkBudget("sw.js", sw.gzipBytes, budgets.swGzipKb);
  checkBudget("manifest.webmanifest", manifest.gzipBytes, budgets.manifestGzipKb);

  if (errors.length > 0) {
    return { ok: false, errors, budgets, files: { scripts, styles, boot, sw, manifest } };
  }

  return { ok: true, errors: [], budgets, files: { scripts, styles, boot, sw, manifest } };
};

export const main = ({
  workspaceRoot = process.cwd(),
  stdout = console.log,
  stderr = console.error,
  scriptsBudgetGzipKb,
  stylesBudgetGzipKb,
  bootBudgetGzipKb,
  swBudgetGzipKb,
  manifestBudgetGzipKb,
} = {}) => {
  const r = validateCoreAssets({
    workspaceRoot,
    scriptsBudgetGzipKb,
    stylesBudgetGzipKb,
    bootBudgetGzipKb,
    swBudgetGzipKb,
    manifestBudgetGzipKb,
  });

  if (!r.ok) {
    stderr("❌ Core Assets 预算门禁未通过：");
    r.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  const f = r.files;
  stdout(
    `✅ Core Assets 预算门禁通过：scripts(gzip)=${formatKb(f.scripts.gzipBytes)}kB <= ${r.budgets.scriptsGzipKb.toFixed(
      2
    )}kB, styles(gzip)=${formatKb(f.styles.gzipBytes)}kB <= ${r.budgets.stylesGzipKb.toFixed(
      2
    )}kB, sw(gzip)=${formatKb(f.sw.gzipBytes)}kB <= ${r.budgets.swGzipKb.toFixed(2)}kB`
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

