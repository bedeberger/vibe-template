'use strict';
// Auth configuration — the ONE place that reads the auth env vars (docs/auth.md).
// Pure readers, evaluated per call so tests can set the env before the first
// request. Required by lib/auth.js and the lib/user-store.js facade (which must
// refuse to touch the .env admin).
//
//   auth.method     app setting (admin console), 'local' | 'oidc' — how
//                   ordinary users log in. Not an env var: the .env admin logs
//                   in by password under either method, so a wrong choice
//                   never locks the console.
//   ADMIN_EMAIL     the one admin account; its role comes from here, not the DB
//   ADMIN_PASSWORD  its password — lives ONLY in .env, never in the DB
//   oidc.*          app settings (issuer, client id, redirect URI) + the one
//                   secret OIDC_CLIENT_SECRET from .env → oidcConfig()
//   LOCAL_DEV_MODE  '1' → login bypassed, DEV_USER_EMAIL is admin too

const appSettings = require('./app-settings');

const AUTH_METHODS = appSettings.SETTINGS['auth.method'].values;

const norm = (email) => String(email || '').trim().toLowerCase();

function authMethod() { return appSettings.get('auth.method'); }

function localDevMode() { return process.env.LOCAL_DEV_MODE === '1'; }
function devUserEmail() { return norm(process.env.DEV_USER_EMAIL) || 'dev@local'; }
function adminEmail() { return norm(process.env.ADMIN_EMAIL) || null; }
function adminPassword() { return process.env.ADMIN_PASSWORD || null; }

// The OIDC client configuration: public parts from the admin console, the
// secret from .env. Read per call — a console change applies at the next login.
function oidcConfig() {
  return {
    issuer: appSettings.get('oidc.issuer'),
    clientId: appSettings.get('oidc.client_id'),
    redirectUri: appSettings.get('oidc.redirect_uri'),
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  };
}

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
  adminLoginEnabled, isEnvManaged, isAdminEmail, oidcConfig,
};
