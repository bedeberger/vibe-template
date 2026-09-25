// E2E-APP: the REAL app (`node server.js`, LOCAL_DEV_MODE=1 → auth bypassed,
// lib/dev-seed.js seeds a notebook) on a throwaway DB that is deleted before
// every run. tests/e2e-app/smoke.spec.js opens every registry feature under the
// console-error guard; the other specs cover behaviour that needs the real
// backend or the complete template tree/CSS. Which layer when: docs/testing.md.
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PORT = 3211;
const DB = path.join(__dirname, 'tests', '.tmp', 'e2e-app.db');

// Fresh seed per run (the config is evaluated once per run, before the server).
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });

module.exports = defineConfig({
  testDir: './tests/e2e-app',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  // The specs share ONE seed state within a run.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 30000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      LOCAL_DEV_MODE: '1',
      DB_PATH: DB,
      LOG_PATH: path.join(__dirname, 'tests', '.tmp', 'e2e-app.log'),
      SESSION_SECRET: 'e2e-app-secret-do-not-use-in-prod',
    },
  },
});
