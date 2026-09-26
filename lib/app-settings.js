'use strict';
// App settings — the facade for everything an admin configures at runtime in
// the admin console ("Einstellungen", routes/admin-settings.js), backed by the
// key/value table app_settings. CLAUDE.md → ".env nur minimal": the .env holds
// only secrets, bootstrap values and per-process switches; every other knob is
// a row in SETTINGS below.
//
// A new setting = one SETTINGS entry (tab, type, default) + its form row in
// that tab of public/partials/settings.html + its labels in both locales
// (settings.field.* / settings.help.*). Read it per call with get(key) — never
// cache at import, or a console change needs a restart. A key without a DB row
// reads as its default, so a fresh install needs no seeding.

const { db } = require('../db/schema');
const { invalid } = require('./errors');

const TABS = ['general', 'auth', 'jobs'];

//   tab      console tab it appears in (TABS)
//   type     'text' | 'url' | 'int' | 'enum' | 'timezone'
//   values   enum only: the allowed values
//   min/max  int only
const SETTINGS = {
  'app.timezone': { tab: 'general', type: 'timezone', default: 'Europe/Zurich' },
  'auth.method': { tab: 'auth', type: 'enum', values: ['local', 'oidc'], default: 'local' },
  'oidc.issuer': { tab: 'auth', type: 'url', default: '' },
  'oidc.client_id': { tab: 'auth', type: 'text', default: '' },
  'oidc.redirect_uri': { tab: 'auth', type: 'url', default: '' },
  'jobs.retention_days': { tab: 'jobs', type: 'int', min: 1, max: 3650, default: 30 },
};

const _get = db.prepare('SELECT value FROM app_settings WHERE key = ?');
const _set = db.prepare(`
  INSERT INTO app_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function isTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isHttpUrl(s) {
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

// Stored string → typed value. A row that no longer validates (hand-edited DB,
// narrowed enum) falls back to the default instead of breaking the boot.
function decode(def, raw) {
  if (raw == null) return def.default;
  try {
    return coerce(def, raw);
  } catch {
    return def.default;
  }
}

// Input → typed, validated value; throws invalid('<key>: …').
function coerce(def, input, key = '') {
  const s = input == null ? '' : String(input).trim();
  switch (def.type) {
    case 'int': {
      const n = Number(s);
      if (!Number.isInteger(n) || n < def.min || n > def.max) throw invalid(`${key}: out of range`);
      return n;
    }
    case 'enum':
      if (!def.values.includes(s)) throw invalid(`${key}: unknown value`);
      return s;
    case 'timezone':
      if (!s || !isTimezone(s)) throw invalid(`${key}: unknown timezone`);
      return s;
    case 'url':
      if (s && !isHttpUrl(s)) throw invalid(`${key}: invalid url`);
      return s;
    default:
      return s;
  }
}

function defOf(key) {
  const def = SETTINGS[key];
  if (!def) throw new Error(`Unbekanntes Setting "${key}" — in lib/app-settings.js SETTINGS eintragen.`);
  return def;
}

function get(key) {
  const def = defOf(key);
  return decode(def, _get.get(key)?.value);
}

// Cross-field invariants on the would-be state — checked before anything is
// written, so a refused save leaves every value as it was.
function checkConsistency(next) {
  if (next['auth.method'] === 'oidc') {
    for (const k of ['oidc.issuer', 'oidc.client_id', 'oidc.redirect_uri']) {
      if (!next[k]) throw invalid(`${k}: required for oidc`);
    }
  }
}

// Every setting with its current value and metadata — what the console renders.
function list() {
  return Object.entries(SETTINGS).map(([key, def]) => ({
    key,
    tab: def.tab,
    type: def.type,
    ...(def.values && { values: def.values }),
    ...(def.type === 'int' && { min: def.min, max: def.max }),
    default: def.default,
    value: get(key),
  }));
}

// Partial update { key: value, … }. All-or-nothing: unknown key, invalid value
// or a broken invariant → nothing is written. Returns the keys that changed.
const _applyTx = db.transaction((entries) => {
  for (const [key, value] of entries) _set.run(key, String(value));
});

function update(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw invalid('settings object required');
  const current = Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, get(k)]));
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!SETTINGS[key]) throw invalid(`${key}: unknown setting`);
    next[key] = coerce(SETTINGS[key], value, key);
  }
  checkConsistency(next);
  const changed = Object.keys(patch).filter((k) => next[k] !== current[k]);
  _applyTx(changed.map((k) => [k, next[k]]));
  return changed;
}

const getTimezone = () => get('app.timezone');

module.exports = { TABS, SETTINGS, get, list, update, getTimezone, isTimezone };
