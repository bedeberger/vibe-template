'use strict';
// Segment: the example domain (notebook → notes). Replace with your entity.
// notes.position stands after updated_at in ALTER form (migration 0003
// appended it) — the squash must match what the chain leaves in sqlite_master.

module.exports = `
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
  , position INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX idx_notes_notebook_id ON notes(notebook_id);
`;
