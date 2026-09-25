// Drift guard: every class selector defined in public/css must be reachable —
// referenced by the app (public/**/*.html, public/js, i18n JSON, server code
// that emits HTML) OR documented as a pattern in DESIGN.md. A rule nothing
// can match is dead weight: it survives refactors, misleads review ("it's
// styled, so it's used") and bloats the shipped CSS.
//
// Template adaptation: DESIGN.md counts as corpus. The template ships a
// pattern catalog before any feature uses every pattern (tabs, toggle, danger
// zone, …); a documented class is alive by contract. An UNdocumented class
// with no consumer is dead → remove it, wire it up, or document the pattern.
//
// A class also stays alive when it is built by concatenation: a quoted
// literal ending in `-`/`_` that is a strict prefix (`'card--' + key`).
// Known limitation (errs toward NOT failing): a class merely named in a code
// comment counts as used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments } = require('../../scripts/hooks/_rules.js');

// Individual classes that are live but defeat every heuristic. One-line reason each.
const ALLOW_CLASSES = new Set([]);

function definedClasses() {
  const defined = new Map();
  for (const f of walk('public/css', ['.css']).map(toRel)) {
    const css = stripCssComments(read(f)).replace(/"[^"]*"|'[^']*'/g, '""');
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      if (m[1].includes('@')) continue;
      for (const c of m[1].matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g)) {
        if (/^\d/.test(c[1])) continue;
        if (!defined.has(c[1])) defined.set(c[1], new Set());
        defined.get(c[1]).add(f);
      }
    }
  }
  return defined;
}

function corpus() {
  const files = [
    ...walk('public/js', ['.js', '.mjs', '.json']),
    ...walk('public', ['.html']),
    ...walk('routes', ['.js']),
    ...walk('lib', ['.js']),
  ].map(toRel);
  return [...files.map(read), read('DESIGN.md')].join('\n');
}

test('jede CSS-Klasse in public/css wird benutzt oder ist in DESIGN.md dokumentiert', () => {
  const defined = definedClasses();
  assert.ok(defined.size > 50, `nur ${defined.size} Klassen gefunden — Scan kaputt?`);
  const text = corpus();
  const prefixes = [...new Set([...text.matchAll(/['"`]([a-zA-Z][a-zA-Z0-9_-]*[-_])['"`]/g)].map((m) => m[1]))];

  const isUsed = (cls) => {
    if (ALLOW_CLASSES.has(cls)) return true;
    const esc = cls.replace(/[-]/g, '\\-');
    if (new RegExp(`(^|[^a-zA-Z0-9_-])${esc}([^a-zA-Z0-9_-]|$)`).test(text)) return true;
    return prefixes.some((p) => cls.startsWith(p) && cls !== p);
  };

  const dead = [...defined.keys()].filter((c) => !isUsed(c)).sort();
  assert.equal(dead.length, 0,
    'Tote CSS-Klassen — in public/css definiert, aber weder im App-Code benutzt noch in DESIGN.md '
    + `dokumentiert. Regel entfernen, verdrahten oder das Pattern dokumentieren:\n${
      dead.map((c) => `  .${c}  →  ${[...defined.get(c)].join(', ')}`).join('\n')}`);
});
