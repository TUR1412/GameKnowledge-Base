import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const listRootHtmlFiles = () =>
  fs
    .readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();

const has = (content, re) => re.test(content);

const errors = [];

const checkHeadBasics = (fileName, content) => {
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

const checkNoInlineScripts = (fileName, content) => {
  // 禁止内联脚本：避免与 CSP 冲突，同时降低 XSS 风险
  const inlineScriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>/gi;
  if (inlineScriptRe.test(content)) {
    errors.push(`[HTML] ${fileName}: 存在内联 <script>（应使用外部文件）`);
  }
};

const checkSkipLink = (fileName, content) => {
  if (!has(content, /<a\s+class="skip-link"\s+href="#main"\s*>/i)) {
    errors.push(`[HTML] ${fileName}: 缺少 skip-link（<a class="skip-link" href="#main">）`);
  }
  if (!has(content, /<main\s+id="main"\s+tabindex="-1"[\s>]/i)) {
    errors.push(`[HTML] ${fileName}: 缺少可聚焦的 main#main（需要 tabindex="-1"）`);
  }
};

const checkImages = (fileName, content) => {
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

const main = () => {
  const htmlFiles = listRootHtmlFiles();
  if (htmlFiles.length === 0) {
    console.error("❌ 未找到根目录 HTML 文件");
    process.exit(1);
  }

  for (const file of htmlFiles) {
    const content = readText(path.join(WORKSPACE_ROOT, file));
    checkHeadBasics(file, content);
    checkNoInlineScripts(file, content);
    checkSkipLink(file, content);
    checkImages(file, content);
  }

  if (errors.length > 0) {
    console.error("❌ HTML 结构检查未通过：");
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log(`✅ HTML 结构检查通过：扫描 HTML=${htmlFiles.length}`);
};

main();
