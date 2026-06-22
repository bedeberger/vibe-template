'use strict';
// Auth routes: login page, dev-login bypass, logout, OIDC start/callback, and
// /api/me. OIDC is initialised lazily (on first use) so boot never blocks on
// issuer discovery and the template runs out of the box in LOCAL_DEV_MODE.

const express = require('express');
const path = require('path');
const { LOCAL_DEV_MODE, DEV_USER_EMAIL, upsertUser } = require('../lib/auth');
const logger = require('../logger');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Dev bypass — only in LOCAL_DEV_MODE.
router.post('/auth/dev-login', (req, res) => {
  if (!LOCAL_DEV_MODE) return res.status(403).send('dev login disabled');
  req.session.user = { email: DEV_USER_EMAIL, display_name: 'Dev User' };
  upsertUser(DEV_USER_EMAIL, 'Dev User');
  res.redirect('/');
});

router.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── OIDC (provider-agnostic, lazy) ─────────────────────────────────────────
let _clientPromise = null;
async function getOidcClient() {
  if (!process.env.OIDC_ISSUER) throw new Error('OIDC not configured');
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const { Issuer } = require('openid-client');
      const issuer = await Issuer.discover(process.env.OIDC_ISSUER);
      return new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [process.env.OIDC_REDIRECT_URI],
        response_types: ['code'],
      });
    })();
  }
  return _clientPromise;
}

router.get('/auth/login', async (req, res) => {
  try {
    const client = await getOidcClient();
    const url = client.authorizationUrl({ scope: 'openid email profile' });
    res.redirect(url);
  } catch (e) {
    logger.warn(`OIDC login: ${e.message}`);
    res.status(501).send('OIDC not configured. Set OIDC_* env or use LOCAL_DEV_MODE.');
  }
});

router.get('/auth/callback', async (req, res) => {
  try {
    const client = await getOidcClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI, params);
    const claims = tokenSet.claims();
    const email = claims.email;
    if (!email) throw new Error('no email claim');
    req.session.user = { email, display_name: claims.name || email };
    upsertUser(email, claims.name || null);
    res.redirect('/');
  } catch (e) {
    logger.warn(`OIDC callback: ${e.message}`);
    res.status(401).send('Login failed.');
  }
});

// Current session user (under /api → guarded).
router.get('/api/me', (req, res) => {
  res.json(req.session.user || null);
});

module.exports = router;
