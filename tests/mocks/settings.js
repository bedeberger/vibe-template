'use strict';
// Mocks for the admin settings endpoints (tests/server.js dispatches here).
// Own module + own reset, like mocks/auth-users.js. Mirrors the validation of
// lib/app-settings.js closely enough for the harness to see a refusal:
// oidc without issuer/client id/redirect → 400 "<key>: required for oidc".
// State inspectable via GET /__mock/settings (every PATCH body in `patches`).

const DEFS = [
  { key: 'app.timezone', tab: 'general', type: 'timezone', default: 'Europe/Zurich' },
  { key: 'auth.method', tab: 'auth', type: 'enum', values: ['local', 'oidc'], default: 'local' },
  { key: 'oidc.issuer', tab: 'auth', type: 'url', default: '' },
  { key: 'oidc.client_id', tab: 'auth', type: 'text', default: '' },
  { key: 'oidc.redirect_uri', tab: 'auth', type: 'url', default: '' },
  { key: 'jobs.retention_days', tab: 'jobs', type: 'int', min: 1, max: 3650, default: 30 },
];

let state;
function reset() {
  state = { values: Object.fromEntries(DEFS.map((d) => [d.key, d.default])), patches: [] };
}
reset();

const view = () => ({
  tabs: ['general', 'auth', 'jobs'],
  settings: DEFS.map((d) => ({ ...d, value: state.values[d.key] })),
  env: { oidcClientSecret: false },
});

async function handle(req, res, url, { json, readBody }) {
  if (url === '/__mock/settings' && req.method === 'GET') return json(res, 200, state), true;
  if (url !== '/api/admin/settings') return false;
  if (req.method === 'GET') return json(res, 200, view()), true;
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    state.patches.push(body);
    const next = { ...state.values, ...body };
    const days = Number(next['jobs.retention_days']);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return json(res, 400, { error: 'jobs.retention_days: out of range' }), true;
    next['jobs.retention_days'] = days;
    if (next['auth.method'] === 'oidc') {
      for (const k of ['oidc.issuer', 'oidc.client_id', 'oidc.redirect_uri']) {
        if (!next[k]) return json(res, 400, { error: `${k}: required for oidc` }), true;
      }
    }
    state.values = next;
    return json(res, 200, view()), true;
  }
  return false;
}

module.exports = { reset, handle };
