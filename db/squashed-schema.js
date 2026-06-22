'use strict';
// Squashed final schema — the flattened result of running the whole migration
// chain. Brand-new installs apply this single batch instead of replaying every
// migration (fast path in schema.js).
//
// SQUASHED_VERSION MUST equal the highest migration number. The squashed DDL
// MUST stay byte-for-byte equivalent (after normalization) to what the chain
// produces — tests/unit/squash-drift.test.mjs gates exactly that. When you add
// migration N, fold its DDL in here and bump SQUASHED_VERSION to N.

const SQUASHED_VERSION = 1;

const SQUASHED_SCHEMA = `
  CREATE TABLE notebooks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_notes_notebook_id ON notes(notebook_id);

  CREATE TABLE jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,
    note_id     INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    status      TEXT    NOT NULL DEFAULT 'queued',
    status_text TEXT,
    result_json TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    finished_at TEXT
  );
  CREATE INDEX idx_jobs_note_id ON jobs(note_id);
  CREATE INDEX idx_jobs_status  ON jobs(status);

  CREATE TABLE app_users (
    email        TEXT PRIMARY KEY,
    display_name TEXT,
    global_role  TEXT NOT NULL DEFAULT 'user',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_seen_at TEXT
  );

  CREATE TABLE app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;

module.exports = { SQUASHED_SCHEMA, SQUASHED_VERSION };
