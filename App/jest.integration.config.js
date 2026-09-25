/**
 * Opt-in integration tests against the Open Food Facts STAGING server
 * (world.openfoodfacts.net). Never points at production.
 * Run with: npm run test:integration
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  setupFiles: [],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 30000,
};
