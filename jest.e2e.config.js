/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/backend/e2e'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/tests/backend/e2e/setup/env.js'],
  globalSetup: '<rootDir>/tests/backend/e2e/setup/globalSetup.js',
  transform: {},
  testTimeout: 60000,
  maxWorkers: 1,
  verbose: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
