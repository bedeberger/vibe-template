// E2E (fixture harness): the __ID__ feature card in isolation — real partial,
// real __CARD__, mock API (tests/server.js). Extend with the feature's real
// behaviour; the smoke (tests/e2e-app/smoke.spec.js) already opens it in the app.

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/__ID__-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
});

test('mounts, loads and shows the empty state', async ({ page }) => {
  await expect(page.locator('[x-data="__CARD__"] .card-title')).toHaveText('__LABEL_DE__');
  await expect(page.locator('[x-data="__CARD__"] .card-empty')).toBeVisible();
});
