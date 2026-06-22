'use strict';
// Key/value app settings backed by the app_settings table. Single source for
// runtime config that may change without a redeploy (e.g. app.timezone).
//
// bootstrapFromEnv() seeds defaults from the environment once, without
// clobbering values an admin has since changed in the DB.

const { db } = require('../db/schema');

const _get = db.prepare('SELECT value FROM app_settings WHERE key = ?');
const _set = db.prepare(`
  INSERT INTO app_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function get(key, fallback = null) {
  const row = _get.get(key);
  return row ? row.value : fallback;
}

function set(key, value) {
  _set.run(key, value == null ? null : String(value));
}

// Seed only if absent — never overwrite a DB value.
function bootstrapFromEnv() {
  if (get('app.timezone') == null) {
    set('app.timezone', process.env.APP_TIMEZONE || 'Europe/Zurich');
  }
}

function getTimezone() {
  return get('app.timezone', 'Europe/Zurich');
}

module.exports = { get, set, bootstrapFromEnv, getTimezone };
