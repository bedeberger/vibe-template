// Unit: the migration chain must apply with PRAGMA foreign_keys = ON, exactly
// like the running app — the UPGRADE path, not the fresh install (which builds
// from the squash). squash-drift.test.mjs runs the chain too, but on a bare
// :memory: DB WITHOUT FK enforcement, where FK-dependent errors stay invisible.
// This test catches FK-ordering bugs (target table created after the
// reference) and CREATE errors.
//
// It does NOT catch "ADD COLUMN … REFERENCES … with a non-NULL default on a
// POPULATED table": that only fires when the table already has rows, and in a
// fresh chain every table is empty. Cover that class with a seed-based test
// per migration (migration-000N-*.test.mjs) when you write such a migration.

import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import migrations from '../../db/migrations.js';

test('full migration chain applies cleanly with foreign_keys ON', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON'); // prod-faithful — otherwise ALTER errors stay hidden
  assert.doesNotThrow(() => migrations.runMigrations(db, { info() {} }));

  const highest = migrations.loadMigrations().at(-1).version;
  assert.equal(migrations.currentVersion(db), highest, `chain ends at v${highest}`);
  assert.deepEqual(db.pragma('foreign_key_check'), [], 'no FK violations after the chain');
});
