import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const stripQueryAndHash = (value) => String(value || "").split(/[?#]/, 1)[0];

const normalizeRelative = (value) => {
  const raw = stripQueryAndHash(value).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "";
  if (raw.startsWith("data:")) return "";
  if (raw.startsWith("//")) return "";
  if (raw.includes("..")) return "";
  return raw.replace(/^[./\\]+/, "");
};

const isHexColor = (value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || "").trim());

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const existsRel = (workspaceRoot, relPath) => fs.existsSync(path.join(workspaceRoot, relPath));

export const validateManifest = ({ workspaceRoot = process.cwd() } = {}) => {
  const errors = [];
  const manifestPath = path.join(workspaceRoot, "manifest.webmanifest");

  if (!fs.existsSync(manifestPath)) {
    errors.push("[MANIFEST] 缺少 manifest.webmanifest");
    return { ok: false, errors, manifest: null };
  }

  let parsed = null;
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    errors.push("[MANIFEST] manifest.webmanifest 不是合法 JSON");
    errors.push(`[MANIFEST] ${String(err?.message || err || "unknown error")}`);
    return { ok: false, errors, manifest: null };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push("[MANIFEST] manifest.webmanifest 必须是 JSON object");
    return { ok: false, errors, manifest: null };
  }

  const requireField = (key) => {
    if (!isNonEmptyString(parsed[key])) errors.push(`[MANIFEST] 缺少字段：${key}`);
  };

  requireField("name");
  requireField("short_name");
  requireField("description");
  requireField("start_url");
  requireField("scope");
  requireField("display");
  requireField("background_color");
  requireField("theme_color");

  const allowedDisplays = new Set(["fullscreen", "standalone", "minimal-ui", "browser"]);
  if (isNonEmptyString(parsed.display) && !allowedDisplays.has(parsed.display)) {
    errors.push(`[MANIFEST] display 值非法：${parsed.display}`);
  }

  if (isNonEmptyString(parsed.theme_color) && !isHexColor(parsed.theme_color)) {
    errors.push(`[MANIFEST] theme_color 应为 hex 颜色：${parsed.theme_color}`);
  }
  if (isNonEmptyString(parsed.background_color) && !isHexColor(parsed.background_color)) {
    errors.push(`[MANIFEST] background_color 应为 hex 颜色：${parsed.background_color}`);
  }

  const startUrl = normalizeRelative(parsed.start_url);
  if (isNonEmptyString(parsed.start_url) && !startUrl) {
    errors.push(`[MANIFEST] start_url 非法或包含外链：${parsed.start_url}`);
  } else if (startUrl && !existsRel(workspaceRoot, startUrl)) {
    errors.push(`[MANIFEST] start_url 指向不存在资源：${startUrl}`);
  }

  const icons = parsed.icons;
  if (!Array.isArray(icons) || icons.length === 0) {
    errors.push("[MANIFEST] icons 必须是非空数组");
  } else {
    icons.forEach((icon, idx) => {
      if (!icon || typeof icon !== "object") {
        errors.push(`[MANIFEST] icons[${idx}] 必须是 object`);
        return;
      }
      if (!isNonEmptyString(icon.src)) {
        errors.push(`[MANIFEST] icons[${idx}].src 缺失`);
        return;
      }
      const rel = normalizeRelative(icon.src);
      if (!rel) {
        errors.push(`[MANIFEST] icons[${idx}].src 非法或包含外链：${icon.src}`);
        return;
      }
      if (!existsRel(workspaceRoot, rel)) {
        errors.push(`[MANIFEST] icons[${idx}].src 引用不存在资源：${rel}`);
      }
    });
  }

  const shortcuts = parsed.shortcuts;
  if (shortcuts !== undefined) {
    if (!Array.isArray(shortcuts)) {
      errors.push("[MANIFEST] shortcuts 必须是数组（如存在）");
    } else {
      shortcuts.forEach((s, idx) => {
        if (!s || typeof s !== "object") {
          errors.push(`[MANIFEST] shortcuts[${idx}] 必须是 object`);
          return;
        }
        if (!isNonEmptyString(s.url)) {
          errors.push(`[MANIFEST] shortcuts[${idx}].url 缺失`);
          return;
        }
        const rel = normalizeRelative(s.url);
        if (!rel) {
          errors.push(`[MANIFEST] shortcuts[${idx}].url 非法或包含外链：${s.url}`);
          return;
        }
        if (!existsRel(workspaceRoot, rel)) {
          errors.push(`[MANIFEST] shortcuts[${idx}].url 指向不存在资源：${rel}`);
        }

        if (Array.isArray(s.icons)) {
          s.icons.forEach((icon, iconIdx) => {
            if (!icon || typeof icon !== "object") {
              errors.push(`[MANIFEST] shortcuts[${idx}].icons[${iconIdx}] 必须是 object`);
              return;
            }
            if (!isNonEmptyString(icon.src)) {
              errors.push(`[MANIFEST] shortcuts[${idx}].icons[${iconIdx}].src 缺失`);
              return;
            }
            const relIcon = normalizeRelative(icon.src);
            if (!relIcon) {
              errors.push(
                `[MANIFEST] shortcuts[${idx}].icons[${iconIdx}].src 非法或包含外链：${icon.src}`
              );
              return;
            }
            if (!existsRel(workspaceRoot, relIcon)) {
              errors.push(`[MANIFEST] shortcuts[${idx}].icons[${iconIdx}].src 引用不存在资源：${relIcon}`);
            }
          });
        }
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors, manifest: parsed };
  return { ok: true, errors: [], manifest: parsed };
};

export const main = ({ workspaceRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) => {
  const result = validateManifest({ workspaceRoot });
  if (!result.ok) {
    stderr("❌ Manifest 检查未通过：");
    result.errors.forEach((e) => stderr(`- ${e}`));
    return 1;
  }

  const iconsCount = Array.isArray(result.manifest?.icons) ? result.manifest.icons.length : 0;
  const shortcutsCount = Array.isArray(result.manifest?.shortcuts) ? result.manifest.shortcuts.length : 0;
  stdout(`✅ Manifest 检查通过：icons=${iconsCount}, shortcuts=${shortcutsCount}`);
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

