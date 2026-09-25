// Gate for the cascade-layer contract (DESIGN.md → "Cascade layers"):
//   1. The layer order `@layer base, components, utilities;` is declared
//      exactly once, in the token facade public/css/tokens.css.
//   2. Every other CSS file wraps ALL its rules in `@layer <known> { … }`.
//      An unlayered rule beats every layered rule regardless of specificity —
//      the bug only shows when a targeted override silently fails.
//   3. Exempt: the token facade + public/css/tokens/** (custom properties and
//      @font-face stay unlayered on purpose) and a top-level `:root { … }`
//      that declares ONLY custom properties (e.g. the icon mask URLs in
//      components/icons.css — global values, not competing rules).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments } = require('../../scripts/hooks/_rules.js');

const FACADE = 'public/css/tokens.css';
const LAYERS = ['base', 'components', 'utilities'];
const isTokenFile = (f) => f === FACADE || f.startsWith('public/css/tokens/');

// Top-level statements: [{ head, body }] for blocks, { head } for `…;` statements.
function topLevel(css) {
  const out = [];
  let depth = 0;
  let buf = '';
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) { out.push({ head: buf.trim().replace(/\s+/g, ' '), bodyStart: i + 1 }); buf = ''; }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) { out[out.length - 1].body = css.slice(out[out.length - 1].bodyStart, i); start = i + 1; }
    } else if (depth === 0) {
      if (ch === ';') { if (buf.trim()) out.push({ head: `${buf.trim()};` }); buf = ''; } else buf += ch;
    }
  }
  if (buf.trim()) out.push({ head: buf.trim(), dangling: true, start });
  return out;
}

function layerProblems(src) {
  const problems = [];
  for (const s of topLevel(stripCssComments(src))) {
    const layer = s.head.match(/^@layer ([\w-]+)$/);
    if (layer && s.body !== undefined) {
      if (!LAYERS.includes(layer[1])) problems.push(`unbekannter Layer "${layer[1]}" (erlaubt: ${LAYERS.join(', ')})`);
      continue;
    }
    if (s.head === ':root' && s.body !== undefined) {
      // Blank quoted strings first: data-URLs contain `;` (`svg+xml;utf8,`).
      const decls = s.body.replace(/"[^"]*"|'[^']*'/g, '""').split(';').map((d) => d.trim()).filter(Boolean);
      const nonCustom = decls.filter((d) => !d.startsWith('--'));
      if (nonCustom.length) problems.push(`:root ausserhalb eines Layers setzt echte Properties (${nonCustom[0].slice(0, 30)} …)`);
      continue;
    }
    problems.push(`Regel/Statement ausserhalb eines @layer: "${s.head.slice(0, 60)}"`);
  }
  return problems;
}

test('Layer-Reihenfolge genau einmal, in tokens.css', () => {
  const decl = /@layer\s+[\w-]+\s*(?:,\s*[\w-]+\s*)+;/g;
  const where = walk('public/css', ['.css']).map(toRel)
    .flatMap((f) => (stripCssComments(read(f)).match(decl) || []).map((m) => `${f}: ${m}`));
  assert.deepEqual(where, [`${FACADE}: @layer ${LAYERS.join(', ')};`],
    'Die Layer-Reihenfolge wird genau einmal in public/css/tokens.css deklariert.');
});

test('jede CSS-Datei (ausser Tokens) kapselt ihre Regeln in @layer', () => {
  const files = walk('public/css', ['.css']).map(toRel).filter((f) => !isTokenFile(f));
  assert.ok(files.length > 10, 'kaum CSS gefunden — Pfad kaputt?');
  const violations = files.flatMap((f) => layerProblems(read(f)).map((p) => `${f}: ${p}`));
  assert.equal(violations.length, 0,
    `Ungelayerte CSS-Regeln — unlayered schlaegt JEDEN Layer unabhaengig von der Spezifitaet. `
    + `Regeln in @layer components { … } (bzw. base/utilities) wickeln:\n  ${violations.join('\n  ')}`);
});

test('Scanner erkennt ungelayerte Regeln (kein vacuous pass)', () => {
  assert.equal(layerProblems('@layer components { .a { color: red } }').length, 0);
  assert.equal(layerProblems(':root { --x: 1px; }').length, 0);
  assert.equal(layerProblems('.a { color: red }').length, 1);
  assert.equal(layerProblems(':root { color: red; }').length, 1);
  assert.equal(layerProblems('@media (min-width: 1px) { .a { color: red } }').length, 1);
  assert.equal(layerProblems('@layer fancy { .a { color: red } }').length, 1);
});
