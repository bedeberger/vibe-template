// Machine-enforced LOC caps from CLAUDE.md ("File-Limits / Modularität"):
//   JS (browser public/js + server lib/routes/db/scripts + server.js/logger.js)
//   > 600, HTML partials > 250, CSS > 600 → split into a <name>/ subfolder
//   with a facade re-export. As prose alone this drifts under context pressure.
//
// Model: global hard cap per category + an ALLOWLIST of grandfathered
// offenders as a ratchet ceiling. The test enforces:
//   1. a NEW file above the cap that is not allowlisted → red;
//   2. an allowlisted file that grows past its pinned ceiling → red
//      (ratchet: legacy may only shrink);
//   3. an allowlisted file back under the cap (or deleted) → red, asking to
//      drop the entry (keeps the list honest; a split takes its entry along).
// Categories + allowlist live in scripts/hooks/_rules.js, shared with the
// loc-limits-check.js PostToolUse hook — one source, no drift. The template
// starts with an empty allowlist. public/vendor/** is never counted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, LOC_CATEGORIES, locFiles, loc } = require('../../scripts/hooks/_rules.js');

for (const cat of LOC_CATEGORIES) {
  test(`${cat.label}: keine neuen Dateien ueber ${cat.cap} LOC + Altlasten-Ratsche`, () => {
    const files = locFiles(cat);
    assert.ok(files.length > 0, `${cat.label}: keine Dateien gefunden — Pfade in _rules.js kaputt?`);
    const excluded = new Set(cat.exclude || []);
    const violations = [];
    const seen = new Set();

    for (const r of files) {
      if (excluded.has(r)) continue;
      const n = loc(readFileSync(join(ROOT, r), 'utf8'));
      if (Object.hasOwn(cat.allow, r)) {
        seen.add(r);
        const ceiling = cat.allow[r];
        if (n > ceiling) {
          violations.push(`${r}: ${n} LOC > gepinntes Ceiling ${ceiling} — Altlast darf nur schrumpfen. `
            + 'Datei splitten (Eintrag dann streichen) oder kuerzen.');
        } else if (n <= cat.cap) {
          violations.push(`${r}: nur noch ${n} LOC (<= ${cat.cap}-Cap) — Allowlist-Eintrag in `
            + 'scripts/hooks/_rules.js entfernen, damit der normale Cap wieder gilt.');
        }
      } else if (n > cat.cap) {
        violations.push(`${r}: ${n} LOC > ${cat.cap}-Cap — in einen <name>/-Subfolder splitten `
          + '(Facade re-exportiert die Sub-Module, CLAUDE.md "File-Limits / Modularität").');
      }
    }

    for (const r of Object.keys(cat.allow)) {
      if (seen.has(r)) continue;
      violations.push(existsSync(join(ROOT, r))
        ? `${r}: Allowlist-Eintrag, aber Datei liegt ausserhalb der Kategorie — Eintrag entfernen.`
        : `${r}: Allowlist-Eintrag verweist auf geloeschte Datei — Eintrag entfernen.`);
    }

    assert.equal(violations.length, 0, `LOC-Limit-Verstoesse (${cat.label}):\n  ${violations.join('\n  ')}`);
  });
}

test('loc() zaehlt wie `wc -l`', () => {
  assert.equal(loc(''), 0);
  assert.equal(loc('a\n'), 1);
  assert.equal(loc('a\nb'), 2);
  assert.equal(loc('a\nb\n'), 2);
});
