// Drift guard between the UI and the locale files:
//   1. every STATIC key used via t('area.field') in public/js + public/**/*.html,
//      and every `labelKey: 'area.field'` (feature registry), exists in de.json.
//      A missing key is silent — t() returns the key itself, so a typo'd
//      t('notes.savng') renders the literal "notes.savng" in the UI.
//   2. no orphaned strings (CLAUDE.md: "no orphaned strings"): every de.json key
//      is referenced somewhere in public/ — literally, or via a dynamic prefix
//      (a quoted literal ending in '.' like t('status.' + s) keeps `status.*`).
// Only literal single-quoted keys with at least one dot are resolvable; fully
// dynamic keys (t(job.errorKey)) are skipped — same trade-off as the CSS-var test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, localeFile, flattenKeys } = require('../../scripts/hooks/_rules.js');

const de = flattenKeys(JSON.parse(read(localeFile('de'))));

// Keys that exist on purpose without a current consumer. Ratchet: remove the
// entry once the key is used (or deleted). One-line reason each.
const ALLOW_UNUSED = new Set([
  'notes.created', // example string for a "created at" line; not rendered by the note card yet
]);

const KEY_RE = /(?:\bt(?:Raw)?\(\s*|\blabelKey\s*:\s*)'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g;

const SOURCES = [...walk('public/js', ['.js', '.mjs']), ...walk('public', ['.html'])]
  .map(toRel).filter((f) => !f.endsWith('/i18n.js'));

function referenced() {
  const refs = new Map();
  for (const f of SOURCES) {
    for (const m of read(f).matchAll(KEY_RE)) {
      if (!refs.has(m[1])) refs.set(m[1], new Set());
      refs.get(m[1]).add(f);
    }
  }
  return refs;
}

test('jeder statische t()-/labelKey-Key existiert in de.json', () => {
  const refs = referenced();
  assert.ok(refs.size > 5, `nur ${refs.size} Keys referenziert — Scan kaputt?`);
  const missing = [...refs.keys()].filter((k) => !de.has(k)).sort();
  assert.equal(missing.length, 0,
    'i18n-Keys via t()/labelKey benutzt, aber nicht in public/js/i18n/de.json (in de.json UND en.json '
    + `ergaenzen oder Tippfehler fixen):\n${missing.map((k) => `  ${k}  →  ${[...refs.get(k)].join(', ')}`).join('\n')}`);
});

test('keine verwaisten Strings: jeder de.json-Key wird benutzt', () => {
  const corpus = SOURCES.map(read).join('\n');
  const prefixes = [...new Set([...corpus.matchAll(/'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*\.)'/g)].map((m) => m[1]))];
  const used = (k) => corpus.includes(`'${k}'`) || prefixes.some((p) => k.startsWith(p));
  const orphans = [...de.keys()].filter((k) => !used(k) && !ALLOW_UNUSED.has(k)).sort();
  assert.deepEqual(orphans, [], `Verwaiste i18n-Keys (in keiner Datei unter public/ benutzt) — aus de.json `
    + `UND en.json entfernen oder verdrahten:\n  ${orphans.join('\n  ')}`);
  const staleAllow = [...ALLOW_UNUSED].filter((k) => !de.has(k) || used(k));
  assert.deepEqual(staleAllow, [], `ALLOW_UNUSED-Eintraege veraltet (Key benutzt oder geloescht) — streichen: ${staleAllow.join(', ')}`);
});
