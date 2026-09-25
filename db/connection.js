'use strict';
// Single better-sqlite3 connection, shared process-wide.
// PRAGMAs mirror a local-first, single-writer setup. foreign_keys=ON is
// non-negotiable (see CLAUDE.md → Harte Regeln: relationale Integrität).

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Under NODE_ENV=test the repo app.db is NEVER the right file: every test
// process sets its own temp DB via DB_PATH before requiring anything. Without
// this guard, a test that pulls the connection in only through its require
// chain (seemingly "pure logic") silently falls back to the repo DB — and on a
// FRESH checkout several parallel `node --test` processes then create it at the
// same time and one dies with "table … already exists". Invisible locally (the
// app.db is already migrated), red only in CI. Hence loud and immediate here.
if (process.env.NODE_ENV === 'test' && !process.env.DB_PATH) {
  throw new Error(
    'DB_PATH missing: a test must not open the repo app.db. '
    + 'Set a temp DB before the first require (see tests/unit/note-store.test.js).'
  );
}

const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');

// better-sqlite3 will not create missing parent directories — ensure them so a
// configured DB_PATH on a fresh volume (or a temp test path) just works.
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('temp_store = MEMORY');

module.exports = { db, DB_FILE };
