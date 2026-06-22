// Smoke config: boots the real app and checks each main view opens cleanly.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const PORT = 3211;
const DB = path.join(__dirname, 'tests', '.tmp', 'smoke.db');

module.exports = defineConfig({
  testDir: './tests/smoke',
  timeout: 30000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      LOCAL_DEV_MODE: '1',
      DB_PATH: DB,
      SESSION_SECRET: 'smoke-secret',
    },
  },
});
