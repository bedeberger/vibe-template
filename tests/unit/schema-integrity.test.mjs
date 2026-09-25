// Gate for "Relationale Integrität" + "DB-Timestamps" (CLAUDE.md → Harte
// Regeln), checked on the real schema (squashed DDL in :memory:, which
// squash-drift.test.mjs pins equal to the migration chain):
//   1. every `*_id` column is a real FOREIGN KEY — no loose ids;
//   2. every FK column is indexed (leading column of an index, or the PK) —
//      otherwise every parent delete/cascade scans the child table;
//   3. every FK declares ON DELETE deliberately (CASCADE / SET NULL /
//      RESTRICT), never the implicit NO ACTION;
//   4. every `*_at` column is TEXT, and a default — if any — is the ISO+Z
//      strftime form, never datetime('now') / CURRENT_TIMESTAMP (no Z);
//   5. the migration runner (db/migrations.js) still runs foreign_key_check
//      after each step — the "every migration ends with foreign_key_check"
//      rule is enforced centrally there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { read } = require('../../scripts/hooks/_rules.js');
const { SQUASHED_SCHEMA } = require('../../db/squashed-schema/index.js');

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec(SQUASHED_SCHEMA);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all().map((r) => r.name).filter((t) => t !== 'schema_version');

test('Schema geladen (kein vacuous pass)', () => {
  assert.ok(tables.length >= 3, `nur ${tables.length} Tabellen im Squash — Pfad kaputt?`);
});

test('jede *_id-Spalte ist ein echter FOREIGN KEY', () => {
  const loose = [];
  for (const t of tables) {
    const fks = new Set(db.pragma(`foreign_key_list(${t})`).map((f) => f.from));
    for (const c of db.pragma(`table_info(${t})`)) {
      if (/_id$/.test(c.name) && !fks.has(c.name)) loose.push(`${t}.${c.name}`);
    }
  }
  assert.deepEqual(loose, [], `Lose ids ohne FK (REFERENCES … ON DELETE … ergaenzen): ${loose.join(', ')}`);
});

test('jede FK-Spalte ist indiziert und hat ein bewusstes ON DELETE', () => {
  const unindexed = [];
  const implicit = [];
  for (const t of tables) {
    const leading = new Set(db.pragma(`table_info(${t})`).filter((c) => c.pk === 1).map((c) => c.name));
    for (const idx of db.pragma(`index_list(${t})`)) {
      const cols = db.pragma(`index_info(${idx.name})`);
      if (cols.length) leading.add(cols[0].name);
    }
    for (const fk of db.pragma(`foreign_key_list(${t})`)) {
      if (!leading.has(fk.from)) unindexed.push(`${t}.${fk.from} → ${fk.table}`);
      if (!['CASCADE', 'SET NULL', 'RESTRICT', 'SET DEFAULT'].includes(fk.on_delete)) implicit.push(`${t}.${fk.from} (${fk.on_delete})`);
    }
  }
  assert.deepEqual(unindexed, [], `FK-Spalten ohne Index (CREATE INDEX idx_<t>_<col> ON <t>(<col>)): ${unindexed.join(', ')}`);
  assert.deepEqual(implicit, [], `FK ohne bewusstes ON DELETE (CASCADE fuer abgeleitete, SET NULL fuer kuratierte Daten): ${implicit.join(', ')}`);
});

test('jede *_at-Spalte ist TEXT mit ISO+Z-Default (oder ohne Default)', () => {
  const bad = [];
  for (const t of tables) {
    for (const c of db.pragma(`table_info(${t})`)) {
      if (!/_at$/.test(c.name)) continue;
      if (c.type.toUpperCase() !== 'TEXT') bad.push(`${t}.${c.name}: Typ ${c.type} (TEXT erwartet)`);
      const d = c.dflt_value;
      if (d != null && !/^\(?\s*strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now'\)\s*\)?$/.test(d)) {
        bad.push(`${t}.${c.name}: Default ${d} (ISO+Z via strftime('%Y-%m-%dT%H:%M:%fZ','now') erwartet)`);
      }
    }
  }
  assert.deepEqual(bad, [], `Timestamp-Spalten ohne ISO+Z:\n  ${bad.join('\n  ')}`);
});

test('Migrationen laufen mit foreign_key_check (Runner oder Datei)', () => {
  assert.match(read('db/migrations.js'), /foreign_key_check/,
    'db/migrations.js ruft PRAGMA foreign_key_check nach jeder Migration nicht mehr auf — dann muss jede Migration es selbst tun');
});
