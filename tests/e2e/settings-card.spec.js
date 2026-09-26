// E2E (fixture harness): the settings feature card of the admin view in
// isolation — real partial, real settingsCard, mock API (tests/mocks/settings.js).

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/settings-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
});

const panel = (page, tab) => page.locator(`[role="tabpanel"][data-tab="${tab}"]`);
const saveBtn = (page) => page.getByRole('button', { name: 'Speichern' });

test('tabs switch the panels; save stays off until something changes', async ({ page }) => {
  await expect(page.locator('[x-data="settingsCard"] .card-title')).toHaveText('Einstellungen');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(panel(page, 'general')).toBeVisible();
  await expect(panel(page, 'general')).toContainText('Europe/Zurich');
  await expect(saveBtn(page)).toBeDisabled();

  await page.getByRole('tab', { name: 'Jobs' }).click();
  await expect(panel(page, 'jobs')).toBeVisible();
  await expect(panel(page, 'general')).toBeHidden();
  await expect(page.locator('#set-retention')).toHaveValue('30');
});

test('changing a value sends only that key and confirms', async ({ page, request }) => {
  await page.getByRole('tab', { name: 'Jobs' }).click();
  await page.fill('#set-retention', '14');
  await saveBtn(page).click();
  await expect(page.locator('.card-form-saved')).toHaveText('Gespeichert.');
  await expect(saveBtn(page)).toBeDisabled();
  const { patches } = await (await request.get('/__mock/settings')).json();
  expect(patches).toEqual([{ 'jobs.retention_days': '14' }]);
});

test('OIDC without issuer: refusal translated, field marked, discard restores', async ({ page }) => {
  await page.getByRole('tab', { name: 'Anmeldung' }).click();
  await expect(panel(page, 'auth')).toContainText('Fehlt in .env');
  await page.getByLabel('Single Sign-on (OIDC)').check();
  await saveBtn(page).click();
  await expect(page.locator('.card-form-error')).toHaveText('Für OIDC braucht es Issuer, Client-ID und Redirect-URI.');
  await expect(page.locator('#set-oidc-issuer')).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByLabel('Lokale Konten')).toBeChecked();
  await expect(page.locator('.card-form-error')).toBeHidden();
});

test('mobile width: tabs and form fit without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByRole('tab', { name: 'Anmeldung' }).click();
  await expect(panel(page, 'auth')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
