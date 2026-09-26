'use strict';
// Mocks for the auth + admin-users endpoints (tests/server.js dispatches here
// first). Own module + own reset so the users feature and the login page don't
// crowd the notes mocks. State inspectable via GET /__mock/users.
//
// Login mock: the password decides the outcome —
//   'richtig-passwort-1' → session | 'initial-passwort-1' → mustChange |
//   'gesperrt-passwort-1' → 403 | anything else → 401.

let state;
const SEED = () => [
  { email: 'admin@local', display_name: null, role: 'admin', status: 'active', env_managed: true, has_password: false, must_change: false, created_at: '2026-01-01T08:00:00.000Z', last_seen_at: '2026-01-02T09:00:00.000Z' },
  { email: 'anna@local', display_name: 'Anna', role: 'user', status: 'active', env_managed: false, has_password: true, must_change: true, created_at: '2026-01-01T08:00:00.000Z', last_seen_at: null },
  { email: 'ben@local', display_name: 'Ben', role: 'user', status: 'disabled', env_managed: false, has_password: true, must_change: false, created_at: '2026-01-01T08:00:00.000Z', last_seen_at: null },
];
function reset() {
  state = { users: SEED(), calls: [], methods: { method: 'local', adminLogin: true, devMode: false } };
}
reset();

async function handle(req, res, url, { json, readBody }) {
  let m;
  if (url === '/__mock/users' && req.method === 'GET') return json(res, 200, state), true;
  if (url === '/__mock/methods' && req.method === 'POST') { state.methods = await readBody(req); return json(res, 200, {}), true; }

  if (url === '/auth/methods' && req.method === 'GET') return json(res, 200, state.methods), true;
  if (url === '/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    state.calls.push({ path: url, body });
    if (body.password === 'richtig-passwort-1') return json(res, 200, { ok: true }), true;
    if (body.password === 'initial-passwort-1') return json(res, 200, { ok: true, mustChange: true }), true;
    if (body.password === 'gesperrt-passwort-1') return json(res, 403, { error: 'account disabled' }), true;
    return json(res, 401, { error: 'invalid credentials' }), true;
  }
  if (url === '/auth/password' && req.method === 'POST') {
    const body = await readBody(req);
    state.calls.push({ path: url, body });
    if ((body.newPassword || '').length < 12) return json(res, 400, { error: 'password too short' }), true;
    return json(res, 200, { ok: true }), true;
  }

  if (url === '/api/admin/users' && req.method === 'GET') return json(res, 200, state.users), true;
  if (url === '/api/admin/users' && req.method === 'POST') {
    const body = await readBody(req);
    state.calls.push({ path: url, body });
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return json(res, 400, { error: 'valid email required' }), true;
    if (state.users.some((u) => u.email === email)) return json(res, 409, { error: 'user exists' }), true;
    if ((body.password || '').length < 12) return json(res, 400, { error: 'password too short' }), true;
    const user = { email, display_name: body.display_name || null, role: 'user', status: 'active', env_managed: false, has_password: true, must_change: true, created_at: '2026-01-03T08:00:00.000Z', last_seen_at: null };
    state.users.push(user);
    return json(res, 201, user), true;
  }
  if ((m = url.match(/^\/api\/admin\/users\/([^/]+)(\/password)?$/))) {
    const user = state.users.find((u) => u.email === m[1]);
    if (!user) return json(res, 404, { error: 'not found' }), true;
    const body = req.method === 'DELETE' ? {} : await readBody(req);
    state.calls.push({ path: url, method: req.method, body });
    if (m[2] && req.method === 'PUT') {
      if ((body.password || '').length < 12) return json(res, 400, { error: 'password too short' }), true;
      user.must_change = true;
      return json(res, 200, user), true;
    }
    if (req.method === 'PATCH') { Object.assign(user, body.status ? { status: body.status } : {}); return json(res, 200, user), true; }
    if (req.method === 'DELETE') { state.users = state.users.filter((u) => u !== user); return json(res, 200, { deleted: true }), true; }
  }
  return false;
}

module.exports = { handle, reset };
