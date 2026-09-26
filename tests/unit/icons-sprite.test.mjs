// Integrity of the Lucide sprite public/icons.svg (DESIGN.md → "Icon-System"):
//  1. every symbol id is unique (a second definition silently shadows the
//     first) and every symbol is a 24×24 Lucide viewBox;
//  2. every static `icons.svg#NAME` reference in public/ (HTML/JS/CSS) and
//     every feature-registry `icon: 'NAME'` (rendered via
//     `'/icons.svg#' + f.icon`) resolves to a symbol — a typo is an invisible icon;
//  3. references carry no query string (`/icons.svg?v=…` is a separate URL,
//     i.e. a separate fetch per variant);
//  4. the "Ausgelieferte Symbole" list in DESIGN.md equals the sprite (the catalog
//     is the index people search before adding an icon);
//  5. the ISC licence ships next to the sprite.
// Pure static analysis; public/vendor/** is excluded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, walk, toRel, read, stripHtmlComments, stripJsComments } = require('../../scripts/hooks/_rules.js');

const sprite = stripHtmlComments(read('public/icons.svg'));
const symbols = [...sprite.matchAll(/<symbol\b([^>]*)>/g)].map((m) => ({
  id: (m[1].match(/\bid="([^"]+)"/) || [])[1],
  viewBox: (m[1].match(/\bviewBox="([^"]+)"/) || [])[1],
}));
const ids = new Set(symbols.map((s) => s.id));

test('icons.svg: Symbol-IDs unique, alle mit viewBox 0 0 24 24', () => {
  assert.ok(symbols.length > 50, `nur ${symbols.length} Symbole — Sprite kaputt?`);
  const dupes = symbols.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `Doppelte Symbol-IDs im Sprite: ${dupes.join(', ')}`);
  const bad = symbols.filter((s) => !s.id || s.viewBox !== '0 0 24 24').map((s) => s.id || '(ohne id)');
  assert.deepEqual(bad, [], `Symbole ohne id oder ohne Lucide-viewBox: ${bad.join(', ')}`);
});

test('jede icons.svg#-Referenz in public/ existiert im Sprite', () => {
  const files = walk('public', ['.html', '.js', '.mjs', '.css']).map(toRel);
  const broken = [];
  let refs = 0;
  for (const f of files) {
    for (const m of read(f).matchAll(/icons\.svg[^"'`)\s#]*#([a-z0-9-]+)/g)) {
      refs++;
      if (!ids.has(m[1])) broken.push(`${f} → #${m[1]}`);
    }
  }
  assert.ok(refs > 3, `nur ${refs} Icon-Referenzen gefunden — Scan kaputt?`);
  assert.deepEqual(broken, [], `Referenz auf nicht existierendes Icon:\n  ${broken.join('\n  ')}`);
});

test('jedes Feature-Registry-Icon existiert im Sprite', () => {
  const src = stripJsComments(read('public/js/app/features.js'));
  const icons = [...src.matchAll(/\bicon\s*:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(icons.length > 0, 'keine icon-Felder in features.js gefunden — Scan kaputt?');
  const missing = icons.filter((i) => !ids.has(i));
  assert.deepEqual(missing, [], `features.js nennt Icons, die das Sprite nicht hat: ${missing.join(', ')}`);
});

test('icons.svg-Referenzen ohne Query-String', () => {
  const offenders = walk('public', ['.html', '.js', '.mjs', '.css']).map(toRel)
    .flatMap((f) => [...read(f).matchAll(/icons\.svg\?[^"'`)\s#]*/g)].map((m) => `${f} → ${m[0]}`));
  assert.deepEqual(offenders, [], `icons.svg mit Query-String (nur /icons.svg#NAME):\n  ${offenders.join('\n  ')}`);
});

test('DESIGN.md "Ausgelieferte Symbole" == Sprite', () => {
  const design = read('DESIGN.md');
  const a = design.indexOf('<!-- icon-list:start -->');
  const b = design.indexOf('<!-- icon-list:end -->');
  assert.ok(a > 0 && b > a, 'Marker <!-- icon-list:start/end --> fehlen in DESIGN.md');
  const listed = new Set([...design.slice(a, b).matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]));
  const undocumented = [...ids].filter((i) => !listed.has(i)).sort();
  const phantom = [...listed].filter((i) => !ids.has(i)).sort();
  assert.deepEqual(undocumented, [], `Im Sprite, aber nicht in DESIGN.md gelistet: ${undocumented.join(', ')}`);
  assert.deepEqual(phantom, [], `In DESIGN.md gelistet, aber nicht im Sprite: ${phantom.join(', ')}`);
});

test('Lucide-Lizenz liegt neben dem Sprite', () => {
  assert.ok(existsSync(join(ROOT, 'public/icons.LICENSE.txt')), 'public/icons.LICENSE.txt fehlt (ISC verlangt den Hinweis)');
  assert.match(read('public/icons.LICENSE.txt'), /ISC License/);
});
