'use strict';
// Integration: the admin settings API end to end (routes/admin-settings.js →
// lib/app-settings.js) against a temp DB. LOCAL_DEV_MODE: the dev user is the
// admin, so requireAdmin lets the requests through. The admin guard itself is
// covered where the auth guard is armed.

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');

const ctx = bootstrap({ LOCAL_DEV_MODE: '1', OIDC_CLIENT_SECRET: 'integration-oidc-secret' });
test.before(ctx.start);
test.after(ctx.stop);

const get = (p) => fetch(ctx.url(p));
const patch = (body) => fetch(ctx.url('/api/admin/settings'), {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const valueOf = (view, key) => view.settings.find((s) => s.key === key).value;

test('GET lists every setting with tab + value; the secret only as a flag', async () => {
  const res = await get('/api/admin/settings');
  assert.equal(res.status, 200);
  const view = await res.json();
  assert.deepEqual(view.tabs, ['general', 'auth', 'jobs']);
  assert.equal(valueOf(view, 'app.timezone'), 'Europe/Zurich');
  assert.equal(valueOf(view, 'jobs.retention_days'), 30);
  assert.deepEqual(view.env, { oidcClientSecret: true });
  assert.ok(!JSON.stringify(view).includes('integration-oidc-secret'), 'the secret value never leaves the server');
});

test('PATCH stores, and /api/config follows the timezone at once', async () => {
  const res = await patch({ 'app.timezone': 'Asia/Tokyo', 'jobs.retention_days': 7 });
  assert.equal(res.status, 200);
  const view = await res.json();
  assert.equal(valueOf(view, 'jobs.retention_days'), 7);
  const cfg = await (await get('/api/config')).json();
  assert.equal(cfg.timezone, 'Asia/Tokyo');
});

test('PATCH refusal: 400 with "<key>: <reason>", nothing written', async () => {
  const res = await patch({ 'jobs.retention_days': 3, 'auth.method': 'oidc' });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'oidc.issuer: required for oidc' });
  const view = await (await get('/api/admin/settings')).json();
  assert.equal(valueOf(view, 'jobs.retention_days'), 7);
  assert.equal(valueOf(view, 'auth.method'), 'local');

  const unknown = await patch({ 'db.path': '/etc/passwd' });
  assert.equal(unknown.status, 400);
});

test('auth.method=oidc switches the login page offer without a restart', async () => {
  const res = await patch({
    'auth.method': 'oidc', 'oidc.issuer': 'https://idp.example.com',
    'oidc.client_id': 'vt', 'oidc.redirect_uri': 'https://app.example.com/auth/callback',
  });
  assert.equal(res.status, 200);
  const methods = await (await get('/auth/methods')).json();
  assert.equal(methods.method, 'oidc');
  const cfg = await (await get('/api/config')).json();
  assert.equal(cfg.authMethod, 'oidc');
});
