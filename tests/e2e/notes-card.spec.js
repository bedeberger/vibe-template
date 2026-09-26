// E2E (fixture harness): the notes feature card in isolation — real partial,
// real notesCard + noteItemCard, mock API (tests/server.js). Checks DOM/module
// behaviour that doesn't need the real backend: load on open, the escape
// invariant of the x-html sink, add, edit → PATCH, job polling, delete, and
// the vendor-lib patterns (drag & drop, popover, collapsible chart, clamp).

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

// Drag a note card by its handle onto another card (SortableJS fallback mode
// listens to pointer events — move in steps so it sees a real drag).
async function dragNote(page, fromTitle, toTitle) {
  const handle = page.locator('.note-card', { hasText: fromTitle }).getByRole('button', { name: 'Verschieben (ziehen)' });
  const target = page.locator('.note-card', { hasText: toTitle });
  const h = await handle.boundingBox();
  const t = await target.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 10, { steps: 5 });
  await page.mouse.move(t.x + t.width / 2, t.y + 5, { steps: 15 });
  await page.mouse.up();
}
const titles = (page) => page.locator('.note-card .card-title').allTextContents();

test('drag & drop reorders the notes → PUT with the full order, no duplicate nodes', async ({ page, request }) => {
  await dragNote(page, 'Zweite', 'Erste');
  await expect.poll(() => titles(page)).toEqual(['Zweite', 'Erste']);
  await expect(page.locator('.note-card')).toHaveCount(2);
  // Moved nodes must not replay the card entry animation (flicker mid-drag).
  const anims = await page.locator('.note-card').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
  expect(anims).toEqual(['none', 'none']);
  const state = await (await request.get('/__mock/state')).json();
  expect(state.orders).toEqual([{ notebookId: 1, ids: [2, 1] }]);
});

test('a failed reorder shows the error and restores the server order', async ({ page, consoleGuard }) => {
  consoleGuard.ignore(/reorder failed|status of 500/);
  // Per page, not via the shared mock (parallel workers).
  await page.route('**/api/notebooks/*/note-order', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"mock failure"}' }));
  await dragNote(page, 'Zweite', 'Erste');
  await expect(page.getByText('Reihenfolge konnte nicht gespeichert werden.')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Erste', 'Zweite']);
});

test('new notebook popover: anchored, focus trapped, Escape returns focus', async ({ page }) => {
  const addBtn = page.getByRole('button', { name: 'Neues Notizbuch' });
  await addBtn.click();
  const pop = page.getByRole('dialog', { name: 'Neues Notizbuch' });
  await expect(pop).toBeVisible();
  const name = pop.getByRole('textbox');
  await expect(name).toBeFocused();
  // x-anchor placed it right under the button, right-aligned.
  const b = await addBtn.boundingBox();
  const p = await pop.boundingBox();
  expect(Math.abs(p.y - (b.y + b.height + 4))).toBeLessThanOrEqual(2);
  expect(Math.abs(p.x + p.width - (b.x + b.width))).toBeLessThanOrEqual(2);
  // Tab stays inside (x-trap): input → button → back to input.
  await name.fill('x');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(addBtn).toBeFocused();
});

test('new notebook → POST, selected, empty list', async ({ page, request }) => {
  await page.getByRole('button', { name: 'Neues Notizbuch' }).click();
  const pop = page.getByRole('dialog', { name: 'Neues Notizbuch' });
  await pop.getByRole('textbox').fill('Frisch');
  await pop.getByRole('button', { name: 'Anlegen' }).click();
  await expect(pop).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Notizbuch' }).getByRole('button')).toHaveText('Frisch');
  await expect(page.locator('.note-card')).toHaveCount(0);
  const state = await (await request.get('/__mock/state')).json();
  expect(state.notebooks.map((nb) => nb.name)).toContain('Frisch');
});

test('overview: collapsed by default, Chart.js loads only on open', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Übersicht' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => typeof window.Chart)).toBe('undefined');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const canvas = page.getByRole('img', { name: 'Notizen pro Notizbuch' });
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.evaluate(() => typeof window.Chart)).toBe('function');
  // The chart follows the list: notebook 1 has 2 notes, notebook 2 has 1.
  const data = await page.evaluate(() => window.Chart.getChart(document.querySelector('.notes-chart canvas')).data.datasets[0].data);
  expect(data).toEqual([2, 1]);
  await page.locator('.note-card', { hasText: 'Zweite' }).getByRole('button', { name: 'Löschen' }).click();
  await expect.poll(() => page.evaluate(() => window.Chart.getChart(document.querySelector('.notes-chart canvas')).data.datasets[0].data))
    .toEqual([1, 1]);
});

test('long body is clamped; "show more" appears only where it clips (x-resize)', async ({ page, request }) => {
  await request.post('/__mock/long-note');
  await page.reload();
  await page.waitForFunction(() => window.__harnessReady === true);
  const long = page.locator('.note-card', { hasText: 'Lang' });
  await expect(long.getByRole('button', { name: 'Mehr anzeigen' })).toBeVisible();
  await expect(page.locator('.note-card', { hasText: 'Erste' }).getByRole('button', { name: 'Mehr anzeigen' })).toHaveCount(0);
  const body = long.locator('.note-body');
  const clamped = (await body.boundingBox()).height;
  await long.getByRole('button', { name: 'Mehr anzeigen' }).click();
  await expect(long.getByRole('button', { name: 'Weniger anzeigen' })).toHaveAttribute('aria-expanded', 'true');
  expect((await body.boundingBox()).height).toBeGreaterThan(clamped * 2);
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('note cards fit 360px and their actions stay reachable', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `notes harness overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
    const card = page.locator('.note-card').first();
    for (const name of ['Verschieben (ziehen)', 'Bearbeiten', 'Statistik berechnen', 'Löschen']) {
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

  // Phone check of the vendor-lib patterns: css/components/popover.css,
  // css/components/collapsible.css, css/components/sortable-list.css +
  // js/components/sortable-list.js, js/notes/notes-chart.js.
  test('new notebook popover and the overview chart fit 360px', async ({ page }) => {
    await page.getByRole('button', { name: 'Neues Notizbuch' }).click();
    const popover = page.locator('.popover');
    await expect(popover).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    const toggle = page.locator('.collapsible-toggle');
    expect((await toggle.boundingBox()).height, 'collapsible toggle: tap target too small').toBeGreaterThanOrEqual(24);
    await toggle.click();
    await expect(page.getByRole('img', { name: 'Notizen pro Notizbuch' })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('sortable-list drag handle: touch-safe on a phone', async ({ page }) => {
    const handle = page.locator('.note-card').first().locator('.note-drag-handle');
    await expect(handle).toBeInViewport();
    // touch-action none — otherwise dragging the handle scrolls the page.
    expect(await handle.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    await dragNote(page, 'Zweite', 'Erste');
    await expect.poll(() => titles(page)).toEqual(['Zweite', 'Erste']);
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
