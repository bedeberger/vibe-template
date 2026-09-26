'use strict';
// Authentication: the session guard on every route except the public ones, the
// admin guard for /api/admin, and the password check shared by every password
// path (docs/auth.md). Modes:
//
//   • LOCAL_DEV_MODE=1 — login bypassed; every request is DEV_USER_EMAIL (admin
//     too). With lib/dev-seed.js a zero-config local start. NEVER in production.
//   • auth.method=local (default, admin console setting) — users with a
//     password managed by the admin in the admin console (lib/user-store.js).
//   • auth.method=oidc — users via an OIDC provider (routes/auth.js).
//   • Independent of the method: the .env admin (ADMIN_EMAIL + ADMIN_PASSWORD).
//     Its password lives only in .env; it is the way into the admin console and
//     the fallback when the IdP is down.

const env = require('./auth-env');
const users = require('./user-store');
const password = require('./password');
const { setContext } = require('./log-context');

// Paths reachable without a session. The login page is an Alpine page of its
// own: it needs its script, the i18n module and the locale files.
function isPublicPath(p) {
  return (
    p === '/login' ||
    p.startsWith('/auth/') ||
    p === '/manifest.webmanifest' ||
    p === '/login.html' ||
    p === '/js/login.js' ||
    p === '/js/i18n.js' ||
    p.startsWith('/js/i18n/') ||
    p.startsWith('/css/') ||
    p.startsWith('/fonts/') ||
    p.startsWith('/vendor/') ||
    p.startsWith('/icons') ||
    /\.(png|svg|ico)$/.test(p)
  );
}

// Session payload. The role is NOT stored here — it is derived from the env on
// every read (sessionView), so changing ADMIN_EMAIL takes effect immediately.
function sessionUser(email, displayName) {
  return { email: env.norm(email), display_name: displayName || email };
}

function sessionView(sessionUserObj) {
  if (!sessionUserObj) return null;
  return { ...sessionUserObj, role: env.isAdminEmail(sessionUserObj.email) ? 'admin' : 'user' };
}

// Open a session for a verified user. regenerate() first: a session id that
// existed before the login must not become an authenticated one (fixation).
function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = user;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

// The password check of every password login (the .env admin and local users).
// Returns
//   { ok: false }                        → 401 (wrong email/password, method off)
//   { ok: true, denied: 'disabled' }     → 403 (password right, account disabled)
//   { ok: true, mustChange: true }       → 200 without session (initial password)
//   { ok: true, user: { email, … } }     → 200 with session
async function verifyPasswordLogin(email, given) {
  const e = env.norm(email);
  if (e && e === env.adminEmail()) {
    // The .env admin: compared against ADMIN_PASSWORD only, never against the
    // DB. The dummy scrypt keeps its answer time equal to a local login.
    await users.verifyCredentials('', given);
    if (!env.adminLoginEnabled() || !password.secretsMatch(env.adminPassword(), given)) return { ok: false };
    return { ok: true, user: sessionUser(e, users.getUser(e)?.display_name || 'Admin') };
  }
  if (env.authMethod() !== 'local') {
    await users.verifyCredentials('', given);
    return { ok: false };
  }
  const check = await users.verifyCredentials(e, given);
  if (!check.ok) return { ok: false };
  if (check.user.status !== 'active') return { ok: true, denied: check.user.status };
  if (check.mustChange) return { ok: true, mustChange: true };
  return { ok: true, user: sessionUser(check.user.email, check.user.display_name) };
}

// Boot: env-managed accounts exist with role 'admin', every other admin row is
// demoted (lib/user-store.js → syncEnvAdmins). Idempotent.
function ensureAdminFromEnv() {
  users.syncEnvAdmins();
}

// Express guard. Mount before route handlers; lets public paths through.
function requireAuth(req, res, next) {
  if (env.localDevMode() && !req.session.user) {
    req.session.user = sessionUser(env.devUserEmail(), 'Dev User');
    users.recordLogin(env.devUserEmail(), 'Dev User');
  }

  if (req.session.user) {
    // Re-check the account on every request: a user the admin disabled or
    // deleted loses an already open session at once, not at cookie expiry.
    const row = users.getUser(req.session.user.email);
    if (row && row.status === 'active') {
      setContext({ user: req.session.user.email });
      return next();
    }
    req.session.user = null;
  }

  if (isPublicPath(req.path)) return next();

  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthenticated' });
  return res.redirect('/login');
}

// Guard for /api/admin/*. Mounted after requireAuth, so a session exists.
function requireAdmin(req, res, next) {
  if (env.isAdminEmail(req.session.user?.email)) return next();
  return res.status(403).json({ error: 'admin required' });
}

module.exports = {
  isPublicPath,
  sessionUser,
  sessionView,
  establishSession,
  verifyPasswordLogin,
  ensureAdminFromEnv,
  requireAuth,
  requireAdmin,
};
