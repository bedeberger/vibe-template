// App behaviour (real app, real backend): the notes feature end to end like a
// user — create, run the stats job through the real queue, delete. Belongs here
// and not in a harness because the assertion depends on the real backend.
const { test, expect } = require('../e2e/_helpers/fixtures');
const de = require('../../public/js/i18n/de.json');

test('create, run stats, and delete a note', async ({ page }) => {
  await page.goto('/');

  // App becomes ready (i18n + data loaded). Seed note is visible.
  await expect(page.locator('.sidebar-brand-name')).toHaveText(de.app.title);
  await expect(page.locator('.note-card').first()).toBeVisible();

  // Create a note.
  const title = `E2E ${Date.now()}`;
  await page.fill('input[placeholder*="neuen Notiz"]', title);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  const card = page.locator('.note-card', { hasText: title });
  await expect(card).toBeVisible();

  // Run the background-job stats on it.
  await card.getByRole('button', { name: 'Statistik berechnen' }).click();
  await expect(card.locator('.note-stats')).toBeVisible();

  // Delete it.
  await card.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.note-card', { hasText: title })).toHaveCount(0);
});
