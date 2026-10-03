/**
 * Unit tests must never reach the network (and therefore never the Open Food Facts
 * production server). Tests that need HTTP responses mock `fetch` themselves.
 */
const blockedFetch = (input: unknown): Promise<never> =>
  Promise.reject(new Error(`Network access is disabled in unit tests: ${String(input)}`));

(globalThis as { fetch: unknown }).fetch = blockedFetch;

// The first render of a screen includes module and database initialisation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@testing-library/react-native').configure({ asyncUtilTimeout: 10000 });
