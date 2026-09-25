// Smoke against the REAL app: boot the complete SPA and open every feature from
// the registry without a single unhandled browser error.
//
// Why this layer exists: Alpine swallows template expression errors (logs +
// re-throws async), so unit/integration never see them and a fixture harness
// only sees its one component. Only a real browser over the COMPLETE template
// tree catches a broken $data wiring, a missing t() key or method in a template.
// The feature list comes from public/js/app/features.js at runtime — a new
// feature is in the smoke automatically, no drift.
//
// Pure "renders without crashing" — behaviour assertions belong in other specs.

const { test, expect } = require('../e2e/_helpers/fixtures');
const { bootApp } = require('./_helpers/app');

test('SPA boots without console errors', async ({ page }) => {
  await bootApp(page);
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('every registry feature opens without console errors', async ({ page }) => {
  await bootApp(page);
  const features = await page.evaluate(async () => (await import('/js/app/features.js')).FEATURES);
  expect(features.length, 'at least one feature in the registry').toBeGreaterThan(0);
  await expect(page.locator('.nav-item')).toHaveCount(features.length);

  for (const [i, f] of features.entries()) {
    await page.locator('.nav-item').nth(i).click();
    await expect(page.locator('.nav-item').nth(i)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`section[data-partial="${f.view}-view"]`), `view of feature ${f.id}`).toBeVisible();
  }
});
