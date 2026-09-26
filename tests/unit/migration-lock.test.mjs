// Unit: gate the forward-only migration invariant against the frozen register
// (db/migrations.lock.json). Catches the class of failure that crash-loops prod
// at boot — a released migration number reused for different DDL (0030
// "surrogate_pk" → 0030 "admin_disabled", original bumped to 0031): prod had
// applied the OLD meaning of v30 and chokes on the new chain.
//
// After adding a migration, run `npm run migrations:lock` and commit the updated
// lock (CLAUDE.md → Feature hinzufügen). The committed state must always verify.

import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lock = require('../../scripts/migrations-lock.js');

test('migration chain honours the frozen lock (no renumber/rewrite/insert-below-watermark)', () => {
  const violations = lock.verify();
  assert.deepEqual(
    violations,
    [],
    `Migrations-Lock-Verstöße:\n${violations.join('\n')}\n`
      + 'Ist die Änderung legitim (Migration noch nie deployt): „npm run migrations:lock" laufen lassen und den Lock-Diff prüfen.'
  );
});

test('committed lock is in sync with the migration files', () => {
  // The other direction: a NEW migration must be frozen (lock updated) before
  // it is merged, so the watermark advances and stays authoritative.
  const frozenVersions = new Set(lock.readLock().map((m) => m.version));
  const unfrozen = lock.computeEntries().filter((m) => !frozenVersions.has(m.version));
  assert.deepEqual(
    unfrozen.map((m) => `${m.version} (${m.name})`),
    [],
    'Nicht eingefrorene Migration(en) — „npm run migrations:lock" laufen lassen und committen.'
  );
});

test('verify catches a rewritten frozen migration', () => {
  // Synthetic proof the guard bites: tamper the fingerprint of a frozen entry.
  const frozen = lock.readLock().map((m) => ({ ...m }));
  frozen[frozen.length - 1].fingerprint = 'deadbeef';
  const violations = lock.verify(frozen, lock.computeEntries());
  assert.ok(violations.some((v) => v.includes('nachträglich geändert')), 'erwartete einen forward-only-Verstoß');
});

test('verify catches a migration inserted below the watermark', () => {
  const current = lock.computeEntries();
  const frozen = [...lock.readLock(), { version: 10, name: 'released_later', fingerprint: 'x' }];
  // A brand-new file reusing a number below the (synthetic) watermark 10.
  const injected = [...current, { version: 5, name: 'sneaky_insert', fingerprint: 'y' }];
  const violations = lock.verify(frozen, injected);
  assert.ok(violations.some((v) => v.includes('Wasserzeichen')), 'erwartete einen Wasserzeichen-Verstoß');
});

test('verify catches duplicate version numbers', () => {
  const current = lock.computeEntries();
  const dup = [...current, { ...current[0], name: 'other_name' }];
  const violations = lock.verify(lock.readLock(), dup);
  assert.ok(violations.some((v) => v.includes('Doppelte')), 'erwartete einen Doppelte-Version-Verstoß');
});
