/* Motion (Lite) - WAAPI 轻量适配层
 *
 * 目标：
 * - 提供最小可用的 `Motion.animate()` 与 `Motion.stagger()`，满足本项目动效需求
 * - 避免引入臃肿的第三方包（减小体积、加快首屏解析）
 * - 安全降级：浏览器不支持 WAAPI 时直接 no-op（由上层兜底）
 *
 * 说明：
 * - `duration` / `delay` 单位：秒（与之前 Motion API 兼容）
 * - `easing` 支持：CSS easing 字符串，或 [x1, y1, x2, y2] 形式的 cubic-bezier 数组
 * - transform 支持：x/y/scale/rotate（会合成为 transform；并尽量保留点击当下的 CSS transform）
 */

(() => {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : window;
  const Motion = (root.Motion = root.Motion || {});

  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

  const toMs = (seconds) => {
    const n = Number(seconds);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 1000));
  };

  const toCssEasing = (easing) => {
    if (
      Array.isArray(easing) &&
      easing.length === 4 &&
      easing.every((x) => typeof x === "number" && Number.isFinite(x))
    ) {
      const [x1, y1, x2, y2] = easing;
      return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    }
    if (typeof easing === "string" && easing.trim()) return easing.trim();
    return "linear";
  };

  const normalizeTargets = (target) => {
    if (!target) return [];

    if (typeof target === "string") {
      try {
        return Array.from(document.querySelectorAll(target));
      } catch (_) {
        return [];
      }
    }

    if (target instanceof Element) return [target];

    // Array / NodeList / HTMLCollection
    if (Array.isArray(target) || (typeof target.length === "number" && typeof target !== "function")) {
      try {
        return Array.from(target).filter((x) => x instanceof Element);
      } catch (_) {
        return [];
      }
    }

    return [];
  };

  const pick = (value, index) => {
    if (!Array.isArray(value)) return value;
    if (value.length === 0) return undefined;
    return value[Math.min(index, value.length - 1)];
  };

  const withUnit = (value, unit) => {
    if (value == null) return null;
    if (isFiniteNumber(value)) return `${value}${unit}`;
    const s = String(value).trim();
    if (!s) return null;
    return s;
  };

  const buildTransform = (base, frame) => {
    const parts = [];

    const baseStr = String(base || "").trim();
    if (baseStr && baseStr !== "none") parts.push(baseStr);

    // 若显式提供 transform，则优先使用（但仍保留 base）
    if (Object.prototype.hasOwnProperty.call(frame, "transform")) {
      const t = String(frame.transform || "").trim();
      if (t && t !== "none") parts.push(t);
      return parts.length ? parts.join(" ") : undefined;
    }

    const x = frame.x;
    const y = frame.y;
    const scale = frame.scale;
    const rotate = frame.rotate;

    const hasXY = x != null || y != null;
    if (hasXY) {
      const tx = withUnit(x ?? 0, "px") ?? "0px";
      const ty = withUnit(y ?? 0, "px") ?? "0px";
      parts.push(`translate(${tx}, ${ty})`);
    }

    if (scale != null) parts.push(`scale(${scale})`);

    if (rotate != null) {
      const r = withUnit(rotate, "deg") ?? "0deg";
      parts.push(`rotate(${r})`);
    }

    return parts.length ? parts.join(" ") : undefined;
  };

  const normalizeKeyframes = (keyframes, baseTransform) => {
    if (!keyframes) return [];
    if (Array.isArray(keyframes)) return keyframes;

    const keys = Object.keys(keyframes);
    let count = 0;

    for (const k of keys) {
      const v = keyframes[k];
      if (Array.isArray(v)) count = Math.max(count, v.length);
    }
    if (count === 0) count = 1;

    const frames = [];
    for (let i = 0; i < count; i += 1) {
      const frame = {};

      for (const k of keys) {
        const v = pick(keyframes[k], i);
        if (v !== undefined) frame[k] = v;
      }

      const transform = buildTransform(baseTransform, frame);
      if (transform !== undefined) frame.transform = transform;

      // 移除 motion-only 的快捷字段，避免污染 WAAPI
      delete frame.x;
      delete frame.y;
      delete frame.scale;
      delete frame.rotate;

      frames.push(frame);
    }

    return frames;
  };

  const safeFinished = (anim) => {
    try {
      const p = anim?.finished;
      if (p && typeof p.then === "function") return p.catch(() => {});
    } catch (_) {}
    return Promise.resolve();
  };

  Motion.animate = (target, keyframes, options = {}) => {
    const elements = normalizeTargets(target);
    if (elements.length === 0) return null;

    const first = elements[0];
    if (!first || typeof first.animate !== "function") return null;

    const duration = toMs(options.duration);
    const easing = toCssEasing(options.easing);
    const fill = options.fill || "both";

    const delayOpt = options.delay;
    const direction = options.direction;
    const iterations = options.iterations;

    const animations = [];

    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i];
      if (!el || typeof el.animate !== "function") continue;

      const baseTransform = (() => {
        try {
          return getComputedStyle(el).transform || "";
        } catch (_) {
          return "";
        }
      })();

      const frames = normalizeKeyframes(keyframes, baseTransform);

      const delaySeconds = typeof delayOpt === "function" ? delayOpt(i, elements.length) : delayOpt;
      const delay = toMs(delaySeconds);

      const waapiOptions = { duration, delay, easing, fill };
      if (direction != null) waapiOptions.direction = direction;
      if (iterations != null) waapiOptions.iterations = iterations;

      try {
        const anim = el.animate(frames, waapiOptions);
        animations.push(anim);
      } catch (_) {
        // ignore
      }
    }

    if (animations.length === 0) return null;
    if (animations.length === 1) return animations[0];

    // 与 Motion 的“返回控制对象”行为对齐：至少提供 finished
    return {
      animations,
      finished: Promise.allSettled(animations.map(safeFinished)).then(() => {}),
    };
  };

  Motion.stagger = (step = 0.1, { startDelay = 0, from = 0 } = {}) => {
    const stepNum = Number(step);
    const startNum = Number(startDelay);
    const safeStep = Number.isFinite(stepNum) ? stepNum : 0;
    const safeStart = Number.isFinite(startNum) ? startNum : 0;

    const originIndex = (total) => {
      const len = Math.max(0, Number(total) || 0);
      if (typeof from === "number" && Number.isFinite(from)) return from;

      const key = String(from || "").trim().toLowerCase();
      if (key === "last") return Math.max(0, len - 1);
      if (key === "center") return (Math.max(0, len - 1)) / 2;
      return 0;
    };

    return (index, total) => {
      const i = Number(index) || 0;
      const o = originIndex(total);
      const dist = Math.abs(o - i);
      return safeStart + safeStep * dist;
    };
  };

  Motion.__lite = true;
})();
