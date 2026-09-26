'use strict';
// In-memory rate limit for every password path (login, password change) —
// ONE bucket per IP, so brute force against one path also caps the others.
// MAX_FAILS failures within WINDOW_MS block the IP until the window ends
// (429 + Retry-After). Pattern from schreibwerkstatt.
//
// In-memory is enough for one self-hosted process: a restart forgets the
// counters, but an attacker needs seconds per attempt anyway (scrypt).
// The key is req.ip (resolved through the one trusted proxy hop in server.js),
// never a client-supplied X-Forwarded-For.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

const entries = new Map(); // ip → { fails, firstAt, blockedUntil }

function purge(now) {
  for (const [ip, e] of entries) {
    if ((e.blockedUntil && e.blockedUntil <= now) || (!e.blockedUntil && e.firstAt + WINDOW_MS <= now)) entries.delete(ip);
  }
}

function getState(ip, now = Date.now()) {
  const e = ip && entries.get(ip);
  if (!e) return { blocked: false, fails: 0 };
  if (e.blockedUntil && e.blockedUntil > now) {
    return { blocked: true, fails: e.fails, retryAfterSec: Math.ceil((e.blockedUntil - now) / 1000) };
  }
  if (e.blockedUntil || e.firstAt + WINDOW_MS <= now) { entries.delete(ip); return { blocked: false, fails: 0 }; }
  return { blocked: false, fails: e.fails };
}

function recordFailure(ip, now = Date.now()) {
  if (!ip) return getState(null);
  purge(now);
  const e = entries.get(ip);
  if (!e) entries.set(ip, { fails: 1, firstAt: now, blockedUntil: null });
  else e.fails += 1;
  const cur = entries.get(ip);
  if (cur.fails >= MAX_FAILS) cur.blockedUntil = now + WINDOW_MS;
  return getState(ip, now);
}

function recordSuccess(ip) {
  if (ip) entries.delete(ip);
}

// Tests only.
function _resetAll() { entries.clear(); }

module.exports = { getState, recordFailure, recordSuccess, MAX_FAILS, WINDOW_MS, _resetAll };
