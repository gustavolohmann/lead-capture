import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(root, 'backend', '.env.test'),
  override: true,
});

process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = 'lead_capture_test';
process.env.META_MOCK_MODE = 'true';

export default {
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/backend/e2e/**/*.test.js'],
    setupFiles: ['tests/backend/e2e/setup/env.js'],
    globalSetup: ['tests/backend/e2e/setup/globalSetup.js'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 60000,
  },
};
