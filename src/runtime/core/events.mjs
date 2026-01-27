export const on = (target, type, handler, options) => {
  try {
    target?.addEventListener?.(type, handler, options);
    return () => {
      try {
        target?.removeEventListener?.(type, handler, options);
      } catch (_) {}
    };
  } catch (_) {
    return () => {};
  }
};

export const once = (target, type, handler, options) => {
  const opts = { ...(options || {}), once: true };
  return on(target, type, handler, opts);
};

