'use strict';
// Integration: local user management end to end (docs/auth.md) — the .env admin
// logs in with ADMIN_PASSWORD, creates a user with an initial password, the
// user is forced to set their own, the admin guard holds, disabling ends an
// open session, and the shared rate limit kicks in.

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');

const ADMIN = { email: 'admin@example.com', password: 'env-admin-passwort-sehr-lang' };
const ctx = bootstrap({ LOCAL_DEV_MODE: '0', ADMIN_EMAIL: 'Admin@Example.com', ADMIN_PASSWORD: ADMIN.password });
test.before(ctx.start);
test.after(ctx.stop);

// Minimal cookie jar per "browser".
function client() {
  let cookie = '';
  const call = async (p, { method = 'GET', body } = {}) => {
    const res = await fetch(ctx.url(p), {
      method,
      redirect: 'manual',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, headers: res.headers };
  };
  return { call };
}

const admin = client();
const eva = client();

test('methods: local is the default, admin login is on', async () => {
  const r = await client().call('/auth/methods');
  assert.deepEqual(r.json, { method: 'local', adminLogin: true, devMode: false });
});

test('without session: API 401, page redirects to /login', async () => {
  const c = client();
  assert.equal((await c.call('/api/me')).status, 401);
  const page = await c.call('/');
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/login');
});

test('the .env admin logs in with ADMIN_PASSWORD only', async () => {
  assert.equal((await admin.call('/auth/login', { method: 'POST', body: { email: ADMIN.email, password: 'falsch' } })).status, 401);
  const ok = await admin.call('/auth/login', { method: 'POST', body: { email: 'ADMIN@example.com', password: ADMIN.password } });
  assert.equal(ok.status, 200);
  const me = await admin.call('/api/me');
  assert.equal(me.json.email, ADMIN.email);
  assert.equal(me.json.role, 'admin');
});

test('admin lists users; the env admin is read-only and has no DB password', async () => {
  const list = (await admin.call('/api/admin/users')).json;
  const self = list.find((u) => u.email === ADMIN.email);
  assert.equal(self.env_managed, true);
  assert.equal(self.has_password, false);
  assert.equal((await admin.call(`/api/admin/users/${ADMIN.email}`, { method: 'PATCH', body: { status: 'disabled' } })).status, 409);
  assert.equal((await admin.call(`/api/admin/users/${ADMIN.email}`, { method: 'DELETE' })).status, 409);
});

test('admin creates a user; validation errors map to 400 / 409', async () => {
  const bad = await admin.call('/api/admin/users', { method: 'POST', body: { email: 'eva@example.com', password: 'kurz' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'password too short');
  const created = await admin.call('/api/admin/users', {
    method: 'POST', body: { email: 'Eva@Example.com', display_name: 'Eva', password: 'initial-passwort-1' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.must_change, true);
  const dup = await admin.call('/api/admin/users', { method: 'POST', body: { email: 'eva@example.com', password: 'initial-passwort-1' } });
  assert.equal(dup.status, 409);
});

test('initial password: login opens NO session, the change does', async () => {
  const first = await eva.call('/auth/login', { method: 'POST', body: { email: 'eva@example.com', password: 'initial-passwort-1' } });
  assert.deepEqual(first.json, { ok: true, mustChange: true });
  assert.equal((await eva.call('/api/me')).status, 401);

  const weak = await eva.call('/auth/password', {
    method: 'POST', body: { email: 'eva@example.com', password: 'initial-passwort-1', newPassword: 'kurz' },
  });
  assert.equal(weak.status, 400);
  const changed = await eva.call('/auth/password', {
    method: 'POST', body: { email: 'eva@example.com', password: 'initial-passwort-1', newPassword: 'evas-eigenes-pw-1' },
  });
  assert.equal(changed.status, 200);
  const me = await eva.call('/api/me');
  assert.equal(me.json.role, 'user');
});

test('a plain user gets 403 on the admin API', async () => {
  assert.equal((await eva.call('/api/admin/users')).status, 403);
});

test('disabling ends the open session at once; login then answers 403', async () => {
  const r = await admin.call('/api/admin/users/eva@example.com', { method: 'PATCH', body: { status: 'disabled' } });
  assert.equal(r.json.status, 'disabled');
  assert.equal((await eva.call('/api/me')).status, 401);
  const login = await client().call('/auth/login', { method: 'POST', body: { email: 'eva@example.com', password: 'evas-eigenes-pw-1' } });
  assert.equal(login.status, 403);
});

test('admin reset → initial password again; delete removes the account', async () => {
  await admin.call('/api/admin/users/eva@example.com', { method: 'PATCH', body: { status: 'active' } });
  const reset = await admin.call('/api/admin/users/eva@example.com/password', { method: 'PUT', body: { password: 'neues-initial-99' } });
  assert.equal(reset.json.must_change, true);
  const login = await client().call('/auth/login', { method: 'POST', body: { email: 'eva@example.com', password: 'neues-initial-99' } });
  assert.equal(login.json.mustChange, true);
  assert.equal((await admin.call('/api/admin/users/eva@example.com', { method: 'DELETE' })).json.deleted, true);
  assert.equal((await admin.call('/api/admin/users/eva@example.com', { method: 'DELETE' })).status, 404);
});

test('rate limit: repeated failures → 429 with Retry-After, for every password path', async () => {
  const c = client();
  let last;
  for (let i = 0; i < 6; i++) {
    last = await c.call('/auth/login', { method: 'POST', body: { email: 'x@example.com', password: `falsch-${i}` } });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  const pw = await c.call('/auth/password', { method: 'POST', body: { email: 'x@example.com', password: 'a', newPassword: 'b' } });
  assert.equal(pw.status, 429, 'the change path shares the bucket');
});
