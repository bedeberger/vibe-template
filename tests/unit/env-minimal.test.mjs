// Gate for CLAUDE.md → Harte Regeln "`.env` nur minimal": the server code reads
// only the environment variables listed below. Everything else an operator
// might want to change is an app setting (lib/app-settings.js, admin console →
// "Einstellungen"), editable at runtime without SSH + restart.
//
//   1. Every `process.env.X` in server code (server.js, logger.js, lib/,
//      routes/, db/) is on the allowlist.
//   2. .env.example documents exactly the operator-facing part of it.
//
// NOT checked: scripts/ and tests/ (tooling, not app config), and indirect
// reads (`process.env[name]`) — there are none, keep it that way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, walk, toRel, read, stripJsComments, lineOf } = require('../../scripts/hooks/_rules.js');

// The allowlist. A new entry needs one of the three reasons — otherwise it is
// an app setting, not an env var.
const ALLOWED = {
  // Secrets — must never sit in the DB or reach the browser.
  SESSION_SECRET: 'secret',
  ADMIN_PASSWORD: 'secret (break-glass admin, independent of the DB)',
  OIDC_CLIENT_SECRET: 'secret',
  // Bootstrap — needed before the DB is open, or the way INTO the console.
  DB_PATH: 'bootstrap (where the settings live)',
  LOG_PATH: 'bootstrap (logger starts before the DB)',
  PORT: 'bootstrap (listener)',
  ADMIN_EMAIL: 'bootstrap (who may open the console at all)',
  // Per process / environment — a DB value would be shared by every instance.
  NODE_ENV: 'per process (set by the systemd unit)',
  LOG_LEVEL: 'per process (tests run quiet, a debug run is loud)',
  SCHEDULER: 'per process (second instance on the same DB)',
  LOCAL_DEV_MODE: 'per process (dev only, forbidden in production)',
  DEV_USER_EMAIL: 'per process (dev only)',
  FORCE_LEGACY_MIGRATIONS: 'per process (migration tests only, not in .env.example)',
};
// Allowed but deliberately NOT in .env.example (set by the unit or by tests).
const NOT_IN_EXAMPLE = new Set(['NODE_ENV', 'FORCE_LEGACY_MIGRATIONS']);

const JS = ['.js', '.mjs', '.cjs'];
const serverFiles = () => [
  ...['lib', 'routes', 'db'].flatMap((d) => walk(d, JS)),
  ...['server.js', 'logger.js'].filter((f) => existsSync(join(ROOT, f))).map((f) => join(ROOT, f)),
].map(toRel);

const ENV_READ_RE = /process\.env\.([A-Z_][A-Z0-9_]*)/g;

test('Servercode liest nur erlaubte Umgebungsvariablen', () => {
  const seen = new Set();
  const violations = serverFiles().flatMap((f) => {
    const code = stripJsComments(read(f));
    return [...code.matchAll(ENV_READ_RE)].flatMap((m) => {
      seen.add(m[1]);
      return m[1] in ALLOWED ? [] : [`${f}:${lineOf(code, m.index)}: ${m[1]}`];
    });
  });
  assert.ok(seen.has('SESSION_SECRET'), 'Scan findet process.env.SESSION_SECRET nicht — Regex kaputt?');
  assert.deepEqual(violations, [], 'Neue Umgebungsvariable im Servercode. Laufzeit-Konfiguration ist ein '
    + 'Setting in lib/app-settings.js (SETTINGS-Register + Admin-Konsole → Einstellungen), keine .env-Zeile. '
    + 'Nur Secret / Bootstrap vor der DB / pro Prozess darf in ALLOWED (tests/unit/env-minimal.test.mjs), '
    + `mit Begründung (CLAUDE.md ".env nur minimal"):\n  ${violations.join('\n  ')}`);
});

test('.env.example dokumentiert genau die erlaubten Variablen', () => {
  const keys = [...read('.env.example').matchAll(/^#?\s*([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]);
  const expected = Object.keys(ALLOWED).filter((k) => !NOT_IN_EXAMPLE.has(k)).sort();
  assert.deepEqual([...new Set(keys)].sort(), expected,
    '.env.example weicht von der Allowlist ab — eine Variable, die dort steht, aber nicht erlaubt ist, gehört '
    + 'als Setting in die Admin-Konsole; eine erlaubte, die fehlt, dort mit Kommentar ergänzen.');
});
