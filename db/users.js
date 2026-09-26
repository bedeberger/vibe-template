'use strict';
// Low-level SQL for the users domain (app_users + user_credentials). Reached
// only through the lib/user-store.js facade — lib/auth.js and the routes never
// import this module (CLAUDE.md → Harte Regeln: Domänen-Facade).

const { db } = require('./schema');
const { NOW_ISO_SQL } = require('./now');

// ── app_users ────────────────────────────────────────────────────────────
const _get = db.prepare('SELECT * FROM app_users WHERE email = ?');
const WITH_CRED = `
  SELECT u.*, (c.user_email IS NOT NULL) AS has_password, COALESCE(c.must_change, 0) AS must_change
  FROM app_users u LEFT JOIN user_credentials c ON c.user_email = u.email`;
const _list = db.prepare(`${WITH_CRED} ORDER BY u.email`);
const _getWithCred = db.prepare(`${WITH_CRED} WHERE u.email = ?`);
const _insert = db.prepare(`
  INSERT INTO app_users (email, display_name, global_role, status, created_at)
  VALUES (@email, @display_name, 'user', 'active', ${NOW_ISO_SQL})
`);
const _upsertSeen = db.prepare(`
  INSERT INTO app_users (email, display_name, created_at, last_seen_at)
  VALUES (@email, @display_name, ${NOW_ISO_SQL}, ${NOW_ISO_SQL})
  ON CONFLICT(email) DO UPDATE SET
    display_name = COALESCE(excluded.display_name, app_users.display_name),
    last_seen_at = ${NOW_ISO_SQL}
`);
const _touch = db.prepare(`UPDATE app_users SET last_seen_at = ${NOW_ISO_SQL} WHERE email = ?`);
const _setName = db.prepare('UPDATE app_users SET display_name = ? WHERE email = ?');
const _setStatus = db.prepare('UPDATE app_users SET status = ? WHERE email = ?');
const _setRole = db.prepare('UPDATE app_users SET global_role = ? WHERE email = ?');
const _demoteOthers = db.prepare("UPDATE app_users SET global_role = 'user' WHERE global_role = 'admin' AND email NOT IN (SELECT value FROM json_each(?))");
const _delete = db.prepare('DELETE FROM app_users WHERE email = ?');

function getUser(email) { return _get.get(email); }
function listUsers() { return _list.all(); }
function getUserWithCredential(email) { return _getWithCred.get(email); }
function insertUser({ email, displayName }) { _insert.run({ email, display_name: displayName }); return _get.get(email); }
function upsertSeen(email, displayName) { _upsertSeen.run({ email, display_name: displayName }); return _get.get(email); }
function touch(email) { _touch.run(email); }
function setDisplayName(email, name) { _setName.run(name, email); }
function setStatus(email, status) { _setStatus.run(status, email); }
function setRole(email, role) { _setRole.run(role, email); }
function demoteAllExcept(emails) { _demoteOthers.run(JSON.stringify(emails)); }
function deleteUser(email) { return _delete.run(email).changes > 0; }

// ── user_credentials ─────────────────────────────────────────────────────
const _getCred = db.prepare('SELECT * FROM user_credentials WHERE user_email = ?');
const _setCred = db.prepare(`
  INSERT INTO user_credentials (user_email, password_hash, must_change, updated_at)
  VALUES (@email, @hash, @must_change, ${NOW_ISO_SQL})
  ON CONFLICT(user_email) DO UPDATE SET
    password_hash = excluded.password_hash,
    must_change   = excluded.must_change,
    updated_at    = ${NOW_ISO_SQL}
`);

function getCredential(email) { return _getCred.get(email); }
function setCredential(email, hash, mustChange) { _setCred.run({ email, hash, must_change: mustChange ? 1 : 0 }); }

module.exports = {
  getUser, listUsers, getUserWithCredential, insertUser, upsertSeen, touch, setDisplayName, setStatus, setRole, demoteAllExcept, deleteUser,
  getCredential, setCredential,
};
