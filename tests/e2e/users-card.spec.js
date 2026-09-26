// E2E (fixture harness): the users feature card of the admin view in isolation
// — real partial, real usersCard/userItemCard, mock API (tests/mocks/auth-users.js).

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/users-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
});

const card = (page, email) => page.locator('.user-card').filter({ hasText: email });

test('lists accounts: env admin first and without actions, badges per state', async ({ page }) => {
  await expect(page.locator('[x-data="usersCard"] .card-title').first()).toHaveText('Benutzer');
  await expect(page.locator('.user-card')).toHaveCount(3);
  await expect(page.locator('.user-card').first()).toContainText('admin@local');
  await expect(card(page, 'admin@local').locator('.card-actions')).toHaveCount(0);
  await expect(card(page, 'admin@local')).toContainText('Admin (.env)');
  await expect(card(page, 'anna@local')).toContainText('Initialpasswort');
  await expect(card(page, 'ben@local')).toContainText('Gesperrt');
});

test('create: generated initial password, server error shown translated', async ({ page }) => {
  await page.fill('#new-user-email', 'anna@local');
  await page.getByRole('button', { name: 'Generieren' }).click();
  const pw = await page.inputValue('#new-user-password');
  expect(pw).toHaveLength(16);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.locator('.card-form-error').first()).toHaveText('Diese E-Mail gibt es schon.');

  await page.fill('#new-user-email', 'Carla@Local');
  await page.fill('#new-user-name', 'Carla');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/admin/users') && r.method() === 'POST'),
    page.getByRole('button', { name: 'Anlegen' }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({ email: 'Carla@Local', display_name: 'Carla', password: pw });
  await expect(page.locator('.card-form-saved').first()).toContainText('carla@local');
  await expect(page.locator('.user-card')).toHaveCount(4);
});

test('disable / enable toggles status and icon', async ({ page }) => {
  const anna = card(page, 'anna@local');
  await anna.getByRole('button', { name: 'Sperren' }).click();
  await expect(anna).toContainText('Gesperrt');
  await anna.getByRole('button', { name: 'Entsperren' }).click();
  await expect(anna).toContainText('Aktiv');
});

test('reset password via dialog', async ({ page }) => {
  const ben = card(page, 'ben@local');
  await ben.getByRole('button', { name: 'Initialpasswort neu setzen' }).click();
  const dlg = ben.locator('dialog[open]');
  await expect(dlg).toBeVisible();
  const [req] = await Promise.all([
    page.waitForRequest((r) => decodeURIComponent(r.url()).endsWith('/api/admin/users/ben@local/password') && r.method() === 'PUT'),
    dlg.getByRole('button', { name: 'Speichern' }).click(),
  ]);
  expect(req.postDataJSON().password).toHaveLength(16);
  await expect(dlg.locator('.card-form-saved')).toBeVisible();
  await expect(ben).toContainText('Initialpasswort');
  await dlg.getByRole('button', { name: 'Schliessen' }).click();
  await expect(dlg).toHaveCount(0);
});

test('delete asks first, then removes the card', async ({ page }) => {
  const ben = card(page, 'ben@local');
  await ben.getByRole('button', { name: 'Löschen' }).click();
  const dlg = ben.locator('dialog[open]');
  await dlg.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('.user-card')).toHaveCount(3);
  await ben.getByRole('button', { name: 'Löschen' }).click();
  await ben.locator('dialog[open]').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.user-card')).toHaveCount(2);
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test('no horizontal overflow at 360px', async ({ page }) => {
    await expect(page.locator('.user-card')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
