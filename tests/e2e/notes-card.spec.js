// E2E (fixture harness): the notes partial + noteCard component in isolation,
// against the mock API of tests/server.js. Checks DOM/module behaviour that
// doesn't need the real backend: the escape invariant of the x-html sink, the
// edit → PATCH round trip, the job poll loop, delete → event → removal.

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/notes-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
});

test('x-html sink renders the body escaped (no live markup)', async ({ page }) => {
  const body = page.locator('.note-card', { hasText: 'Erste' }).locator('.note-body');
  await expect(body).toHaveText('Hallo <b>Welt</b>');
  await expect(body.locator('b')).toHaveCount(0);
});

test('edit → save sends a PATCH and shows the new title', async ({ page, request }) => {
  // By position, not by text: in edit mode the title lives in an input value.
  const card = page.locator('.note-card').first();
  await card.getByRole('button', { name: 'Bearbeiten' }).click();
  await card.getByRole('textbox', { name: /Titel/ }).fill('Umbenannt');
  await card.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.note-card .card-title', { hasText: 'Umbenannt' })).toBeVisible();

  const state = await (await request.get('/__mock/state')).json();
  expect(state.patches).toEqual([expect.objectContaining({ id: 1, title: 'Umbenannt' })]);
});

test('stats job: poll loop runs through running → done', async ({ page }) => {
  const card = page.locator('.note-card', { hasText: 'Erste' });
  await card.getByRole('button', { name: 'Statistik berechnen' }).click();
  await expect(card.locator('.note-stats')).toBeVisible();
  await expect(card.locator('.note-stats')).toContainText('2');
});

test('delete → note-removed event → the card disappears', async ({ page, request }) => {
  const card = page.locator('.note-card', { hasText: 'Zweite' });
  await card.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.note-card', { hasText: 'Zweite' })).toHaveCount(0);
  expect((await (await request.get('/__mock/state')).json()).deletes).toEqual([2]);
});
