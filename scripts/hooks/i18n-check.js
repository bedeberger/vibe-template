#!/usr/bin/env node
'use strict';
// PostToolUse hook (Edit|Write|MultiEdit|Bash): after every change to a locale
// file (public/js/i18n/{de,en}.json) check that (a) both still parse — catches
// the "straight quote inside „…" → JSON parse crash of the whole SPA" case at
// once — and (b) the flattened key sets and the {placeholder} sets per key are
// identical (Harte Regel: every string in de AND en, same commit).
// Same comparison as tests/unit/i18n-locale-parity.test.mjs (shared code in
// _rules.js#localeParity). Pure reminder, never blocks.

const { read, LOCALES, localeFile, flattenKeys, localeParity } = require('./_rules.js');
const { touchedPaths, relOf, onPayload } = require('./_touched.js');

const fmt = (arr) => arr.slice(0, 12).join(', ') + (arr.length > 12 ? ` … (+${arr.length - 12})` : '');

onPayload((payload) => {
  const files = new Set(LOCALES.map(localeFile));
  if (!touchedPaths(payload).some((p) => files.has(relOf(p)))) process.exit(0);

  const out = [];
  const parsed = {};
  for (const loc of LOCALES) {
    try {
      parsed[loc] = flattenKeys(JSON.parse(read(localeFile(loc))));
    } catch (e) {
      out.push(`${localeFile(loc)} laesst sich NICHT parsen: ${e.message}`,
        '  → die SPA crasht beim Laden dieser Locale. Sofort fixen (haeufig: gerades " statt „…" in DE-Strings).');
    }
  }

  if (parsed.de && parsed.en) {
    const { onlyA, onlyB, placeholderDrift } = localeParity(parsed.de, parsed.en);
    if (onlyA.length) out.push(`Keys nur in DE, fehlen in EN (${onlyA.length}): ${fmt(onlyA)}`);
    if (onlyB.length) out.push(`Keys nur in EN, fehlen in DE (${onlyB.length}): ${fmt(onlyB)}`);
    if (placeholderDrift.length) out.push(`{Platzhalter}-Drift de ≠ en: ${fmt(placeholderDrift)}`);
  }

  if (out.length) console.log(`[i18n-check] ${out.join('\n')}\n→ sonst wird i18n-locale-parity.test rot.`);
  process.exit(0);
});
