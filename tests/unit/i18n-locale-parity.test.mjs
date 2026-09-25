// Hard gate for the locale files public/js/i18n/{de,en}.json:
//   (a) both parse — a straight `"` inside a German string („…") crashes the
//       whole SPA while loading the locale;
//   (b) both have the SAME (flattened, dotted) key set — CLAUDE.md: every new
//       string goes into de AND en in the same commit;
//   (c) every leaf is a non-empty string;
//   (d) the {placeholder} set per key is identical — a translated string that
//       lost `{words}` renders the raw braces or drops the value silently.
// The i18n-check.js PostToolUse hook runs the same comparison at edit time
// (shared code: scripts/hooks/_rules.js#localeParity).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { read, LOCALES, localeFile, flattenKeys, localeParity } = require('../../scripts/hooks/_rules.js');

function load() {
  const out = {};
  for (const loc of LOCALES) {
    try {
      out[loc] = flattenKeys(JSON.parse(read(localeFile(loc))));
    } catch (e) {
      assert.fail(`${localeFile(loc)} laesst sich nicht parsen: ${e.message}\n`
        + '  → die SPA crasht beim Laden dieser Locale. Haeufig: gerades " statt „…" in DE-Strings.');
    }
  }
  return out;
}

const fmt = (arr) => arr.slice(0, 20).join(', ') + (arr.length > 20 ? ` … (+${arr.length - 20})` : '');

test('i18n: beide Locale-Dateien sind valides JSON und nicht leer', () => {
  const l = load();
  for (const loc of LOCALES) assert.ok(l[loc].size > 5, `${loc}.json wirkt leer — Pfad/Scan pruefen.`);
});

test('i18n: de- und en-Keysets sind deckungsgleich', () => {
  const { de, en } = load();
  const { onlyA, onlyB } = localeParity(de, en);
  assert.deepEqual(onlyA, [], `Keys nur in DE, fehlen in EN (${onlyA.length}): ${fmt(onlyA)}`);
  assert.deepEqual(onlyB, [], `Keys nur in EN, fehlen in DE (${onlyB.length}): ${fmt(onlyB)}`);
});

test('i18n: jeder Wert ist ein nicht-leerer String', () => {
  const bad = [];
  for (const [loc, map] of Object.entries(load())) {
    for (const [k, v] of map) if (typeof v !== 'string' || !v.trim()) bad.push(`${loc}:${k}`);
  }
  assert.deepEqual(bad, [], `Leere oder Nicht-String-Werte: ${fmt(bad)}`);
});

test('i18n: {Platzhalter} pro Key in beiden Locales identisch', () => {
  const { de, en } = load();
  const { placeholderDrift } = localeParity(de, en);
  assert.deepEqual(placeholderDrift, [], `Platzhalter-Drift (de ≠ en):\n  ${placeholderDrift.join('\n  ')}`);
});
