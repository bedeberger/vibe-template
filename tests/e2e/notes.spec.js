// E2E: exercise the notes feature through the UI like a user would.
const { test, expect } = require('@playwright/test');

test('create, run stats, and delete a note', async ({ page }) => {
  await page.goto('/');

  // App becomes ready (i18n + data loaded). Seed note is visible.
  await expect(page.locator('.app-nav h1')).toHaveText('vibe-template');
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
