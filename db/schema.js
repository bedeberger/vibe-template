'use strict';
// Entry point for DB setup. Importing this module guarantees the schema is
// current: fresh DBs get the squashed schema in one batch, existing DBs replay
// pending migrations. server.js requires this once at boot.

const { db, DB_FILE } = require('./connection');
const { SQUASHED_SCHEMA, SQUASHED_VERSION } = require('./squashed-schema');
const { ensureVersionTable, currentVersion, stampVersion, runMigrations } = require('./migrations');
const logger = require('../logger');

const hasVersionTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
  .get();

// Fresh install iff schema_version is absent. FORCE_LEGACY_MIGRATIONS opts out
// (drift test exercises the full chain on an otherwise-fresh DB).
const isFreshInstall = !hasVersionTable && process.env.FORCE_LEGACY_MIGRATIONS !== '1';

if (isFreshInstall) {
  const tx = db.transaction(() => {
    db.exec(SQUASHED_SCHEMA);
    ensureVersionTable(db);
    stampVersion(db, SQUASHED_VERSION);
  });
  tx();
  const violations = db.pragma('foreign_key_check');
  if (violations.length) {
    throw new Error(`Squashed schema left FK violations: ${JSON.stringify(violations)}`);
  }
  logger.info(`DB fresh-initialised via squashed schema (version ${SQUASHED_VERSION}).`);
}

// Always run the chain — a no-op after a fresh squash, applies the tail on
// upgrades from an older version.
const applied = runMigrations(db, logger);
if (applied > 0) logger.info(`Applied ${applied} pending migration(s). Now at v${currentVersion(db)}.`);

module.exports = { db, DB_FILE };
