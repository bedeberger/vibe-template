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

// Two views (docs/auth.md): the nav shows only the current view's features.
// The dev user is admin under LOCAL_DEV_MODE, so both views are reachable;
// openInNav switches the view via the header switch, then clicks the entry.
async function openInNav(page, features, f) {
  const inView = features.filter((x) => x.view === f.view);
  const current = await page.evaluate(() => window.Alpine.$data(document.querySelector('.app-shell')).view);
  if (current !== f.view) {
    await page.locator('.site-header-aside .tabs-btn').nth(f.view === 'admin' ? 1 : 0).click();
    await expect(page.locator('.nav-item')).toHaveCount(inView.length);
  }
  const item = page.locator('.nav-item').nth(inView.indexOf(f));
  await item.click();
  return item;
}

test('every registry feature opens without console errors', async ({ page }) => {
  await bootApp(page);
  const features = await page.evaluate(async () => (await import('/js/app/features.js')).FEATURES);
  expect(features.length, 'at least one feature in the registry').toBeGreaterThan(0);
  await expect(page.locator('.nav-item')).toHaveCount(features.filter((f) => f.view === 'user').length);

  for (const f of features) {
    const item = await openInNav(page, features, f);
    await expect(item).toHaveAttribute('aria-current', 'page');
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
// As a touch device (pointer: coarse), because the tap-target rule hangs on it:
// icon-only buttons must reach 40px (DESIGN.md → Mobile) — a more specific
// `min-width` in a cluster rule silently shrinks them back to 28px.
// The DoD Stop hook names this spec as the phone-viewport coverage.
test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test('every registry feature fits 360px without horizontal scroll', async ({ page }) => {
    await bootApp(page);
    const features = await page.evaluate(async () => (await import('/js/app/features.js')).FEATURES);
    for (const f of features) {
      await openInNav(page, features, f);
      await expect(page.locator(`section[data-feature="${f.id}"] [x-data="${f.card}"]`)).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `feature ${f.id} overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
      const small = await page.evaluate(() => [...document.querySelectorAll('.icon-btn, .btn-card-close, .btn-close, .job-toast-close')]
        .filter((el) => el.checkVisibility())
        .map((el) => ({ el, b: el.getBoundingClientRect() }))
        .filter(({ b }) => b.width < 39.5 || b.height < 39.5) // subpixel layout
        .map(({ el, b }) => `${el.getAttribute('aria-label')} ${Math.round(b.width)}x${Math.round(b.height)}`));
      expect(small, `feature ${f.id}: icon-only tap targets below 40px`).toEqual([]);
    }
  });
});
