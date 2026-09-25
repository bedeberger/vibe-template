// Tripwire for the template's architecture invariants (CLAUDE.md → Harte
// Regeln) that are otherwise only prose and drift under context pressure:
//   1. Domain facade: no raw SQL against the domain tables (notes, notebooks)
//      outside db/ and lib/note-store.js, and nobody but the facade imports
//      the domain DB module db/notes.js. Routes and jobs go through the facade.
//   2. DB timestamps: no datetime('now') in code (comments are fine) — it
//      yields "YYYY-MM-DD HH:MM:SS" without the Z marker; use ${NOW_ISO_SQL}
//      from db/now.js, also in comparisons.
//   3. Explicit state: every `this.x = …` in a browser component assigns a
//      field DECLARED up front (component object literal, or the root's
//      app/app-state.js) — no lazy `this._x` that only appears in a method.
//   4. Logging context: a route file that reads `req.params` fills the context
//      tag via setContext() (lib/log-context.js), so the request is traceable.
// Paths are globbed (lib/, routes/**, db/, scripts/), never hardcoded, so the
// checks survive moves like lib/jobs → routes/jobs. public/vendor/** and
// node_modules are excluded. Shared regexes live in scripts/hooks/_rules.js
// (the style-guard.js hook warns on 1 + 2 at edit time).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ROOT, walk, toRel, read, stripJsComments, lineOf,
  DATETIME_NOW_RE, RAW_DOMAIN_SQL_RE, DOMAIN_DB_IMPORT_RE, mayUseDomainDb, DOMAIN_FACADE,
} = require('../../scripts/hooks/_rules.js');

const JS = ['.js', '.mjs', '.cjs'];
const serverFiles = () => [
  ...['lib', 'routes', 'db', 'scripts'].flatMap((d) => walk(d, JS)),
  ...['server.js', 'logger.js'].filter((f) => existsSync(join(ROOT, f))).map((f) => join(ROOT, f)),
].map(toRel);

const hits = (files, re, skip = () => false) => files.filter((f) => !skip(f)).flatMap((f) => {
  const code = stripJsComments(read(f));
  return [...code.matchAll(re)].map((m) => `${f}:${lineOf(code, m.index)}: ${m[0]}`);
});

test('Facade: kein Roh-SQL gegen notes/notebooks ausserhalb db/ + lib/note-store.js', () => {
  assert.ok(existsSync(join(ROOT, DOMAIN_FACADE)), `${DOMAIN_FACADE} fehlt — Facade umbenannt? _rules.js nachziehen.`);
  const v = hits(serverFiles(), RAW_DOMAIN_SQL_RE, mayUseDomainDb);
  assert.deepEqual(v, [], 'Roh-SQL gegen Domaenen-Tabellen — nur ueber die Facade lib/note-store.js '
    + `(CLAUDE.md "Domänen-Facade als einziger Eintrittspunkt"):\n  ${v.join('\n  ')}`);
});

test('Facade: db/notes.js wird nur von der Facade importiert', () => {
  const v = hits(serverFiles(), DOMAIN_DB_IMPORT_RE, mayUseDomainDb);
  assert.deepEqual(v, [], `Direkter Import des Domaenen-DB-Moduls — lib/note-store.js verwenden:\n  ${v.join('\n  ')}`);
  // Self-test: the facade itself does import it (otherwise the regex is broken).
  assert.ok(DOMAIN_DB_IMPORT_RE.test(read(DOMAIN_FACADE)), 'Regex erkennt den Facade-Import nicht — kaputt?');
  DOMAIN_DB_IMPORT_RE.lastIndex = 0;
});

test("kein datetime('now') im Code (NOW_ISO_SQL-Pflicht)", () => {
  // scripts/hooks/ defines and explains the rule itself (messages name it).
  const files = [...serverFiles(), ...walk('public/js', JS).map(toRel)];
  const v = hits(files, DATETIME_NOW_RE, (f) => f.startsWith('scripts/hooks/'));
  assert.deepEqual(v, [], "datetime('now') liefert kein ISO+Z — ${NOW_ISO_SQL} aus db/now.js "
    + `interpolieren (auch in WHERE-Vergleichen):\n  ${v.join('\n  ')}`);
});

test('State explizit: jedes this.x = … ist vorab deklariert', () => {
  const rootKeys = new Set([...read('public/js/app/app-state.js').matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map((m) => m[1]));
  assert.ok(rootKeys.size > 3, 'app-state.js: keine Felder erkannt — Scan kaputt?');
  const violations = [];
  let assignments = 0;
  for (const f of walk('public/js', JS).map(toRel)) {
    const code = stripJsComments(read(f));
    const declared = new Set([
      ...[...code.matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map((m) => m[1]),
      ...[...code.matchAll(/^\s*([A-Za-z_]\w*)\s*,\s*$/gm)].map((m) => m[1]), // shorthand `note,`
      ...[...code.matchAll(/^\s*(?:async\s+|get\s+|set\s+)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/gm)].map((m) => m[1]),
    ]);
    const usesRoot = /\binitialState\(\)/.test(code);
    for (const m of code.matchAll(/\bthis\.([A-Za-z_]\w*)\s*(?:=(?!=)|\+=|-=|\+\+|--)/g)) {
      assignments++;
      if (!declared.has(m[1]) && !(usesRoot && rootKeys.has(m[1]))) {
        violations.push(`${f}:${lineOf(code, m.index)}: this.${m[1]} — nicht als Feld deklariert`);
      }
    }
  }
  assert.ok(assignments > 5, `nur ${assignments} this.x-Zuweisungen gefunden — Scan kaputt?`);
  assert.deepEqual(violations, [], 'Lazy State — Feld vorab deklarieren (Root: public/js/app/app-state.js, '
    + `Karten: als Initialfeld im Objekt-Literal):\n  ${violations.join('\n  ')}`);
});

test('Logging-Kontext: Route-Dateien mit req.params rufen setContext()', () => {
  const routes = walk('routes', JS).map(toRel);
  assert.ok(routes.length > 0, 'keine Route-Dateien gefunden?');
  const v = routes.filter((f) => {
    const code = stripJsComments(read(f));
    return /\breq\.params\b/.test(code) && !/\bsetContext\(/.test(code);
  });
  assert.deepEqual(v, [], 'Route liest req.params, fuellt aber den Log-Kontext nicht — '
    + `setContext({ entity: id }) aus lib/log-context.js aufrufen:\n  ${v.join('\n  ')}`);
});
