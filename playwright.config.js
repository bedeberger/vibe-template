// E2E: isolated FIXTURE HARNESSES (tests/fixtures/*-harness.html) against the
// static mock server tests/server.js — the real modules and partials, but no
// backend, no DB, no auth. Fast and deterministic; for DOM/module logic.
// Everything that depends on the real backend or the complete template tree
// runs in playwright.app.config.js (tests/e2e-app/). Which layer when:
// docs/testing.md.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3210;

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  // Fixed small worker count instead of Playwright's default (half the cores):
  // a dozen parallel Chromiums on a big box trigger the OOM killer, which then
  // hits the editor the run was started from. Override: `-- --workers=4`.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 0,
  timeout: 30000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `node tests/server.js`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/tests/fixtures/notes-harness.html`,
    reuseExistingServer: !process.env.CI,
  },
});
