export const qs = (selector, root = globalThis.document) => {
  try {
    return root?.querySelector?.(selector) || null;
  } catch (_) {
    return null;
  }
};

export const qsa = (selector, root = globalThis.document) => {
  try {
    return Array.from(root?.querySelectorAll?.(selector) || []);
  } catch (_) {
    return [];
  }
};

