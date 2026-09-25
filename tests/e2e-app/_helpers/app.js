'use strict';
// Shared helpers for every spec against the REAL app (playwright.app.config.js).
// The boot sequence is SSoT here, not copied per spec: it depends on root
// internals (`ready`, the partial injection) that move during refactors — then
// one place breaks, not every spec.

// Load the SPA and wait until the root reports ready (i18n + initial data).
async function bootApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitBooted(page);
}

async function waitBooted(page) {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('.app-shell');
      return !!(root && window.Alpine && window.Alpine.$data(root).ready);
    },
    null,
    { timeout: 30000 },
  );
}

module.exports = { bootApp, waitBooted };
