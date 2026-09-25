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
    const host = page.locator(`section[data-feature="${f.id}"]`);
    await expect(host, `host of feature ${f.id}`).toBeVisible();
    // The lazily loaded partial mounted its feature card.
    await expect(host.locator(`[x-data="${f.card}"]`), `card ${f.card} of feature ${f.id}`).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`#${f.id}$`));
  }
});

test('a deep link opens its feature directly', async ({ page }) => {
  const features = await (async () => { await page.goto('/'); return page.evaluate(async () => (await import('/js/app/features.js')).FEATURES); })();
  const last = features.at(-1);
  await page.goto(`/#${last.id}`);
  await expect(page.locator(`section[data-feature="${last.id}"] [x-data="${last.card}"]`)).toHaveCount(1);
  await expect(page.locator('.nav-item[aria-current="page"]')).toHaveCount(1);
});

// Phone width: every feature opens without horizontal overflow — the most
// common silent mobile break (a fixed px width, a table without scroll box).
// The DoD Stop hook names this spec as the phone-viewport coverage.
test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('every registry feature fits 360px without horizontal scroll', async ({ page }) => {
    await bootApp(page);
    const features = await page.evaluate(async () => (await import('/js/app/features.js')).FEATURES);
    for (const [i, f] of features.entries()) {
      await page.locator('.nav-item').nth(i).click();
      await expect(page.locator(`section[data-feature="${f.id}"] [x-data="${f.card}"]`)).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `feature ${f.id} overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
    }
  });
});
