'use strict';
// Segment: identity + runtime settings. No FK targets outside this segment.

module.exports = `
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
