'use strict';
// Unit: lib/login-ratelimit.js — one bucket per IP, block after MAX_FAILS,
// released after the window, reset by a success.

const test = require('node:test');
const assert = require('node:assert');
const rl = require('../../lib/login-ratelimit');

test.beforeEach(() => rl._resetAll());

test('blocks after MAX_FAILS within the window, with Retry-After', () => {
  const t0 = 1_000_000;
  for (let i = 1; i < rl.MAX_FAILS; i++) assert.equal(rl.recordFailure('1.2.3.4', t0).blocked, false);
  const s = rl.recordFailure('1.2.3.4', t0);
  assert.equal(s.blocked, true);
  assert.ok(s.retryAfterSec > 0);
  assert.equal(rl.getState('5.6.7.8', t0).blocked, false, 'other IPs untouched');
});

test('block ends after the window', () => {
  const t0 = 2_000_000;
  for (let i = 0; i < rl.MAX_FAILS; i++) rl.recordFailure('9.9.9.9', t0);
  assert.equal(rl.getState('9.9.9.9', t0 + rl.WINDOW_MS + 1).blocked, false);
});

test('success resets the counter', () => {
  for (let i = 0; i < rl.MAX_FAILS - 1; i++) rl.recordFailure('7.7.7.7');
  rl.recordSuccess('7.7.7.7');
  assert.equal(rl.getState('7.7.7.7').fails, 0);
});
