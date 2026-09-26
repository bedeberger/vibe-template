'use strict';
// Auth configuration from the environment — the ONE place that reads the auth
// env vars (docs/auth.md). Pure readers, evaluated per call so tests can set
// the env before the first request. Required by lib/auth.js and the
// lib/user-store.js facade (which must refuse to touch the .env admin).
//
//   AUTH_METHOD     'local' (default) | 'oidc' — how ordinary users log in
//   ADMIN_EMAIL     the one admin account; its role comes from here, not the DB
//   ADMIN_PASSWORD  its password — lives ONLY in .env, never in the DB
//   LOCAL_DEV_MODE  '1' → login bypassed, DEV_USER_EMAIL is admin too

const AUTH_METHODS = ['local', 'oidc'];

const norm = (email) => String(email || '').trim().toLowerCase();

function authMethod() {
  const m = norm(process.env.AUTH_METHOD) || 'local';
  if (!AUTH_METHODS.includes(m)) throw new Error(`AUTH_METHOD="${process.env.AUTH_METHOD}" unbekannt (erlaubt: ${AUTH_METHODS.join(', ')}).`);
  return m;
}

function localDevMode() { return process.env.LOCAL_DEV_MODE === '1'; }
function devUserEmail() { return norm(process.env.DEV_USER_EMAIL) || 'dev@local'; }
function adminEmail() { return norm(process.env.ADMIN_EMAIL) || null; }
function adminPassword() { return process.env.ADMIN_PASSWORD || null; }

// The .env admin can log in only when BOTH are set.
function adminLoginEnabled() { return !!(adminEmail() && adminPassword()); }

// Accounts whose role and credentials are owned by the environment — the admin
// console lists them read-only and the facade refuses to change them.
function isEnvManaged(email) {
  const e = norm(email);
  return !!e && (e === adminEmail() || (localDevMode() && e === devUserEmail()));
}

// Admin = the .env admin (plus the dev user under LOCAL_DEV_MODE). There is no
// other way to become admin: the role cannot be granted from the UI.
function isAdminEmail(email) { return isEnvManaged(email); }

module.exports = {
  AUTH_METHODS, norm, authMethod, localDevMode, devUserEmail, adminEmail, adminPassword,
  adminLoginEnabled, isEnvManaged, isAdminEmail,
};
