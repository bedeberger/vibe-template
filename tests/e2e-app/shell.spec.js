// App shell against the REAL app (DESIGN.md → "App-Shell", "Benutzermenü",
// "Command Palette"): sidebar rail, admin console switch, theme, command
// palette — and the phone drawer. Covers public/css/layout/app-shell.css,
// public/css/layout/app-nav.css (sidebar rows, user menu, rail),
// public/css/components/command-palette.css, public/js/app/shell.js and
// public/js/theme-boot.js (theme survives a reload). Needs the complete template tree + CSS, so
// it lives here, not in a fixture harness. The dev user is the admin
// (LOCAL_DEV_MODE), so both views are reachable.

const { test, expect } = require('../e2e/_helpers/fixtures');
const { bootApp, waitBooted } = require('./_helpers/app');

const root = (page) => page.evaluate(() => {
  const d = window.Alpine.$data(document.querySelector('.app-shell'));
  return { view: d.view, activeFeature: d.activeFeature, theme: d.theme };
});
const registry = (page) => page.evaluate(async () => (await import('/js/app/features.js')).FEATURES);

test.beforeEach(async ({ page }) => {
  // Per-device preferences start clean for every test.
  await page.addInitScript(() => { if (!sessionStorage.getItem('shell-spec')) { localStorage.clear(); sessionStorage.setItem('shell-spec', '1'); } });
});

test('page title (h1) follows the active feature', async ({ page }) => {
  await bootApp(page);
  const first = (await registry(page))[0];
  const label = await page.locator('.nav-item[aria-current="page"] .sidebar-label').textContent();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1.page-title')).toHaveText(label);
  await expect(page).toHaveURL(new RegExp(`#${first.id}$`));
});

test('sidebar collapses to an icon rail and remembers it', async ({ page }) => {
  await bootApp(page);
  const sidebar = page.locator('.sidebar');
  const wide = (await sidebar.boundingBox()).width;
  await page.locator('.sidebar-toggle').click();
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--collapsed/);
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(wide / 2);
  await expect(page.locator('.nav-item .sidebar-label').first()).toBeHidden();
  // Rail entries carry their label as tooltip.
  await expect(page.locator('.nav-item').first()).toHaveAttribute('data-tip', /.+/);
  await page.reload();
  await waitBooted(page);
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--collapsed/);
});

test('user menu switches into the admin console and back', async ({ page }) => {
  await bootApp(page);
  const features = await registry(page);
  await page.locator('.user-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Admin-Konsole' }).click();
  await expect.poll(async () => (await root(page)).view).toBe('admin');
  await expect(page.locator('.nav-item')).toHaveCount(features.filter((f) => f.view === 'admin').length);
  await expect(page.locator('.topbar-crumb')).toBeVisible();
  await page.locator('.sidebar-back').click();
  await expect.poll(async () => (await root(page)).view).toBe('user');
  await expect(page.locator('.topbar-crumb')).toBeHidden();
});

test('theme choice sets <html data-theme> and survives a reload', async ({ page }) => {
  await bootApp(page);
  await page.locator('.user-menu-trigger').click();
  await page.getByRole('menuitemradio', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await waitBooted(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await root(page)).theme).toBe('dark');
  await page.locator('.user-menu-trigger').click();
  await page.getByRole('menuitemradio', { name: 'Wie System' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('command palette: Ctrl+K opens, typing filters, Enter navigates, Esc closes', async ({ page }) => {
  await bootApp(page);
  const palette = page.locator('.command-palette');
  await page.keyboard.press('Control+k');
  await expect(palette).toBeVisible();
  await expect(page.locator('.command-palette-input')).toBeFocused();
  await page.keyboard.type('Einstell');
  await expect(page.locator('.command-palette-item')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect.poll(async () => (await root(page)).activeFeature).toBe('settings');
  await expect(page.locator('h1.page-title')).toHaveText('Einstellungen');

  await page.locator('.topbar-search').click();
  await expect(palette).toBeVisible();
  await page.keyboard.type('zzzz');
  await expect(page.locator('.command-palette-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test('sidebar is a drawer: menu opens, scrim and navigation close it', async ({ page }) => {
    await bootApp(page);
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).not.toBeInViewport();
    await page.locator('.topbar-menu').click();
    await expect(sidebar).toBeInViewport({ ratio: 1 });
    await page.locator('.sidebar-scrim').click({ position: { x: 350, y: 400 } });
    await expect(sidebar).not.toBeInViewport();

    await page.locator('.topbar-menu').click();
    await page.locator('.nav-item').first().click();
    await expect(sidebar).not.toBeInViewport();
  });

  test('user menu and command palette fit the phone viewport', async ({ page }) => {
    await bootApp(page);
    await page.locator('.topbar-menu').click();
    await page.locator('.user-menu-trigger').click();
    await expect(page.locator('.user-menu')).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    await page.locator('.sidebar-scrim').click({ position: { x: 350, y: 400 } });

    const search = page.locator('.topbar-search');
    const box = await search.boundingBox();
    expect(Math.min(box.width, box.height), 'search tap target').toBeGreaterThanOrEqual(39.5);
    await search.click();
    await expect(page.locator('.command-palette')).toBeInViewport({ ratio: 1 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
