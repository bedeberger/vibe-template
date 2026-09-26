'use strict';
// Unit: the shared route helpers (routes/_http.js) and the domain errors
// (lib/errors.js) — the one pattern every router copies. No DB, no server:
// handle() is driven with a fake req/res.

const test = require('node:test');
const assert = require('node:assert');
const { invalid, notFound, conflict, isDomainError } = require('../../lib/errors');
const { handle, requireId, toIntId } = require('../../routes/_http');

// Minimal Express-like response that records what was sent.
function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
  };
}

async function call(fn, opts) {
  const res = fakeRes();
  let forwarded = null;
  await handle(fn, opts)({}, res, (e) => { forwarded = e; });
  return { res, forwarded };
}

test('toIntId accepts positive integers only', () => {
  assert.equal(toIntId('7'), 7);
  for (const bad of ['0', '-1', '1.5', 'x', '', undefined, null]) assert.equal(toIntId(bad), null, String(bad));
});

test('requireId throws an invalid DomainError with the given message', () => {
  assert.equal(requireId('3'), 3);
  assert.throws(() => requireId('x'), (e) => isDomainError(e) && e.kind === 'invalid' && e.message === 'invalid id');
  assert.throws(() => requireId(null, 'note_id required'), /note_id required/);
});

test('handle sends the return value as JSON with the given status', async () => {
  const ok = await call(() => ({ a: 1 }));
  assert.deepEqual([ok.res.statusCode, ok.res.body], [200, { a: 1 }]);
  const created = await call(async () => ({ id: 1 }), { status: 201 });
  assert.equal(created.res.statusCode, 201);
});

test('handle maps each DomainError kind to its status and keeps the message', async () => {
  const cases = [[invalid('bad'), 400], [notFound(), 404], [conflict('user exists'), 409]];
  for (const [err, status] of cases) {
    const { res, forwarded } = await call(() => { throw err; });
    assert.deepEqual([res.statusCode, res.body], [status, { error: err.message }]);
    assert.equal(forwarded, null);
  }
  assert.equal(notFound().message, 'not found');
});

test('handle forwards unexpected errors to the central handler instead of answering', async () => {
  const boom = new Error('SQLITE_BUSY');
  const { res, forwarded } = await call(async () => { throw boom; });
  assert.equal(forwarded, boom);
  assert.equal(res.body, undefined);
});

test('handle leaves the response alone when the handler answered itself', async () => {
  const { res } = await call((req, r) => { r.status(204).json(null); });
  assert.equal(res.statusCode, 204);
});
