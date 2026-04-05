/** Conditional logger — only logs in development mode */
export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[debug]', ...args);
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[info]', ...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
