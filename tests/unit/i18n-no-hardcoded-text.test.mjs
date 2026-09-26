// Gate for "UI-Strings nur in public/js/i18n/{de,en}.json" on the markup side:
// no visible text is hardcoded in public/**/*.html. Text nodes carry no words
// (only punctuation like ':' between bound spans), and the text-bearing
// attributes placeholder / title / aria-label / alt / data-tip are either empty
// or bound (`:placeholder="t('…')"`). Hardcoded text never reaches en.json —
// the English UI silently shows German (or vice versa).
//
// Not checked: <title> (the product name), <script>/<style> content, comments.
// ALLOW pins legacy files with a ratchet count (may only shrink).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripHtmlComments, lineOf } = require('../../scripts/hooks/_rules.js');

const ALLOW = {};

const WORD = /\p{L}{2,}/u;
const TAG_RE = /<[a-zA-Z/!][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>/g;
const TEXT_ATTR_RE = /(?<![:\w.-])(placeholder|title|aria-label|alt|data-tip)\s*=\s*(["'])([^"']*)\2/g;

function hardcodedText(src) {
  const code = stripHtmlComments(src)
    .replace(/<(script|style|title)\b[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, ' '));
  const hits = [];
  for (const tag of code.matchAll(TAG_RE)) {
    for (const a of tag[0].matchAll(TEXT_ATTR_RE)) {
      if (WORD.test(a[3])) hits.push(`Zeile ${lineOf(code, tag.index)}: ${a[1]}="${a[3]}"`);
    }
  }
  const textOnly = code.replace(TAG_RE, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of textOnly.matchAll(/[^\s][^\n]*/g)) {
    if (WORD.test(m[0].replace(/&[a-z]+;|&#\d+;/gi, ''))) hits.push(`Zeile ${lineOf(textOnly, m.index)}: Text "${m[0].trim().slice(0, 40)}"`);
  }
  return hits;
}

test('kein hartkodierter UI-Text in public/**/*.html', () => {
  const files = walk('public', ['.html']).map(toRel);
  assert.ok(files.some((f) => f.startsWith('public/partials/')), 'keine Partials gefunden — Scan kaputt?');
  const violations = [];
  for (const f of files) {
    const hits = hardcodedText(read(f));
    const ceiling = ALLOW[f];
    if (ceiling === undefined) {
      if (hits.length) violations.push(`${f}:\n      ${hits.join('\n      ')}`);
    } else if (hits.length !== ceiling) {
      violations.push(`${f}: ${hits.length} Treffer, Ceiling ${ceiling} — ${hits.length > ceiling
        ? 'darf nur schrumpfen' : 'Ceiling nachziehen (bei 0: Eintrag streichen)'}:\n      ${hits.join('\n      ')}`);
    }
  }
  assert.equal(violations.length, 0,
    'Hartkodierter UI-Text — via x-text="t(\'area.field\')" / :placeholder="t(…)" binden und den '
    + `Key in de.json UND en.json anlegen:\n  ${violations.join('\n  ')}`);
});

test('Scanner erkennt hartkodierten Text (kein vacuous pass)', () => {
  assert.equal(hardcodedText('<button>Speichern</button>').length, 1);
  assert.equal(hardcodedText('<input placeholder="Suche">').length, 1);
  assert.equal(hardcodedText('<span x-text="t(\'a.b\')"></span>: <span x-text="x"></span>').length, 0);
  assert.equal(hardcodedText('<input :placeholder="t(\'a.b\')" @keydown.enter="a > b && go()">').length, 0);
  assert.equal(hardcodedText('<!-- Kommentar mit Text --><title>Brand</title>').length, 0);
});
