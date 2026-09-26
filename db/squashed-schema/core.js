'use strict';
// Segment: identity + runtime settings. No FK targets outside this segment.
// app_users.status stands after last_seen_at in ALTER form (migration 0002
// appended it) — the squash must match what the chain leaves in sqlite_master.

module.exports = `
  CREATE TABLE app_users (
    email        TEXT PRIMARY KEY,
    display_name TEXT,
    global_role  TEXT NOT NULL DEFAULT 'user',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_seen_at TEXT
  , status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')));

  CREATE TABLE user_credentials (
    user_email    TEXT PRIMARY KEY REFERENCES app_users(email) ON DELETE CASCADE ON UPDATE CASCADE,
    password_hash TEXT    NOT NULL,
    must_change   INTEGER NOT NULL DEFAULT 0 CHECK (must_change IN (0, 1)),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;
