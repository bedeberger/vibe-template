// E2E (fixture harness): the logs feature card of the admin view in isolation
// — real partial, real logsCard, mock API (tests/mocks/logs.js).

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/logs-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
});

const rows = (page) => page.locator('.log-row');

test('lists entries newest first, live line on top, markup stays text', async ({ page }) => {
  await expect(page.locator('[x-data="logsCard"] .card-title')).toHaveText('Logs');
  // 3 from the page + 1 pushed by the stream, prepended.
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).first()).toContainText('Live-Zeile');
  const err = rows(page).filter({ hasText: 'Job fehlgeschlagen' });
  await expect(err.locator('.badge')).toHaveText('ERROR');
  await expect(err.locator('.badge')).toHaveClass(/badge-err/);
  await expect(err.locator('.log-row-meta')).toHaveText('job · 7 · abc');
  // Log text is untrusted: rendered literally, never as HTML.
  await expect(err.locator('.log-row-msg')).toHaveText('Job fehlgeschlagen <b>x</b>');
  await expect(err.locator('b')).toHaveCount(0);
});

test('stack trace toggles open and closed', async ({ page }) => {
  const err = rows(page).filter({ hasText: 'Job fehlgeschlagen' });
  const toggle = err.getByRole('button', { name: 'Stacktrace ein-/ausblenden' });
  await expect(err.locator('.log-row-stack')).toBeHidden();
  await toggle.click();
  await expect(err.locator('.log-row-stack')).toHaveText(/Error: kaputt\s+at run/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(err.locator('.log-row-stack')).toBeHidden();
});

test('filter: sends the query, pauses live tail, clear restores it', async ({ page }) => {
  await expect(rows(page)).toHaveCount(4);
  await page.getByPlaceholder('E-Mail').fill('anna@local');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/admin/logs?') && r.url().includes('user=')),
    page.getByRole('button', { name: 'Filtern' }).click(),
  ]);
  expect(new URL(req.url()).searchParams.get('user')).toBe('anna@local');
  await expect(page.getByText('Live-Tail pausiert, solange ein Filter aktiv ist.')).toBeVisible();
  await expect(page.getByRole('switch')).toBeDisabled();

  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(page.getByRole('switch')).toBeEnabled();
  await expect(page.getByPlaceholder('E-Mail')).toHaveValue('');
});

test('load older appends with the cursor of the last entry', async ({ page }) => {
  await expect(rows(page)).toHaveCount(4);
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('before=')),
    page.getByRole('button', { name: 'Ältere laden' }).click(),
  ]);
  expect(new URL(req.url()).searchParams.get('before')).toBe('2026-01-02T09:00:00.000Z');
  await expect(rows(page).last()).toContainText('Älterer Eintrag');
  await expect(page.getByRole('button', { name: 'Ältere laden' })).toBeHidden();
});

test('live switch closes and reopens the stream', async ({ page, request }) => {
  const sw = page.getByRole('switch');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect.poll(async () => (await (await request.get('/__mock/logs')).json()).streams).toBe(2);
});

test('download buttons per file hit the download endpoint', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'app1.log herunterladen' })).toBeVisible();
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/admin/logs/download')),
    page.getByRole('button', { name: 'app1.log herunterladen' }).click(),
  ]);
  expect(new URL(req.url()).searchParams.get('file')).toBe('1');
});

test('phone width: no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(rows(page)).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// Phone width (DESIGN.md → Mobile): the card fits 360px. Extend with the
// feature's own mobile behaviour (actions reachable, popovers in the viewport).
test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('fits 360px without horizontal scroll', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `logs harness overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
  });
});
