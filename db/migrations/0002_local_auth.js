'use strict';
// Migration 0002 — local user management (docs/auth.md).
//
//   • app_users.status — an admin can disable an account without deleting it.
//     A disabled user can neither log in nor keep an open session.
//   • user_credentials — one scrypt hash per locally managed account. A row of
//     its own (not a column on app_users): OIDC users and the .env admin have
//     no password in the DB, and "has a local password" is then a row that
//     exists or not — no NULL-means-something column. Deleting the user
//     cascades; renaming an email follows (ON UPDATE CASCADE).

module.exports = {
  version: 2,
  name: 'local_auth',
  up(db) {
    db.exec(`
      ALTER TABLE app_users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'));

      CREATE TABLE user_credentials (
        user_email    TEXT PRIMARY KEY REFERENCES app_users(email) ON DELETE CASCADE ON UPDATE CASCADE,
        password_hash TEXT    NOT NULL,
        must_change   INTEGER NOT NULL DEFAULT 0 CHECK (must_change IN (0, 1)),
        updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
  },
};
