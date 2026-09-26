'use strict';
// Unit: the lib/app-settings.js facade against a throwaway DB — defaults
// without rows, typed values, validation per type, the OIDC invariant, and
// all-or-nothing updates (CLAUDE.md ".env nur minimal").

const test = require('node:test');
const assert = require('node:assert');

require('../_helpers/temp-db').useTempDb('settings');
const settings = require('../../lib/app-settings');
const authEnv = require('../../lib/auth-env');
const { isDomainError } = require('../../lib/errors');

const refused = (fn, message) => assert.throws(fn, (e) => isDomainError(e) && e.kind === 'invalid' && e.message === message);

test('fresh DB: every setting reads its default, typed', () => {
  assert.equal(settings.get('app.timezone'), 'Europe/Zurich');
  assert.equal(settings.get('jobs.retention_days'), 30);
  assert.equal(authEnv.authMethod(), 'local');
  const listed = settings.list();
  assert.deepEqual(listed.map((s) => s.key), Object.keys(settings.SETTINGS));
  for (const s of listed) assert.ok(settings.TABS.includes(s.tab), `${s.key}: tab ${s.tab} not in TABS`);
});

test('unknown key is a programming error, not a default', () => {
  assert.throws(() => settings.get('nope.key'), /Unbekanntes Setting/);
});

test('update: typed + trimmed, returns only the changed keys', () => {
  const changed = settings.update({ 'jobs.retention_days': '14', 'app.timezone': ' America/New_York ', 'auth.method': 'local' });
  assert.deepEqual(changed.sort(), ['app.timezone', 'jobs.retention_days']);
  assert.strictEqual(settings.get('jobs.retention_days'), 14);
  assert.equal(settings.getTimezone(), 'America/New_York');
});

test('validation per type', () => {
  refused(() => settings.update({ 'jobs.retention_days': 0 }), 'jobs.retention_days: out of range');
  refused(() => settings.update({ 'jobs.retention_days': '2.5' }), 'jobs.retention_days: out of range');
  refused(() => settings.update({ 'app.timezone': 'Mars/Olympus' }), 'app.timezone: unknown timezone');
  refused(() => settings.update({ 'auth.method': 'ldap' }), 'auth.method: unknown value');
  refused(() => settings.update({ 'oidc.issuer': 'ftp://x' }), 'oidc.issuer: invalid url');
  refused(() => settings.update({ 'db.path': '/tmp/x' }), 'db.path: unknown setting');
  refused(() => settings.update(null), 'settings object required');
});

test('oidc needs issuer, client id and redirect uri — refused save writes nothing', () => {
  refused(() => settings.update({ 'auth.method': 'oidc', 'oidc.issuer': 'https://idp.example.com', 'jobs.retention_days': 7 }),
    'oidc.client_id: required for oidc');
  assert.equal(settings.get('auth.method'), 'local');
  assert.equal(settings.get('oidc.issuer'), '', 'all-or-nothing: the valid issuer was not written either');
  assert.equal(settings.get('jobs.retention_days'), 14);

  settings.update({
    'auth.method': 'oidc', 'oidc.issuer': 'https://idp.example.com',
    'oidc.client_id': 'app', 'oidc.redirect_uri': 'https://app.example.com/auth/callback',
  });
  assert.equal(authEnv.authMethod(), 'oidc');
  assert.deepEqual(authEnv.oidcConfig(), {
    issuer: 'https://idp.example.com', clientId: 'app',
    redirectUri: 'https://app.example.com/auth/callback', clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  });
  // Clearing a required field while oidc is active is refused too.
  refused(() => settings.update({ 'oidc.issuer': '' }), 'oidc.issuer: required for oidc');
});

test('a stored value that no longer validates reads as the default', () => {
  const { db } = require('../../db/schema');
  db.prepare("UPDATE app_settings SET value = 'Nowhere/Zone' WHERE key = 'app.timezone'").run();
  assert.equal(settings.getTimezone(), 'Europe/Zurich');
});
