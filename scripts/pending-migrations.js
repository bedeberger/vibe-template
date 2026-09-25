'use strict';
// How many migrations would this DB still apply on its next boot?
//
// The only consumer is the deploy (.github/workflows/deploy.yml): the number
// decides whether a rollback MUST restore the DB from the pre-deploy backup or
// MAY leave it alone.
//
// Why: restoring the DB unconditionally on every rollback is right when a
// migration ran — the chain is forward-only, the rolled-back code no longer
// matches the advanced schema. But if the deploy failed on a plain code error
// (health check red, no pending migration), the same restore is pure data loss:
// everything users entered between backup and rollback is gone.
//
// Output: ONE number on stdout. `-1` means UNKNOWN (DB unreadable, no
// schema_version) — the caller treats that like "a migration ran", i.e.
// conservatively in favour of restoring. A `0` is therefore always a proven
// statement, never a swallowed error.
//
//   node scripts/pending-migrations.js /path/to/app.db
//   DB_PATH=/path/to/app.db node scripts/pending-migrations.js

const Database = require('better-sqlite3');
const { loadMigrations } = require('../db/migrations');

const UNKNOWN = -1;

// Counts migrations with `version > MAX(schema_version.version)`. Returns
// UNKNOWN as soon as anything can't be answered unambiguously.
function pendingCount(dbPath) {
  if (!dbPath) return UNKNOWN;
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return UNKNOWN;
  }
  try {
    const hasTable = db
      .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'")
      .get();
    if (!hasTable) return UNKNOWN;
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
    // Empty table: the chain never ran — everything is pending.
    const from = row && row.v != null ? row.v : 0;
    return loadMigrations().filter((m) => m.version > from).length;
  } catch {
    return UNKNOWN;
  } finally {
    db.close();
  }
}

module.exports = { pendingCount, UNKNOWN };

if (require.main === module) {
  const target = process.argv[2] || process.env.DB_PATH;
  process.stdout.write(`${pendingCount(target)}\n`);
}
