'use strict';
// Auth routes (docs/auth.md): login page + its bootstrap, password login (the
// .env admin and local users), password change, dev bypass, logout, OIDC
// start/callback, and /api/me. OIDC is initialised lazily (on first use) so
// boot never blocks on issuer discovery.
//
// Every password path runs the same sequence — rate limit → check → session —
// and shares ONE rate-limit bucket per IP (lib/login-ratelimit.js).

const express = require('express');
const path = require('path');
const env = require('../lib/auth-env');
const users = require('../lib/user-store');
const rateLimit = require('../lib/login-ratelimit');
const { sessionUser, sessionView, establishSession, verifyPasswordLogin } = require('../lib/auth');
const { setContext } = require('../lib/log-context');
const { isDomainError } = require('../lib/errors');
const { sendDomainError } = require('./_http');
const logger = require('../logger');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// What the login page offers. Public (no session yet) — tells nothing beyond
// what the page shows anyway.
router.get('/auth/methods', (req, res) => {
  res.json({
    method: env.authMethod(),
    adminLogin: env.adminLoginEnabled(),
    devMode: env.localDevMode(),
  });
});

// Rate-limit gate shared by every password endpoint. Returns true if blocked.
function blocked(req, res) {
  const state = rateLimit.getState(req.ip);
  if (!state.blocked) return false;
  res.set('Retry-After', String(state.retryAfterSec));
  res.status(429).json({ error: 'rate limited', retryAfter: state.retryAfterSec });
  return true;
}

function fail(req, res, email, what) {
  rateLimit.recordFailure(req.ip);
  logger.warn(`${what} fehlgeschlagen.`, { user: email || '-' });
  res.status(401).json({ error: 'invalid credentials' });
}

router.post('/auth/login', express.json({ limit: '8kb' }), async (req, res, next) => {
  try {
    if (blocked(req, res)) return;
    const { email, password } = req.body || {};
    const e = env.norm(email);
    setContext({ scope: 'auth', user: e || '-' });
    const result = await verifyPasswordLogin(e, password);
    if (!result.ok) return fail(req, res, e, 'Login');
    rateLimit.recordSuccess(req.ip);
    if (result.denied) {
      logger.warn(`Login verweigert (Status ${result.denied}).`);
      return res.status(403).json({ error: 'account disabled' });
    }
    // Initial password: correct, but no session — the page switches to the
    // change form, which re-authenticates with this password (/auth/password).
    if (result.mustChange) {
      logger.info('Login: Passwortwechsel fällig.');
      return res.json({ ok: true, mustChange: true });
    }
    await establishSession(req, result.user);
    users.recordLogin(result.user.email);
    logger.info('Login (Passwort).');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Replace one's own local password: { email, password (current), newPassword }.
// Re-authenticates instead of trusting a half-open session.
router.post('/auth/password', express.json({ limit: '8kb' }), async (req, res, next) => {
  try {
    if (blocked(req, res)) return;
    const { email, password, newPassword } = req.body || {};
    const e = env.norm(email);
    setContext({ scope: 'auth', user: e || '-' });
    if (env.authMethod() !== 'local' || env.isEnvManaged(e)) return fail(req, res, e, 'Passwortwechsel');
    let result;
    try {
      result = await users.changePassword(e, password, newPassword);
    } catch (err) {
      // Policy error (too short, unchanged …): the current password was right.
      // Anything else is unexpected → the central 500 handler (server.js).
      if (!isDomainError(err)) throw err;
      rateLimit.recordSuccess(req.ip);
      return sendDomainError(res, err);
    }
    if (!result.ok) return fail(req, res, e, 'Passwortwechsel');
    rateLimit.recordSuccess(req.ip);
    if (result.denied) return res.status(403).json({ error: 'account disabled' });
    await establishSession(req, sessionUser(result.user.email, result.user.display_name));
    users.recordLogin(result.user.email);
    logger.info('Passwort geändert + Login.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Dev bypass — only in LOCAL_DEV_MODE.
router.post('/auth/dev-login', (req, res) => {
  if (!env.localDevMode()) return res.status(403).send('dev login disabled');
  req.session.user = sessionUser(env.devUserEmail(), 'Dev User');
  users.recordLogin(env.devUserEmail(), 'Dev User');
  res.redirect('/');
});

router.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── OIDC (auth.method=oidc, provider-agnostic, lazy) ───────────────────────
// The client is cached per configuration: a change in the admin console
// (issuer, client id, redirect URI) builds a fresh one at the next login.
let _client = { key: null, promise: null };
async function getOidcClient() {
  if (env.authMethod() !== 'oidc') throw new Error('OIDC not active (auth.method)');
  const cfg = env.oidcConfig();
  if (!cfg.issuer) throw new Error('OIDC not configured');
  const key = JSON.stringify(cfg);
  if (_client.key !== key) {
    const promise = (async () => {
      const { Issuer } = require('openid-client');
      const issuer = await Issuer.discover(cfg.issuer);
      return new issuer.Client({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uris: [cfg.redirectUri],
        response_types: ['code'],
      });
    })().catch((e) => { if (_client.promise === promise) _client = { key: null, promise: null }; throw e; });
    _client = { key, promise };
  }
  return _client.promise;
}

router.get('/auth/login', async (req, res) => {
  try {
    const client = await getOidcClient();
    res.redirect(client.authorizationUrl({ scope: 'openid email profile' }));
  } catch (e) {
    logger.warn(`OIDC login: ${e.message}`);
    res.status(501).send('OIDC not configured. Admin console → Settings → Sign-in.');
  }
});

router.get('/auth/callback', async (req, res) => {
  try {
    const client = await getOidcClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(env.oidcConfig().redirectUri, params);
    const claims = tokenSet.claims();
    const email = env.norm(claims.email);
    if (!email) throw new Error('no email claim');
    // One way in per account: the admin logs in with the .env password only.
    if (env.isEnvManaged(email)) throw new Error('env-managed account must use its .env password');
    const existing = users.getUser(email);
    if (existing && existing.status !== 'active') throw new Error(`account ${existing.status}`);
    users.recordLogin(email, claims.name || null);
    await establishSession(req, sessionUser(email, claims.name || email));
    res.redirect('/');
  } catch (e) {
    logger.warn(`OIDC callback: ${e.message}`);
    res.status(401).send('Login failed.');
  }
});

// Current session user incl. derived role (under /api → guarded).
router.get('/api/me', (req, res) => {
  res.json(sessionView(req.session.user));
});

module.exports = router;
