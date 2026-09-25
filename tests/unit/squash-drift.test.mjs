// Unit: gate that the squashed schema and the migration chain produce the SAME
// schema. If they drift, a fresh install (squash) and an upgraded install
// (chain) would diverge silently. Fold every new migration into the squash.

import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import squash from '../../db/squashed-schema/index.js';
import migrations from '../../db/migrations.js';

// sqlite_master dump, normalized: ignore whitespace and the runner-managed
// schema_version table; order-independent (sorted by type+name).
function schemaDump(db) {
  return db
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND name <> 'schema_version'
       ORDER BY type, name`
    )
    .all()
    .map((r) => `${r.type} ${r.name}: ${String(r.sql || '').replace(/\s+/g, ' ').trim()}`)
    .join('\n');
}

test('squashed schema matches the migration chain', () => {
  const squashed = new Database(':memory:');
  squashed.exec(squash.SQUASHED_SCHEMA);

  const chained = new Database(':memory:');
  migrations.runMigrations(chained, { info() {} });

  assert.equal(schemaDump(chained), schemaDump(squashed));
});

test('SQUASHED_VERSION equals the highest migration number', () => {
  const highest = migrations.loadMigrations().at(-1).version;
  assert.equal(squash.SQUASHED_VERSION, highest);
});
