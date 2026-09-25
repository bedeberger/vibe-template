// Unit: every fixture harness (tests/fixtures/*-harness.html) links the SAME
// stylesheets in the SAME order as public/index.html. A harness with a
// different cascade can stay green while the real app's layout breaks — or
// fail for a reason the app doesn't have. New CSS file → both places.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const stylesheets = (html) => [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);

const app = stylesheets(read('public/index.html'));
const harnesses = fs.readdirSync(new URL('../../tests/fixtures/', import.meta.url)).filter((f) => f.endsWith('-harness.html'));

test('index.html links stylesheets at all', () => {
  assert.ok(app.length > 0);
});

for (const h of harnesses) {
  test(`${h} links the app's stylesheets in cascade order`, () => {
    assert.deepEqual(stylesheets(read(`tests/fixtures/${h}`)), app, 'Stylesheet-Liste/Reihenfolge weicht von public/index.html ab.');
  });
}
