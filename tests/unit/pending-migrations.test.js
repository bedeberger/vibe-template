'use strict';
// Unit: the counter the deploy rollback uses to decide whether to restore the
// DB (scripts/pending-migrations.js).
//
// The number drives a destructive step: `0` means "leave the DB alone",
// anything else means "restore from the pre-deploy backup". A wrong `0` loses
// nothing but leaves prod on a schema that doesn't match the rolled-back code —
// and a swallowed error passing as `0` would be exactly that. So every unclear
// state returns `-1` (unknown ⇒ restore conservatively), proven one by one here.

const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');

const { pendingCount, UNKNOWN } = require('../../scripts/pending-migrations.js');
const { loadMigrations } = require('../../db/migrations');
const { tempDbPath, removeDb } = require('../_helpers/temp-db');

const CHAIN = loadMigrations();
const HIGHEST = CHAIN.at(-1).version;

const tmpFiles = [];
function tmpDb(build) {
  const file = tempDbPath('pending');
  tmpFiles.push(file);
  const db = new Database(file);
  build(db);
  db.close();
  return file;
}
function stamped(...versions) {
  return tmpDb((db) => {
    db.exec('CREATE TABLE schema_version (version INTEGER NOT NULL, applied_at TEXT)');
    const ins = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
    for (const v of versions) ins.run(v);
  });
}

test.after(() => tmpFiles.forEach(removeDb));

test('a DB at the current version has zero pending migrations', () => {
  assert.equal(pendingCount(stamped(HIGHEST)), 0);
});

test('a lagging DB counts exactly the missing migrations', () => {
  // One step behind the newest migration (works for a chain of any length).
  const from = HIGHEST - 1;
  const expected = CHAIN.filter((m) => m.version > from).length;
  assert.ok(expected >= 1);
  assert.equal(pendingCount(stamped(from)), expected);
});

test('MAX() counts, not the most recently inserted row', () => {
  // schema_version is a history, not a single row — stamp order is not
  // guaranteed to be version order.
  assert.equal(pendingCount(stamped(HIGHEST, HIGHEST - 1)), 0);
});

test('unknown (-1) instead of 0 when the question cannot be answered', () => {
  // (a) file does not exist
  assert.equal(pendingCount(tempDbPath('pending-missing')), UNKNOWN);
  // (b) no path given
  assert.equal(pendingCount(undefined), UNKNOWN);
  assert.equal(pendingCount(''), UNKNOWN);
  // (c) DB without schema_version — the chain never ran here, state is open
  assert.equal(pendingCount(tmpDb((db) => db.exec('CREATE TABLE x (id INTEGER PRIMARY KEY)'))), UNKNOWN);
});

test('an empty schema_version counts the WHOLE chain as pending', () => {
  assert.equal(pendingCount(stamped()), CHAIN.length);
});
