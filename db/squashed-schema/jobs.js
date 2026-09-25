'use strict';
// Segment: the generic background-job table. Stands after ./notes.js because
// jobs.note_id points there.

module.exports = `
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
`;
