// Unit: migration 0003 backfills notes.position on a POPULATED table — the
// fresh-chain tests only see empty tables. Existing order (newest update
// first, per notebook) must survive as the new manual order.

import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import migrations from '../../db/migrations.js';

test('0003 backfills position from the previous order, per notebook', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.pragma('foreign_keys = ON');
  const all = migrations.loadMigrations();
  for (const m of all.filter((x) => x.version < 3)) m.up(db);

  db.exec(`
    INSERT INTO notebooks (id, name) VALUES (1, 'A'), (2, 'B');
    INSERT INTO notes (id, notebook_id, title, updated_at) VALUES
      (1, 1, 'old',    '2026-01-01T08:00:00.000Z'),
      (2, 1, 'new',    '2026-01-03T08:00:00.000Z'),
      (3, 1, 'middle', '2026-01-02T08:00:00.000Z'),
      (4, 2, 'tie-lo', '2026-01-01T08:00:00.000Z'),
      (5, 2, 'tie-hi', '2026-01-01T08:00:00.000Z');
  `);
  all.find((x) => x.version === 3).up(db);

  const order = (nb) => db.prepare('SELECT title, position FROM notes WHERE notebook_id = ? ORDER BY position').all(nb);
  assert.deepEqual(order(1), [
    { title: 'new', position: 0 }, { title: 'middle', position: 1 }, { title: 'old', position: 2 },
  ]);
  // Same timestamp: the higher id (inserted later) stays on top, as before.
  assert.deepEqual(order(2), [{ title: 'tie-hi', position: 0 }, { title: 'tie-lo', position: 1 }]);
});
