declare let global: Omit<typeof globalThis, 'fetch'> & {
  fetch: (...args: unknown[]) => unknown;
};
