import { defineConfig, devices } from '@playwright/test';

const API_PORT = process.env.E2E_API_PORT || '3011';
const WEB_PORT = process.env.E2E_WEB_PORT || '5174';

export default defineConfig({
  testDir: './tests/frontend/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: `node --env-file=backend/.env.test backend/src/server.js`,
          url: `http://localhost:${API_PORT}/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            DATABASE_NAME: 'lead_capture_test',
            META_MOCK_MODE: 'true',
            APP_PORT: API_PORT,
            FRONTEND_URL: `http://localhost:${WEB_PORT}`,
          },
        },
        {
          command: `npm run dev --prefix frontend -- --port ${WEB_PORT} --strictPort`,
          url: `http://localhost:${WEB_PORT}`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_API_URL: `http://localhost:${API_PORT}/api`,
          },
        },
      ],
});
