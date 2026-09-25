// Drift guard: every custom property referenced via var(--x) in public/css
// must resolve to a definition — declared in CSS, or injected at runtime from
// JS/HTML (setProperty / Alpine `:style="{ '--x': … }"`). An undefined
// reference silently falls back to the property's initial value (a typo'd
// `gap: var(--spcae-sm)` collapses to `gap: normal`), which looks like a
// styling bug, not an error. This makes that class of typo fail loudly.
//
// A new var(--x) stays green when it names a token defined in public/css, or
// when the literal `--x` appears in public/js / public/**/*.html (runtime var),
// or when it is a documented component knob: referenced WITH a fallback
// (`var(--close-size, var(--font-size-md))`) and named in DESIGN.md. The
// template ships patterns before any consumer sets their knobs — a knob
// without fallback or without documentation is still a failure.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments } = require('../../scripts/hooks/_rules.js');

// Custom-property names: letters, digits, hyphens AND underscores.
const NAME = '--[a-zA-Z0-9_-]+';

function runtimeNames() {
  const names = new Set();
  const files = [...walk('public/js', ['.js', '.mjs']), ...walk('public', ['.html'])].map(toRel);
  for (const f of files) for (const m of read(f).matchAll(new RegExp(NAME, 'g'))) names.add(m[0]);
  return names;
}

test('jedes var(--token) in public/css hat eine Definition', () => {
  const defined = new Set();
  const referenced = new Map();
  const withFallback = new Set();
  for (const f of walk('public/css', ['.css']).map(toRel)) {
    const css = stripCssComments(read(f));
    for (const m of css.matchAll(new RegExp(`(${NAME})\\s*:`, 'g'))) defined.add(m[1]);
    for (const m of css.matchAll(new RegExp(`var\\(\\s*(${NAME})`, 'g'))) {
      if (!referenced.has(m[1])) referenced.set(m[1], new Set());
      referenced.get(m[1]).add(f);
    }
    for (const m of css.matchAll(new RegExp(`var\\(\\s*(${NAME})\\s*,`, 'g'))) withFallback.add(m[1]);
  }
  assert.ok(defined.size > 50, `nur ${defined.size} Tokens definiert — Scan kaputt?`);

  const runtime = runtimeNames();
  const design = read('DESIGN.md');
  const documentedKnob = (n) => withFallback.has(n) && new RegExp(`${n}(?![\\w-])`).test(design);
  const missing = [...referenced.keys()]
    .filter((n) => !defined.has(n) && !runtime.has(n) && !documentedKnob(n)).sort();
  assert.equal(missing.length, 0,
    'Undefinierte Custom Properties via var() — in public/css/tokens/ definieren (oder Tippfehler '
    + `fixen); zur Laufzeit gesetzt → das Literal muss in JS/HTML stehen:\n${
      missing.map((n) => `  ${n}  →  ${[...referenced.get(n)].join(', ')}`).join('\n')}`);
});
