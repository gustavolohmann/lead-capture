import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default {
  test: {
    globals: false,
    environment: 'node',
    include: [
      'frontend/src/**/__tests__/**/*.test.js',
      'backend/src/**/__tests__/**/*.test.js',
    ],
    root,
  },
};
