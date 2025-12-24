import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const readText = (filePath) => fs.readFileSync(filePath, "utf8");
export const writeText = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

export const normalizeBase = (base) => {
  const raw = String(base || "").trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw : `${raw}/`;
};

export const buildUrl = (base, pathAndQuery) => {
  const b = normalizeBase(base);
  return `${b}${String(pathAndQuery || "").replace(/^\//, "")}`;
};

export const escapeXml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const parseSitemapUrlFromRobots = (robots) => {
  const m = String(robots || "").match(/^Sitemap:\s*(\S+)\s*$/im);
  return m ? m[1] : "";
};

export const baseFromSitemapUrl = (sitemapUrl) => {
  try {
    const u = new URL(String(sitemapUrl || ""));
    if (!u.pathname.endsWith("sitemap.xml")) return "";
    const basePath = u.pathname.replace(/sitemap\.xml$/i, "");
    return normalizeBase(`${u.origin}${basePath}`);
  } catch (_) {
    return "";
  }
};

export const listRootHtml = ({ workspaceRoot = process.cwd() } = {}) => {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
    .map((d) => d.name)
    .sort();
};

export const loadDataFromDataJs = ({ workspaceRoot = process.cwd() } = {}) => {
  const dataPath = path.join(workspaceRoot, "data.js");
  if (!fs.existsSync(dataPath)) return null;

  const code = readText(dataPath);
  const context = { window: { GKB: {} } };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "data.js" });
  return context.window?.GKB?.data || null;
};

