// Drift guard: three lists of stylesheets must agree —
//   (a) the "CSS file inventory" table in DESIGN.md (`css/…` in column 1),
//   (b) the CSS files actually shipped under public/css/ (vendor excluded),
//   (c) what public/index.html loads: its <link>s plus the token modules the
//       facade css/tokens.css @imports.
// A new file linked but undocumented, documented but missing, or shipped but
// never loaded (dead weight / forgotten <link>) → red. login.html may link only
// files that exist in the inventory (it loads a subset, same order).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments, stripHtmlComments } = require('../../scripts/hooks/_rules.js');

const design = read('DESIGN.md');
const section = design.slice(design.indexOf('## CSS file inventory'));
const inventory = new Set([...section.matchAll(/^\|\s*`(css\/[^`]+\.css)`\s*\|/gm)].map((m) => m[1]));

const shipped = new Set(walk('public/css', ['.css']).map(toRel).map((f) => f.replace(/^public\//, '')));

const linksOf = (html) => [...stripHtmlComments(html).matchAll(/<link\b[^>]*\bhref="\/?(css\/[^"]+\.css)"/g)].map((m) => m[1]);
const indexLinks = linksOf(read('public/index.html'));
const facadeImports = [...stripCssComments(read('public/css/tokens.css')).matchAll(/@import\s+url\(\s*['"]?\.\/([^'")]+)['"]?\s*\)/g)]
  .map((m) => `css/${m[1]}`);
const loaded = new Set([...indexLinks, ...facadeImports]);

const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
const fmt = (arr) => arr.map((x) => `  - ${x}`).join('\n');

test('Inventar-Scan greift (kein vacuous pass)', () => {
  assert.ok(inventory.size > 10, `nur ${inventory.size} Inventar-Zeilen in DESIGN.md gefunden — Tabelle/Regex kaputt?`);
  assert.ok(indexLinks.length > 10, `nur ${indexLinks.length} CSS-<link>s in index.html — Regex kaputt?`);
  assert.ok(facadeImports.length > 0, 'tokens.css importiert keine Token-Module — Regex kaputt?');
});

test('DESIGN.md-Inventar == ausgelieferte CSS-Dateien', () => {
  assert.deepEqual(diff(shipped, inventory), [],
    `CSS-Dateien ohne Zeile im „CSS file inventory" von DESIGN.md:\n${fmt(diff(shipped, inventory))}`);
  assert.deepEqual(diff(inventory, shipped), [],
    `DESIGN.md-Inventar nennt Dateien, die es nicht gibt:\n${fmt(diff(inventory, shipped))}`);
});

test('jede ausgelieferte CSS-Datei wird von index.html geladen (<link> oder Token-@import)', () => {
  assert.deepEqual(diff(shipped, loaded), [],
    `Nie geladene CSS-Dateien — <link> in public/index.html an ihrer Cascade-Position ergaenzen `
    + `(Token-Module stattdessen in css/tokens.css @importieren):\n${fmt(diff(shipped, loaded))}`);
  assert.deepEqual(diff(loaded, shipped), [],
    `index.html/tokens.css laden Dateien, die es nicht gibt:\n${fmt(diff(loaded, shipped))}`);
});

test('keine CSS-Datei doppelt verlinkt; login.html verlinkt nur Inventar-Dateien', () => {
  const dupes = indexLinks.filter((x, i) => indexLinks.indexOf(x) !== i);
  assert.deepEqual(dupes, [], `Doppelt verlinkt in index.html: ${dupes.join(', ')}`);
  const login = linksOf(read('public/login.html'));
  assert.deepEqual(login.filter((x) => !inventory.has(x)), [], 'login.html verlinkt Dateien ausserhalb des Inventars');
  // Same relative order as index.html (cascade = link order).
  const order = login.map((x) => indexLinks.indexOf(x));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'login.html verlinkt in anderer Reihenfolge als index.html');
});
