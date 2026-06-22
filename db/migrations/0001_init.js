'use strict';
// Migration 0001 — initial schema.
//
// Conventions enforced here (and required of every future migration):
//   • Every *_id column is a real FOREIGN KEY (no loose ids).
//   • Every FK column has an index.
//   • ON DELETE is deliberate: CASCADE for derived/owned rows, SET NULL for
//     curated data you want to keep after the parent disappears.
//   • Every *_at column defaults to ISO-8601 + Z (see db/now.js).
//
// Each migration exports { version, name, up(db) }. The runner wraps the call
// in a transaction and runs `PRAGMA foreign_key_check` afterwards.

module.exports = {
  version: 1,
  name: 'init',
  up(db) {
    db.exec(`
      -- Parent entity. Demonstrates the owning side of a FK relationship.
      CREATE TABLE notebooks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- Core domain entity (the "replace me" example). Owned by a notebook;
      -- deleting the notebook cascades to its notes.
      CREATE TABLE notes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL,
        body        TEXT    NOT NULL DEFAULT '',
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_notes_notebook_id ON notes(notebook_id);

      -- Generic background-job table (no AI in this template). A job is tied to
      -- the note it operates on; cascade-delete keeps it from outliving its row.
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

      -- Authenticated users. Email is the natural key (OIDC subject email).
      CREATE TABLE app_users (
        email        TEXT PRIMARY KEY,
        display_name TEXT,
        global_role  TEXT NOT NULL DEFAULT 'user',
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        last_seen_at TEXT
      );

      -- Key/value app settings (e.g. app.timezone). Single source for runtime config.
      CREATE TABLE app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  },
};
