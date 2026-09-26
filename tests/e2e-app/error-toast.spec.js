// App behaviour: an api() error that no card handled reaches the user as the
// app toast (js/app/toast.js) — instead of vanishing into the console. Real
// app, because the toast lives in the root shell (index.html), which no
// harness mounts. The failing call is faked per page with page.route.
const { test, expect } = require('../e2e/_helpers/fixtures');
const de = require('../../public/js/i18n/de.json');
const { bootApp } = require('./_helpers/app');

async function editFirstNoteAndSave(page) {
  const card = page.locator('.note-card').first();
  await card.getByRole('button', { name: de.notes.edit }).click();
  await card.getByRole('button', { name: de.notes.save }).click();
}

test('a failed save shows the server-error toast, and it can be closed', async ({ page, consoleGuard }) => {
  consoleGuard.ignore(/status of 500/); // the browser's own network log line
  await bootApp(page);
  await page.route('**/api/notes/*', (route) => (route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal error"}' })
    : route.continue()));

  await editFirstNoteAndSave(page);

  const toast = page.locator('.job-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/job-toast--err/);
  await expect(toast).toHaveAttribute('role', 'alert');
  await expect(toast.locator('.job-toast-msg')).toHaveText(de.errors.server);

  await toast.getByRole('button', { name: de.toast.close }).click();
  await expect(toast).toBeHidden();
  // No "Alpine Expression Error" warning either — the console guard fails the test otherwise.
});

test('no answer from the server shows the network toast', async ({ page, consoleGuard }) => {
  consoleGuard.ignore(/ERR_FAILED|Failed to load resource/);
  await bootApp(page);
  await page.route('**/api/notes/*', (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()));

  await editFirstNoteAndSave(page);
  await expect(page.locator('.job-toast .job-toast-msg')).toHaveText(de.errors.network);
});

test('phone width: the toast fits the viewport, close button reachable', async ({ page, consoleGuard }) => {
  consoleGuard.ignore(/status of 500/);
  await page.setViewportSize({ width: 360, height: 740 });
  await bootApp(page);
  await page.route('**/api/notes/*', (route) => (route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal error"}' })
    : route.continue()));

  await editFirstNoteAndSave(page);
  const toast = page.locator('.job-toast');
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  const close = await toast.locator('.job-toast-close').boundingBox();
  expect(close.x + close.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
