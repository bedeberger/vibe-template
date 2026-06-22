'use strict';
// Migration runner. Numbered, forward-only chain. Each step runs in a
// transaction and is followed by `PRAGMA foreign_key_check` — a migration that
// leaves a dangling FK fails loudly instead of corrupting the DB silently.
//
// Fresh installs skip the chain: schema.js installs SQUASHED_SCHEMA in one
// batch and stamps the version. Existing installs replay only pending steps.
//
// FORCE_LEGACY_MIGRATIONS=1 forces the full chain even on a fresh DB — used by
// the squash-drift test to prove the chain and the squash agree. Never in prod.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function loadMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.js$/.test(f))
    .map((f) => require(path.join(MIGRATIONS_DIR, f)))
    .sort((a, b) => a.version - b.version);
}

function ensureVersionTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`);
}

function currentVersion(db) {
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
  return row && row.v != null ? row.v : 0;
}

function stampVersion(db, version) {
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
}

// Runs every migration with version > current. Returns the number applied.
function runMigrations(db, logger = console) {
  ensureVersionTable(db);
  const from = currentVersion(db);
  const pending = loadMigrations().filter((m) => m.version > from);
  for (const m of pending) {
    const tx = db.transaction(() => {
      m.up(db);
      stampVersion(db, m.version);
    });
    tx();
    const violations = db.pragma('foreign_key_check');
    if (violations.length) {
      throw new Error(
        `Migration ${m.version} (${m.name}) left FK violations: ${JSON.stringify(violations)}`
      );
    }
    logger.info?.(`Migration ${m.version} (${m.name}) applied.`);
  }
  return pending.length;
}

module.exports = {
  loadMigrations,
  ensureVersionTable,
  currentVersion,
  stampVersion,
  runMigrations,
};
