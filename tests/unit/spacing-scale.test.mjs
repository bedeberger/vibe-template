// Ratchet for the spacing scale (DESIGN.md → "Token-Pflicht"): margin,
// padding and gap come from `--space-*` / `--pad-*` / `--card-gap-*`, never
// as a raw rem/px value.
//
// Why a rule of its own next to the token prose: a raw value is the first step
// away from the scale — a `0.7rem` (11.2px) sits on no grid step, so it can
// never reappear in a neighbouring card, and once a handful of those are
// tolerated there is de facto no scale any more.
//
// Model like loc-limits.test.mjs: hard rule + ALLOW of existing offenders as
// ratchet ceiling (count per file). New file with a raw value → red; an
// allowlisted file grows → red; it got cleaner → red until the ceiling is
// lowered (or the entry removed at 0). The template starts at zero.
//
// Not checked on purpose: `em` (font-relative — it belongs to the type scale,
// `padding: 0.25em` grows with the badge text) and `0`/`auto`. Token modules
// (css/tokens/) define the scale and are exempt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments, lineOf } = require('../../scripts/hooks/_rules.js');

const EXCLUDED = ['public/css/tokens/', 'public/css/tokens.css'];

// Pinned legacy count per file. Keep empty in the template.
const ALLOW = {};

const PROP_RE =
  /(?<![\w-])((?:row-|column-)?gap|margin|padding)(-(?:top|bottom|left|right|inline|block)(?:-(?:start|end))?)?(\s*:\s*)([^;{}]+)[;}]/g;
const VAL_RE = /(?<![\w.\-])(\d*\.?\d+)(rem|px)(?![\w-])/g;

function rawSpacingValues(src) {
  const code = stripCssComments(src);
  const hits = [];
  for (const m of code.matchAll(PROP_RE)) {
    for (const v of m[4].matchAll(VAL_RE)) {
      if (Number(v[1]) === 0) continue;
      hits.push(`Zeile ${lineOf(code, m.index)}: ${m[1]}${m[2] || ''}: … ${v[0]}`);
    }
  }
  return hits;
}

test('Abstaende kommen aus der Token-Skala (Ratsche fuer rohe rem-/px-Werte)', () => {
  const violations = [];
  const seen = new Set();
  const files = walk('public/css', ['.css']).map(toRel);
  assert.ok(files.length > 10, 'kaum CSS gefunden — Pfad kaputt?');

  for (const r of files) {
    if (EXCLUDED.some((e) => r.startsWith(e))) continue;
    const hits = rawSpacingValues(read(r));
    const ceiling = ALLOW[r];
    if (ceiling === undefined) {
      if (hits.length) {
        violations.push(`${r}: ${hits.length} roher Abstandswert — Token aus tokens/spacing.css nehmen `
          + `(--space-* / --pad-* / --card-gap-*):\n      ${hits.join('\n      ')}`);
      }
      continue;
    }
    seen.add(r);
    if (hits.length > ceiling) {
      violations.push(`${r}: ${hits.length} rohe Abstandswerte > Ceiling ${ceiling}:\n      ${hits.join('\n      ')}`);
    } else if (hits.length < ceiling) {
      violations.push(`${r}: nur noch ${hits.length} statt ${ceiling} — Ceiling nachziehen (bei 0: Eintrag streichen).`);
    }
  }
  for (const r of Object.keys(ALLOW)) {
    if (!seen.has(r)) violations.push(`${r}: Allowlist-Eintrag ohne Datei — entfernen.`);
  }

  assert.equal(violations.length, 0, `Abstands-Skala verletzt:\n  ${violations.join('\n  ')}`);
});

test('Scanner erkennt einen rohen Wert (kein vacuous pass)', () => {
  assert.equal(rawSpacingValues('.a { padding: 0.7rem var(--space-sm); }').length, 1);
  assert.equal(rawSpacingValues('.a { margin: 0 auto; gap: var(--space-xs); }').length, 0);
  assert.equal(rawSpacingValues('.a { padding: 0.25em; }').length, 0);
});
