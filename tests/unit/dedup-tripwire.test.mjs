// Tripwire for two structural "exactly once" rules that otherwise exist only
// as prose (DESIGN.md → "Cascade layers"):
//   1. One attribute, one declaration — no HTML attribute twice on the same
//      tag (e.g. two `:class`). The browser keeps one silently; the other is
//      dead code that still misleads review.
//   2. Selector unique per file — no selector twice in the same CSS file and
//      the same at-rule scope. The second block merges silently with the
//      first; deliberate variation uses a modifier class or a different
//      @media/@layer scope (which is NOT a violation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments, stripHtmlComments, lineOf } = require('../../scripts/hooks/_rules.js');

// Tag openings (multi-line, quoted values as a unit); values are blanked so
// Alpine object literals can't produce fake `name=` hits. Boolean attributes
// without `=` are ignored on purpose (little risk, many false positives).
function findDuplicateAttrs(src, label = '') {
  const code = stripHtmlComments(src);
  const tagRe = /<([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)\/?>/g;
  const out = [];
  for (const m of code.matchAll(tagRe)) {
    const blob = m[2].replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    if (!blob.trim()) continue;
    const counts = new Map();
    for (const a of blob.matchAll(/(^|\s)([@:.]?[A-Za-z_][\w:.-]*)\s*=/g)) {
      counts.set(a[2], (counts.get(a[2]) || 0) + 1);
    }
    for (const [name, n] of counts) {
      if (n > 1) out.push(`${label}:${lineOf(code, m.index)}: <${m[1]}> hat "${name}" ${n}x`);
    }
  }
  return out;
}

// Brace depth + at-rule stack; key = scope prefix + normalised selector.
function findDuplicateSelectors(src, label = '') {
  const code = stripCssComments(src);
  const seen = new Map();
  const scope = [];
  let buf = '';
  let line = 1;
  for (const ch of code) {
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      if (head.startsWith('@')) {
        scope.push(head);
      } else {
        // Inside @keyframes the "selectors" are 0%/from/to — not our rule.
        const inKeyframes = scope.some((s) => /^@(?:-\w+-)?keyframes\b/.test(s));
        if (head && !inKeyframes) {
          const key = `${scope.join('||')}###${head}`;
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key).push(line);
        }
        scope.push('§decl§');
      }
    } else if (ch === '}') {
      scope.pop();
      buf = '';
    } else if (ch === ';') {
      buf = ''; // end of a declaration or of a statement like `@layer a, b;`
    } else {
      buf += ch;
    }
  }
  const out = [];
  for (const [key, lines] of seen) {
    if (lines.length > 1) out.push(`${label}: "${key.split('###')[1]}" ${lines.length}x (Zeilen ${lines.join(', ')})`);
  }
  return out;
}

const HTML_FILES = walk('public', ['.html']).map(toRel);

test('kein doppeltes HTML-Attribut am selben Tag (ein Attribut, eine Deklaration)', () => {
  assert.ok(HTML_FILES.length >= 2, 'keine HTML-Dateien gefunden?');
  const violations = HTML_FILES.flatMap((f) => findDuplicateAttrs(read(f), f));
  assert.equal(violations.length, 0,
    `Doppeltes Attribut am selben Tag — eines gewinnt, das andere ist toter Code:\n  ${violations.join('\n  ')}`);
});

test('kein CSS-Selektor doppelt in derselben Datei + demselben Scope', () => {
  const violations = walk('public/css', ['.css']).map(toRel).flatMap((f) => findDuplicateSelectors(read(f), f));
  assert.equal(violations.length, 0,
    `Selektor doppelt im selben File+Scope — Variation via Modifier-Klasse, nicht Re-Definition:\n  ${violations.join('\n  ')}`);
});

test('Scanner erkennen Duplikate (kein vacuous pass)', () => {
  assert.equal(findDuplicateAttrs('<div :class="a" :class="b"></div>').length, 1);
  assert.equal(findDuplicateAttrs('<div class="a" :class="{ x: y }"></div>').length, 0);
  assert.equal(findDuplicateSelectors('.a { x: 1 } .a { y: 2 }').length, 1);
  assert.equal(findDuplicateSelectors('.a { x: 1 } @media (min-width: 1px) { .a { y: 2 } }').length, 0);
  assert.equal(findDuplicateSelectors('@layer a, b; .a { x: 1 }').length, 0);
});
