'use strict';
// Authentication: a session guard on every route except the public ones, plus
// user bookkeeping. Two modes:
//
//   • LOCAL_DEV_MODE=1 — OIDC is bypassed entirely. Every request is treated as
//     DEV_USER_EMAIL. Combined with lib/dev-seed.js this gives a zero-config
//     local start. NEVER enable in production.
//   • Otherwise — OIDC (provider-agnostic, configured via OIDC_* env). The
//     client is initialised lazily in routes/auth.js so boot never blocks on
//     issuer discovery.

const { db } = require('../db/schema');
const { NOW_ISO_SQL } = require('../db/now');
const { setContext } = require('./log-context');

const LOCAL_DEV_MODE = process.env.LOCAL_DEV_MODE === '1';
const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL || 'dev@local';

// ── User table helpers ─────────────────────────────────────────────────────
const _upsertUser = db.prepare(`
  INSERT INTO app_users (email, display_name, last_seen_at)
  VALUES (@email, @display_name, ${NOW_ISO_SQL})
  ON CONFLICT(email) DO UPDATE SET
    display_name = COALESCE(excluded.display_name, app_users.display_name),
    last_seen_at = ${NOW_ISO_SQL}
`);
const _getUser = db.prepare('SELECT * FROM app_users WHERE email = ?');
const _setRole = db.prepare('UPDATE app_users SET global_role = ? WHERE email = ?');

function upsertUser(email, displayName = null) {
  _upsertUser.run({ email, display_name: displayName });
  return _getUser.get(email);
}

function getUser(email) {
  return _getUser.get(email);
}

// Promote ADMIN_EMAIL to admin at boot. Idempotent.
function ensureAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;
  const existing = _getUser.get(email) || upsertUser(email);
  if (existing.global_role !== 'admin') _setRole.run('admin', email);
}

// Paths reachable without a session.
function isPublicPath(p) {
  return (
    p === '/login' ||
    p.startsWith('/auth/') ||
    p === '/manifest.webmanifest' ||
    p === '/login.html' ||
    p.startsWith('/css/') ||
    p.startsWith('/fonts/') ||
    p.startsWith('/vendor/') ||
    p.startsWith('/icons') ||
    /\.(png|svg|ico)$/.test(p)
  );
}

// Express guard. Mount before route handlers; let static/public paths through.
function requireAuth(req, res, next) {
  if (LOCAL_DEV_MODE && !req.session.user) {
    req.session.user = { email: DEV_USER_EMAIL, display_name: 'Dev User' };
    upsertUser(DEV_USER_EMAIL, 'Dev User');
  }

  if (req.session.user) {
    setContext({ user: req.session.user.email });
    return next();
  }

  if (isPublicPath(req.path)) return next();

  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthenticated' });
  return res.redirect('/login');
}

module.exports = {
  LOCAL_DEV_MODE,
  DEV_USER_EMAIL,
  upsertUser,
  getUser,
  ensureAdminFromEnv,
  isPublicPath,
  requireAuth,
};
