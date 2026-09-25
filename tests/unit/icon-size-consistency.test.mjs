// Gate against glyph-size drift on icon-only action/close buttons.
//
// `<svg class="icon">` is 1em by default, so it scales with each button's own
// font-size — close buttons, toasts and icon buttons set different ones, and
// the glyphs end up in different sizes. components/icon-btn.css therefore
// normalises the glyph (`> .icon { width/height: var(--icon-size-action) }`).
//
// The invariant (the actual bug): a button that grows to a 40px tap target on
// coarse pointers but keeps its font-size-bound glyph looks oddly sized in the
// enlarged target. So every button in the `@media (pointer: coarse)` block
// MUST also be glyph-normalised: coarse set ⊆ normalisation set. The reverse
// is deliberately NOT required (a glyph-normalised button may not need 40px,
// e.g. one positioned inside an input).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { read, stripCssComments } = require('../../scripts/hooks/_rules.js');

const css = stripCssComments(read('public/css/components/icon-btn.css'));

const classes = (list) => new Set((list.match(/\.[a-zA-Z][\w-]*/g) || []).map((s) => s.slice(1)).filter((c) => c !== 'icon'));

test('Tap-Target-Set ⊆ Glyph-Normalisierung (icon-btn.css)', () => {
  const norm = css.match(/([^{}]*>\s*\.icon[^{}]*)\{\s*width:\s*var\(--icon-size-action\)/);
  assert.ok(norm, 'Glyph-Normalisierungs-Regel mit var(--icon-size-action) fehlt in icon-btn.css');
  const coarse = css.match(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\{\s*min-width:\s*40px/);
  assert.ok(coarse, '@media (pointer: coarse)-Tap-Target-Block mit min-width: 40px fehlt in icon-btn.css');
  const normSet = classes(norm[1]);
  const coarseSet = classes(coarse[1]);
  assert.ok(normSet.has('icon-btn') && coarseSet.has('icon-btn'), '.icon-btn fehlt in einer der beiden Listen');
  const without = [...coarseSet].filter((c) => !normSet.has(c));
  assert.deepEqual(without, [],
    `Diese Buttons bekommen mobil ein 40px-Tap-Target, aber keine normalisierte Glyph-Groesse: ${without.join(', ')}`);
});

test('--icon-size-action ist in tokens/typography.css definiert', () => {
  assert.match(read('public/css/tokens/typography.css'), /--icon-size-action:\s*\d+px/);
});
