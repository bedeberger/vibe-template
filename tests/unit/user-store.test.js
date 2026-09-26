'use strict';
// Unit: the lib/user-store.js facade against a throwaway DB — the invariants of
// docs/auth.md: normalised emails, env-managed admin untouchable, admin-set
// passwords are initial ones, disabled status judged after the password,
// role only from the env.

const test = require('node:test');
const assert = require('node:assert');

require('../_helpers/temp-db').useTempDb('users', {
  ADMIN_EMAIL: 'Chef@Example.com',
  ADMIN_PASSWORD: 'env-admin-passwort-lang',
});
const users = require('../../lib/user-store');

test('syncEnvAdmins: the .env admin exists as admin, others are demoted', () => {
  users.syncEnvAdmins();
  const admin = users.getUserView('chef@example.com');
  assert.equal(admin.role, 'admin');
  assert.equal(admin.env_managed, true);
  assert.equal(admin.has_password, false, 'the admin password never lands in the DB');
});

test('createUser normalises the email and stores an INITIAL password', async () => {
  const u = await users.createUser({ email: '  Eva@Example.COM ', displayName: ' Eva ', password: 'initial-passwort-1' });
  assert.equal(u.email, 'eva@example.com');
  assert.equal(u.display_name, 'Eva');
  assert.equal(u.role, 'user');
  assert.equal(u.must_change, true);
  assert.match(u.created_at, /Z$/);
});

test('createUser rejects duplicates, bad emails, short passwords, the admin address', async () => {
  await assert.rejects(users.createUser({ email: 'eva@example.com', password: 'initial-passwort-1' }), /user exists/);
  await assert.rejects(users.createUser({ email: 'kein-at', password: 'initial-passwort-1' }), /valid email required/);
  await assert.rejects(users.createUser({ email: 'kurz@example.com', password: 'kurz' }), /password too short/);
  await assert.rejects(users.createUser({ email: 'CHEF@example.com', password: 'initial-passwort-1' }), /managed by env/);
});

test('verifyCredentials: initial password → mustChange; wrong / unknown → not ok', async () => {
  const ok = await users.verifyCredentials('EVA@example.com', 'initial-passwort-1');
  assert.equal(ok.ok, true);
  assert.equal(ok.mustChange, true);
  assert.equal((await users.verifyCredentials('eva@example.com', 'falsch-falsch-1')).ok, false);
  assert.equal((await users.verifyCredentials('niemand@example.com', 'initial-passwort-1')).ok, false);
  assert.equal((await users.verifyCredentials('chef@example.com', 'env-admin-passwort-lang')).ok, false,
    'the env admin never authenticates against the DB');
});

test('changePassword: re-authenticates, clears must_change, refuses the same password', async () => {
  await assert.rejects(users.changePassword('eva@example.com', 'initial-passwort-1', 'initial-passwort-1'), /password unchanged/);
  assert.equal((await users.changePassword('eva@example.com', 'falsch-falsch-1', 'neues-passwort-99')).ok, false);
  const r = await users.changePassword('eva@example.com', 'initial-passwort-1', 'neues-passwort-99');
  assert.equal(r.ok, true);
  const again = await users.verifyCredentials('eva@example.com', 'neues-passwort-99');
  assert.equal(again.mustChange, false);
});

test('disabled status is reported only after a correct password', async () => {
  users.updateUser('eva@example.com', { status: 'disabled' });
  const r = await users.changePassword('eva@example.com', 'neues-passwort-99', 'noch-ein-passwort');
  assert.deepEqual({ ok: r.ok, denied: r.denied }, { ok: true, denied: 'disabled' });
  assert.throws(() => users.updateUser('eva@example.com', { status: 'kaputt' }), /invalid status/);
  users.updateUser('eva@example.com', { status: 'active' });
});

test('setInitialPassword forces a change again', async () => {
  const u = await users.setInitialPassword('eva@example.com', 'wieder-initial-12');
  assert.equal(u.must_change, true);
});

test('the env admin cannot be changed, reset or deleted', async () => {
  assert.throws(() => users.updateUser('chef@example.com', { status: 'disabled' }), /managed by env/);
  await assert.rejects(users.setInitialPassword('chef@example.com', 'irgendein-passwort'), /managed by env/);
  assert.throws(() => users.deleteUser('chef@example.com'), /managed by env/);
});

test('unknown user → not found; delete removes the credential too', async () => {
  assert.throws(() => users.updateUser('weg@example.com', { status: 'disabled' }), /not found/);
  assert.equal(users.deleteUser('eva@example.com'), true);
  assert.equal(users.getUser('eva@example.com'), undefined);
  assert.equal((await users.verifyCredentials('eva@example.com', 'wieder-initial-12')).ok, false);
});
