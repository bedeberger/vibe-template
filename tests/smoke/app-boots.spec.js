// Smoke: the real app boots and every main view opens without a console error.
const { test, expect } = require('@playwright/test');

test('app boots and main view opens without errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // Shell + nav rendered.
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('.nav-item')).toHaveCount(1);

  // Notes view (the only feature) opens.
  await page.locator('.nav-item').first().click();
  await expect(page.locator('section[data-partial="notes-view"]')).toBeVisible();

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});
