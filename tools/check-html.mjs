import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const listRootHtmlFiles = (workspaceRoot) =>
  fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const has = (content, re) => re.test(content);

const checkHeadBasics = (fileName, content, errors) => {
  const required = [
    { label: "charset", re: /<meta\s+charset="utf-8"\s*>/i },
    { label: "viewport", re: /<meta\s+name="viewport"\s+content="[^"]+"\s*>/i },
    { label: "description", re: /<meta\s+name="description"\s+content="[^"]+"\s*>/i },
    { label: "theme-color", re: /<meta\s+name="theme-color"\s+content="[^"]+"\s*>/i },
    { label: "manifest", re: /<link\s+rel="manifest"\s+href="manifest\.webmanifest\?v=[^"]+"\s*>/i },
    { label: "boot", re: /<script\s+src="boot\.js\?v=[^"]+"\s*>\s*<\/script>/i },
    { label: "CSP", re: /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]+"\s*>/i },
    { label: "referrer", re: /<meta\s+name="referrer"\s+content="[^"]+"\s*>/i },
    { label: "permissions", re: /<meta\s+http-equiv="Permissions-Policy"\s+content="[^"]+"\s*>/i },
  ];

  for (const r of required) {
    if (!has(content, r.re)) {
      errors.push(`[HTML] ${fileName}: 缺少 ${r.label}`);
    }
  }
};

const checkNoInlineScripts = (fileName, content, errors) => {
  // 禁止内联脚本：避免与 CSP 冲突，同时降低 XSS 风险
  const inlineScriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>/gi;
  if (inlineScriptRe.test(content)) {
    errors.push(`[HTML] ${fileName}: 存在内联 <script>（应使用外部文件）`);
  }
};

const checkSkipLink = (fileName, content, errors) => {
  if (!has(content, /<a\s+class="skip-link"\s+href="#main"\s*>/i)) {
    errors.push(`[HTML] ${fileName}: 缺少 skip-link（<a class="skip-link" href="#main">）`);
  }
  if (!has(content, /<main\s+id="main"\s+tabindex="-1"[\s>]/i)) {
    errors.push(`[HTML] ${fileName}: 缺少可聚焦的 main#main（需要 tabindex="-1"）`);
  }
};

const checkImages = (fileName, content, errors) => {
  const imgRe = /<img\b[^>]*>/gi;
  for (const m of content.matchAll(imgRe)) {
    const tag = m[0] || "";
    if (!/\balt\s*=\s*"/i.test(tag)) {
      errors.push(`[HTML] ${fileName}: <img> 缺少 alt 属性（可为空字符串）`);
    }
    if (!/\bloading\s*=\s*"(lazy|eager)"/i.test(tag)) {
      errors.push(`[HTML] ${fileName}: <img> 缺少 loading="lazy|eager"（图片加载策略必须显式声明）`);
    }
    if (!/\bdecoding\s*=\s*"(async|auto|sync)"/i.test(tag)) {
      errors.push(`[HTML] ${fileName}: <img> 缺少 decoding="async|auto|sync"（建议 async）`);
    }
  }
};

export const validateHtml = ({ workspaceRoot = process.cwd() } = {}) => {
  const errors = [];
  let htmlFiles = [];

  try {
    htmlFiles = listRootHtmlFiles(workspaceRoot);
  } catch (err) {
    errors.push(`[HTML] 无法读取目录：${workspaceRoot}`);
    errors.push(`[HTML] ${String(err?.message || err || "unknown error")}`);
    return { ok: false, errors, htmlFiles: [] };
  }

  if (htmlFiles.length === 0) {
    errors.push("[HTML] 未找到根目录 HTML 文件");
    return { ok: false, errors, htmlFiles: [] };
  }

  for (const file of htmlFiles) {
    const content = readText(path.join(workspaceRoot, file));
    checkHeadBasics(file, content, errors);
    checkNoInlineScripts(file, content, errors);
    checkSkipLink(file, content, errors);
    checkImages(file, content, errors);
  }

  if (errors.length > 0) return { ok: false, errors, htmlFiles };
  return { ok: true, errors: [], htmlFiles };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const result = validateHtml({ workspaceRoot });
  if (!result.ok) {
    stderr("❌ HTML 结构检查未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout(`✅ HTML 结构检查通过：扫描 HTML=${result.htmlFiles.length}`);
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
