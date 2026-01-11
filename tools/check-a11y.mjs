import path from "node:path";
import { pathToFileURL } from "node:url";

import { listRootHtml, readText } from "./lib/site.mjs";

const findTag = (content, tagName) => {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "i");
  const m = String(content || "").match(re);
  return m ? m[0] : "";
};

const extractAttr = (tag, attrName) => {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*([\"'])([^\"']*)\\1`, "i");
  const m = String(tag || "").match(re);
  return m ? String(m[2] || "") : "";
};

const hasInlineStyle = (content) => /<style\b/i.test(content) || /\sstyle\s*=\s*["']/i.test(content);

const hasInlineHandler = (content) => /\son\w+\s*=\s*["']/i.test(content);

const checkActiveNavAriaCurrent = (fileName, content, errors) => {
  const m = String(content || "").match(
    /<nav\b[^>]*\bid=["']site-nav["'][^>]*>([\s\S]*?)<\/nav>/i
  );
  if (!m) return;

  const navInner = String(m[1] || "");
  const activeLinkRe = /<a\b[^>]*\bclass=["'][^"']*\bactive\b[^"']*["'][^>]*>/gi;
  for (const hit of navInner.matchAll(activeLinkRe)) {
    const tag = hit[0] || "";
    if (!/\baria-current\s*=\s*["']page["']/i.test(tag)) {
      errors.push(`[A11Y] ${fileName}: 主导航当前页链接缺少 aria-current="page"`);
    }
  }
};

export const validateA11y = ({ workspaceRoot = process.cwd() } = {}) => {
  const errors = [];
  let htmlFiles = [];

  try {
    htmlFiles = listRootHtml({ workspaceRoot });
  } catch (err) {
    errors.push(`[A11Y] 无法读取目录：${workspaceRoot}`);
    errors.push(`[A11Y] ${String(err?.message || err || "unknown error")}`);
    return { ok: false, errors, htmlFiles: [] };
  }

  if (htmlFiles.length === 0) {
    errors.push("[A11Y] 未找到根目录 HTML 文件");
    return { ok: false, errors, htmlFiles: [] };
  }

  for (const fileName of htmlFiles) {
    const content = readText(path.join(workspaceRoot, fileName));

    const htmlTag = findTag(content, "html");
    const lang = extractAttr(htmlTag, "lang");
    if (!lang.trim()) {
      errors.push(`[A11Y] ${fileName}: <html> 缺少 lang 属性（例如 lang="zh-CN"）`);
    }

    const titleRe = /<title>([\s\S]*?)<\/title>/i;
    const mTitle = String(content || "").match(titleRe);
    const title = mTitle ? String(mTitle[1] || "").trim() : "";
    if (!title) {
      errors.push(`[A11Y] ${fileName}: 缺少 <title> 或标题为空`);
    }

    const metaDescTag = (() => {
      const re = /<meta\b[^>]*\bname=["']description["'][^>]*>/i;
      const m = String(content || "").match(re);
      return m ? m[0] : "";
    })();
    const desc = extractAttr(metaDescTag, "content").trim();
    if (!desc) {
      errors.push(`[A11Y] ${fileName}: 缺少 meta description 或 content 为空`);
    }

    // CSP 兼容：当前站点默认 CSP 禁止 inline style 与 inline handler
    if (hasInlineStyle(content)) {
      errors.push(`[A11Y] ${fileName}: 检测到 inline style（<style> 或 style=""），将违反 CSP`);
    }
    if (hasInlineHandler(content)) {
      errors.push(`[A11Y] ${fileName}: 检测到 on* 事件属性（例如 onclick=""），将违反 CSP`);
    }

    // 主导航语义：当前页应声明 aria-current，增强可访问性与读屏体验
    checkActiveNavAriaCurrent(fileName, content, errors);
  }

  if (errors.length > 0) return { ok: false, errors, htmlFiles };
  return { ok: true, errors: [], htmlFiles };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const r = validateA11y({ workspaceRoot });
  if (!r.ok) {
    stderr("❌ A11y/SEO 基础检查未通过：");
    r.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }
  stdout(`✅ A11y/SEO 基础检查通过：扫描 HTML=${r.htmlFiles.length}`);
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
