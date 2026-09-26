'use strict';
// ★ FACADE — the single entry point for the users domain (app_users +
// user_credentials). lib/auth.js, the auth routes and the admin routes import
// THIS module, never db/users.js. Invariants that live here (docs/auth.md):
//
//   • emails are stored trimmed + lowercase — one account per address;
//   • the .env admin (and the dev user) are env-managed: no password in the DB,
//     no status/role change, no delete — the facade refuses, not the route;
//   • a password set by the admin is an INITIAL password (must_change = 1): the
//     next login with it opens no session, only the change form;
//   • unknown and known accounts cost the same time at login (dummy hash).
//
// Refusals are DomainErrors (lib/errors.js): invalid → 400, not found → 404,
// 'user exists' / 'managed by env' → 409 (mapped in routes/_http.js).

const usersDb = require('../db/users');
const password = require('./password');
const env = require('./auth-env');
const logger = require('../logger');
const { invalid, notFound, conflict } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
const STATUSES = ['active', 'disabled'];

function normalizeEmail(email) {
  const e = env.norm(email);
  if (!EMAIL_RE.test(e) || e.length > 254) throw invalid('valid email required');
  return e;
}

function cleanName(name) {
  const n = String(name == null ? '' : name).trim().slice(0, 120);
  return n || null;
}

function assertManageable(email) {
  if (env.isEnvManaged(email)) throw conflict('managed by env');
  const user = usersDb.getUser(email);
  if (!user) throw notFound();
  return user;
}

async function hashValid(pw) {
  const err = password.validatePassword(pw);
  if (err) throw invalid(err);
  return password.hashPassword(pw);
}

// API view of a user: role is derived from the env (never trusted from the
// column alone), the hash never leaves the facade.
function toView(u) {
  return {
    email: u.email,
    display_name: u.display_name,
    role: env.isAdminEmail(u.email) ? 'admin' : 'user',
    status: u.status,
    env_managed: env.isEnvManaged(u.email),
    has_password: !!u.has_password,
    must_change: !!u.must_change,
    created_at: u.created_at,
    last_seen_at: u.last_seen_at,
  };
}

function getUser(email) {
  return usersDb.getUser(env.norm(email));
}

function listUsers() {
  return usersDb.listUsers().map(toView);
}

function getUserView(email) {
  const row = usersDb.getUserWithCredential(env.norm(email));
  return row ? toView(row) : null;
}

async function createUser({ email, displayName, password: pw }) {
  const e = normalizeEmail(email);
  if (env.isEnvManaged(e)) throw conflict('managed by env');
  if (usersDb.getUser(e)) throw conflict('user exists');
  const hash = await hashValid(pw);
  usersDb.insertUserWithCredential({ email: e, displayName: cleanName(displayName), hash });
  return getUserView(e);
}

function updateUser(email, { displayName, status } = {}) {
  const e = env.norm(email);
  assertManageable(e);
  if (status !== undefined && !STATUSES.includes(status)) throw invalid('invalid status');
  if (displayName !== undefined) usersDb.setDisplayName(e, cleanName(displayName));
  if (status !== undefined) usersDb.setStatus(e, status);
  return getUserView(e);
}

// Admin sets a (new) initial password — the user must replace it at next login.
async function setInitialPassword(email, pw) {
  const e = env.norm(email);
  assertManageable(e);
  usersDb.setCredential(e, await hashValid(pw), true);
  return getUserView(e);
}

function deleteUser(email) {
  const e = env.norm(email);
  assertManageable(e);
  return usersDb.deleteUser(e);
}

// Login bookkeeping for sessions that do NOT come from a local password
// (OIDC, the .env admin, the dev bypass): the row exists after the first login.
function recordLogin(email, displayName = null) {
  return usersDb.upsertSeen(env.norm(email), cleanName(displayName));
}

function touch(email) {
  usersDb.touch(env.norm(email));
}

// Fixed comparison hash for unknown accounts: without it the server answers
// measurably faster for an address that does not exist (an account oracle).
let DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA';
const dummyReady = password.hashPassword('timing-equalizer-never-valid')
  .then((h) => { DUMMY_HASH = h; })
  .catch(() => {});

// Local password check. Returns { ok: false } | { ok: true, user, mustChange }.
// Status is NOT judged here — the caller decides after a correct password, so
// the answer never reveals whether a disabled account exists.
async function verifyCredentials(email, given) {
  const e = env.norm(email);
  const cred = e && !env.isEnvManaged(e) ? usersDb.getCredential(e) : null;
  if (!cred) {
    await dummyReady;
    await password.verifyPassword(given || 'x', DUMMY_HASH);
    return { ok: false };
  }
  if (!(await password.verifyPassword(given, cred.password_hash))) return { ok: false };
  if (!cred.must_change && password.needsRehash(cred.password_hash)) {
    // Only possible here: the plaintext is at hand exactly once per login.
    try { usersDb.setCredential(e, await password.hashPassword(given), false); } catch (err) {
      logger.warn(`Rehash fehlgeschlagen: ${err.message}`);
    }
  }
  return { ok: true, user: usersDb.getUser(e), mustChange: !!cred.must_change };
}

// The user replaces their password (after an initial one, or voluntarily).
// Re-authenticates with the current password instead of a half-open session.
async function changePassword(email, current, next) {
  const check = await verifyCredentials(email, current);
  if (!check.ok) return { ok: false };
  if (check.user.status !== 'active') return { ok: true, denied: check.user.status };
  if (next === current) throw invalid('password unchanged');
  usersDb.setCredential(check.user.email, await hashValid(next), false);
  return { ok: true, user: check.user };
}

// Boot: the env-managed accounts exist and carry role 'admin'; every other
// admin row is demoted — the role cannot be granted anywhere but in .env.
function syncEnvAdmins() {
  const admins = [env.adminEmail(), env.localDevMode() ? env.devUserEmail() : null].filter(Boolean);
  for (const e of admins) {
    if (!usersDb.getUser(e)) usersDb.insertUser({ email: e, displayName: null });
    usersDb.setRole(e, 'admin');
  }
  usersDb.demoteAllExcept(admins);
}

module.exports = {
  normalizeEmail, getUser, getUserView, listUsers, createUser, updateUser, setInitialPassword, deleteUser,
  recordLogin, touch, verifyCredentials, changePassword, syncEnvAdmins,
};
