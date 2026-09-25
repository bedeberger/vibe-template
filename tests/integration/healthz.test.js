'use strict';
// Integration: /healthz answers WITHOUT a session (the deploy workflow and the
// reverse proxy probe it unauthenticated), while the API stays guarded.
// LOCAL_DEV_MODE=0 so the auth guard is really armed.

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');

const ctx = bootstrap(); // LOCAL_DEV_MODE=0 — the auth guard is armed
test.before(ctx.start);
test.after(ctx.stop);

test('GET /healthz is public and reports ok', async () => {
  const res = await fetch(ctx.url('/healthz'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('the API still requires a session', async () => {
  const res = await fetch(ctx.url('/api/notebooks'));
  assert.equal(res.status, 401);
});
