#!/usr/bin/env node
'use strict';
// PostToolUse hook (Edit|Write|MultiEdit|Bash): warns immediately when a file
// just edited breaks its category LOC cap from CLAUDE.md ("File-Limits /
// Modularität") — before tests/unit/loc-limits.test.mjs goes red in CI.
// Categories, caps and the grandfathered ceilings come from _rules.js — the
// same module the test reads (one source, no drift). An allowlisted file only
// warns when it grows past its pinned ceiling (ratchet). Pure warner, silent
// for non-assets and files within their limit.

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loc, locCategoryFor } = require('./_rules.js');
const { touchedPaths, relOf, onPayload, emitContext } = require('./_touched.js');

function check(rel) {
  const cat = locCategoryFor(rel);
  if (!cat) return null;
  let n;
  try {
    n = loc(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null; // not (yet) readable → silent
  }
  if (Object.hasOwn(cat.allow, rel)) {
    const ceiling = cat.allow[rel];
    return n > ceiling
      ? `[loc-limit] ${rel}: ${n} LOC > gepinntes Ceiling ${ceiling} (${cat.label}-Altlast) — darf nur schrumpfen. `
        + 'Splitten (Allowlist-Eintrag in scripts/hooks/_rules.js dann streichen) — sonst wird loc-limits.test rot.'
      : null;
  }
  return n > cat.cap
    ? `[loc-limit] ${rel}: ${n} LOC > ${cat.cap}-Cap (${cat.label}) — in einen <name>/-Subfolder splitten `
      + '(Facade re-exportiert die Sub-Module; CLAUDE.md "File-Limits / Modularität") — sonst wird loc-limits.test rot.'
    : null;
}

onPayload((payload) => {
  const out = [...new Set(touchedPaths(payload).map(relOf).filter(Boolean).map(check).filter(Boolean))];
  emitContext('PostToolUse', out.join('\n'));
  process.exit(0);
});
