import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const existsRel = (workspaceRoot, relPath) => fs.existsSync(path.join(workspaceRoot, relPath));

const hasAny = (content, patterns) => patterns.some((p) => (p instanceof RegExp ? p.test(content) : content.includes(String(p))));

export const validateRuntime = ({ workspaceRoot = process.cwd() } = {}) => {
  const errors = [];

  const requiredFiles = ["scripts.js", "styles.css", "dashboard.html"];
  requiredFiles.forEach((file) => {
    if (!existsRel(workspaceRoot, file)) errors.push(`[RUNTIME] 缺少关键文件：${file}`);
  });

  if (errors.length > 0) return { ok: false, errors };

  const scripts = readText(path.join(workspaceRoot, "scripts.js"));
  const styles = readText(path.join(workspaceRoot, "styles.css"));
  const dashboard = readText(path.join(workspaceRoot, "dashboard.html"));

  const requireInFile = (label, content, checks) => {
    checks.forEach((c) => {
      const ok = hasAny(content, c.patterns);
      if (!ok) errors.push(`[RUNTIME] ${label}: 缺少 ${c.name}`);
    });
  };

  requireInFile("scripts.js", scripts, [
    { name: "Error Boundary(initErrorBoundary)", patterns: [/const\s+initErrorBoundary\s*=\s*\(\)\s*=>/i, "initErrorBoundary"] },
    { name: "Diagnostics(openDiagnosticsDialog)", patterns: [/openDiagnosticsDialog/i, "openDiagnosticsDialog"] },
    { name: "Diagnostics Key(gkb-diagnostics-errors)", patterns: ["gkb-diagnostics-errors"] },
    { name: "Logs Key(gkb-diagnostics-logs)", patterns: ["gkb-diagnostics-logs"] },
    { name: "Logger Exposure(GKB.runtime.logger)", patterns: [/runtime\.logger/i, "GKB.runtime.logger"] },
  ]);

  requireInFile("styles.css", styles, [
    { name: "Diagnostics Panel(.diag-panel)", patterns: [/\.diag-panel\b/, "diag-panel"] },
    { name: "Diagnostics Root(.diag-root)", patterns: [/\.diag-root\b/, "diag-root"] },
  ]);

  requireInFile("dashboard.html", dashboard, [
    { name: "Diagnostics Card(#dash-diagnostics)", patterns: ['id="dash-diagnostics"', "dash-diagnostics"] },
    { name: "Diagnostics Open Button(#dash-diag-open)", patterns: ['id="dash-diag-open"', "dash-diag-open"] },
    { name: "Diagnostics Export Button(#dash-diag-export)", patterns: ['id="dash-diag-export"', "dash-diag-export"] },
  ]);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [] };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const result = validateRuntime({ workspaceRoot });
  if (!result.ok) {
    stderr("❌ Runtime 关键能力检查未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout("✅ Runtime 关键能力检查通过（诊断/日志/面板/入口齐全）");
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

