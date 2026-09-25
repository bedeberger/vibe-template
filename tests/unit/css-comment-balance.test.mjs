// Tripwire for orphaned CSS comment markers. Bug class: while rewording a
// comment a second `*/` survives — the comment is already closed, bare text
// plus a stray `*/` follow at top level. The CSS parser's error recovery then
// swallows everything up to the next `{ … }` block, i.e. the NEXT RULE is
// dropped silently. The scanner tracks comment state char by char and reports
// every `*/` outside a comment and every comment still open at EOF.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read } = require('../../scripts/hooks/_rules.js');

function commentImbalance(src, label = '') {
  const out = [];
  let inComment = false;
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') line++;
    const two = src.slice(i, i + 2);
    if (!inComment) {
      if (two === '/*') { inComment = true; i++; continue; }
      if (two === '*/') { out.push(`${label}:${line}: verwaistes "*/" ausserhalb eines Kommentars`); i++; }
    } else if (two === '*/') {
      inComment = false;
      i++;
    }
  }
  if (inComment) out.push(`${label}: Kommentar am EOF nicht geschlossen`);
  return out;
}

test('keine verwaisten CSS-Kommentar-Marker (Kommentar-Balance)', () => {
  const violations = walk('public/css', ['.css']).map(toRel).flatMap((f) => commentImbalance(read(f), f));
  assert.equal(violations.length, 0,
    `Verwaister CSS-Kommentar-Marker — die Parser-Recovery frisst die naechste Regel:\n  ${violations.join('\n  ')}`);
});

test('Scanner erkennt verwaiste Marker (kein vacuous pass)', () => {
  assert.equal(commentImbalance('/* a */ b */ .x {}').length, 1);
  assert.equal(commentImbalance('/* open').length, 1);
  assert.equal(commentImbalance('/* a */ .x {} /* b */').length, 0);
});
