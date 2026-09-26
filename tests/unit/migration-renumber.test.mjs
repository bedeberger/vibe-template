// Unit: the renumberer for the most common rebase collision
// (scripts/migration-renumber.js).
//
// Checked is the PLAN, not the git mechanics: the one decision that can go
// wrong is *which* file gets touched. A migration that is already in
// origin/main may be deployed — renumbering it is exactly the forward-only
// violation db/migrations.lock.json catches. The plan must hit the own side of
// the collision, and only that.

import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { planRenumber, rewriteVersion, parseName, fileName } = require('../../scripts/migration-renumber.js');

test('the own file moves, never the one from origin/main', () => {
  // The everyday case: both picked 0141 under different names — git reports
  // NO conflict, it puts them side by side.
  const remote = ['0139_a.js', '0140_b.js', '0141_theirs.js'];
  const local = [...remote, '0141_mine.js'];

  const { remoteMax, moves } = planRenumber(local, remote);
  assert.equal(remoteMax, 141);
  assert.deepEqual(moves, [{ from: 141, to: 142, oldName: '0141_mine.js', newName: '0142_mine.js' }]);
});

test('several own migrations keep their order', () => {
  // They may build on each other — 0141 before 0142 must become 0143 before 0144.
  const remote = ['0140_b.js', '0141_theirs.js', '0142_theirs_too.js'];
  const local = [...remote, '0142_mine_two.js', '0141_mine_one.js'];

  const { moves } = planRenumber(local, remote);
  assert.deepEqual(
    moves.map((m) => [m.oldName, m.newName]),
    [
      ['0141_mine_one.js', '0143_mine_one.js'],
      ['0142_mine_two.js', '0144_mine_two.js'],
    ]
  );
});

test('without a collision nothing is touched', () => {
  const remote = ['0140_b.js'];
  assert.deepEqual(planRenumber([...remote, '0141_mine.js'], remote).moves, []);
});

test('once one own migration collides, every later own one moves along', () => {
  // Mixed: 0141 collides, 0145 doesn't — but 0145 may build on 0141, so both
  // move and keep their order (0143 before 0144).
  const remote = ['0141_theirs.js', '0142_theirs.js'];
  const local = [...remote, '0141_mine.js', '0145_mine_later.js'];

  const { moves } = planRenumber(local, remote);
  assert.deepEqual(moves.map((m) => [m.oldName, m.newName]), [
    ['0141_mine.js', '0143_mine.js'],
    ['0145_mine_later.js', '0144_mine_later.js'],
  ]);
});

test('a move never lands on the number of another own migration', () => {
  // Regression: remote adds 0005 while 0005_mine + 0006_mine2 are local.
  // Moving only the collider would put 0005_mine on 0006 next to 0006_mine2.
  const remote = ['0004_a.js', '0005_theirs.js'];
  const local = [...remote, '0005_mine.js', '0006_mine2.js'];

  const names = planRenumber(local, remote).moves.map((m) => m.newName);
  assert.deepEqual(names, ['0006_mine.js', '0007_mine2.js']);
});

test('an empty origin/main leaves everything own in place', () => {
  // Edge case: remoteMax = 0, so every own migration is above it.
  const { remoteMax, moves } = planRenumber(['0001_init.js', '0002_more.js'], []);
  assert.equal(remoteMax, 0);
  assert.deepEqual(moves, []);
});

test('non-migrations in the directory are ignored', () => {
  const remote = ['0140_b.js'];
  const local = [...remote, 'README.md', '.eslintrc.js', '0140_mine_same_number.js'];
  assert.deepEqual(planRenumber(local, remote).moves.map((m) => m.newName), ['0141_mine_same_number.js']);
});

test('the version field is rewritten, the rest of the file is not', () => {
  const src = [
    "'use strict';",
    '// Migration 0141 — something. See migration 141 above.',
    'module.exports = {',
    '  version: 141,',
    "  name: 'something',",
    '  up(db) {',
    '    db.exec("CREATE TABLE t141 (id INTEGER PRIMARY KEY)");',
    '  },',
    '};',
  ].join('\n');

  const out = rewriteVersion(src, 141, 143);
  assert.match(out, /^ {2}version: 143,$/m);
  // Comment and table name stay — guessing there would confuse prose and DDL;
  // the script reports them as remaining work instead.
  assert.match(out, /Migration 0141 — something/);
  assert.match(out, /CREATE TABLE t141/);
});

test('rewriteVersion returns null when the field is missing', () => {
  // The caller then aborts instead of moving the file half-way.
  assert.equal(rewriteVersion('module.exports = { version: 99 };', 141, 143), null);
});

test('parseName/fileName are inverse', () => {
  const p = parseName('0007_auth_extra.js');
  assert.deepEqual(p, { version: 7, slug: 'auth_extra' });
  assert.equal(fileName(p.version, p.slug), '0007_auth_extra.js');
  assert.equal(fileName(143, 'x'), '0143_x.js');
  assert.equal(parseName('not-a-migration.js'), null);
});
