// E2E (fixture harness): the notes feature card in isolation — real partial,
// real notesCard + noteItemCard, mock API (tests/server.js). Checks DOM/module
// behaviour that doesn't need the real backend: load on open, the escape
// invariant of the x-html sink, add, edit → PATCH, job polling, delete.

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ page, request }) => {
  await request.post('/__mock/reset');
  await page.goto('/tests/fixtures/notes-harness.html');
  await page.waitForFunction(() => window.__harnessReady === true);
  await expect(page.locator('.note-card')).toHaveCount(2); // lifecycle loaded notebook 1
});

test('loads the first notebook on open, newest note first', async ({ page }) => {
  await expect(page.locator('.note-card .card-title').first()).toHaveText('Erste');
});

test('x-html sink renders the body escaped (no live markup)', async ({ page }) => {
  const body = page.locator('.note-card', { hasText: 'Erste' }).locator('.note-body');
  await expect(body).toHaveText('Hallo <b>Welt</b>');
  await expect(body.locator('b')).toHaveCount(0);
});

test('switching the notebook reloads the list', async ({ page }) => {
  const picker = page.getByRole('combobox', { name: 'Notizbuch' });
  await picker.getByRole('button').click();
  await picker.getByRole('option', { name: 'Zweites' }).click();
  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(page.locator('.note-card .card-title')).toHaveText('Anderes Buch');
  await expect(picker.getByRole('listbox')).toBeHidden();
  await expect(picker.getByRole('button')).toHaveText('Zweites');
});

test('combobox: search filters, keyboard picks, Escape closes', async ({ page }) => {
  const picker = page.getByRole('combobox', { name: 'Notizbuch' });
  const trigger = picker.getByRole('button');
  await expect(trigger).toHaveText('Harness');
  await trigger.click();
  const search = picker.getByRole('textbox', { name: 'Suchen …' });
  await expect(search).toBeFocused();
  await search.fill('zwei');
  await expect(picker.getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(page.locator('.note-card .card-title')).toHaveText('Anderes Buch');
  await expect(trigger).toBeFocused();

  await trigger.press('ArrowDown');
  await expect(picker.getByRole('listbox')).toBeVisible();
  await search.fill('nichts davon');
  await expect(picker.getByText('Keine Treffer')).toBeVisible();
  await search.press('Escape');
  await expect(picker.getByRole('listbox')).toBeHidden();
  await expect(trigger).toHaveText('Zweites');
});

test('add → POST and the new note is on top', async ({ page, request }) => {
  await page.fill('#new-note-title', 'Neu aus dem Harness');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.locator('.note-card .card-title').first()).toHaveText('Neu aus dem Harness');
  const state = await (await request.get('/__mock/state')).json();
  expect(state.creates).toEqual([expect.objectContaining({ notebook_id: 1, title: 'Neu aus dem Harness' })]);
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
  await expect(card.locator('.note-stats')).toContainText('2');
});

test('delete → note-removed event → the card disappears', async ({ page, request }) => {
  await page.locator('.note-card', { hasText: 'Zweite' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.note-card', { hasText: 'Zweite' })).toHaveCount(0);
  expect((await (await request.get('/__mock/state')).json()).deletes).toEqual([2]);
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('note cards fit 360px and their actions stay reachable', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `notes harness overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
    const card = page.locator('.note-card').first();
    for (const name of ['Bearbeiten', 'Statistik berechnen', 'Löschen']) {
      const btn = card.getByRole('button', { name });
      await expect(btn).toBeInViewport();
      const box = await btn.boundingBox();
      expect(box.width, `${name}: tap target too small`).toBeGreaterThanOrEqual(24);
    }
    // Edit mode (form fields) must not overflow either.
    await card.getByRole('button', { name: 'Bearbeiten' }).click();
    const editOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(editOverflow).toBeLessThanOrEqual(0);
  });

  test('notebook combobox opens inside the viewport and stays usable', async ({ page }) => {
    const picker = page.getByRole('combobox', { name: 'Notizbuch' });
    await picker.getByRole('button').click();
    const list = picker.getByRole('listbox');
    await expect(list).toBeInViewport({ ratio: 1 });
    // Touch/phone: no auto-focus (the on-screen keyboard would shift the dropdown).
    await expect(picker.getByRole('textbox')).not.toBeFocused();
    await picker.getByRole('option', { name: 'Zweites' }).click();
    await expect(page.locator('.note-card')).toHaveCount(1);
  });
});
