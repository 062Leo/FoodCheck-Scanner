/**
 * Unit test configuration. Network access is blocked (see jest.setup.ts);
 * tests that talk to the Open Food Facts staging server live in
 * `*.integration.test.ts` files and run only via `npm run test:integration`.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Screen tests render real components on a real SQLite database; allow slow CI machines.
  testTimeout: 20000,
  testPathIgnorePatterns: ['/node_modules/', '[.]integration[.]test[.]tsx?$'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
