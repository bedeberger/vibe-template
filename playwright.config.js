// E2E config: drives the real app in a browser against an isolated temp DB.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const PORT = 3210;
const DB = path.join(__dirname, 'tests', '.tmp', 'e2e.db');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      LOCAL_DEV_MODE: '1',
      DB_PATH: DB,
      SESSION_SECRET: 'e2e-secret',
    },
  },
});
