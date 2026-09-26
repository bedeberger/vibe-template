'use strict';
// Password hashing for local accounts (docs/auth.md). Pattern from
// schreibwerkstatt.
//
// scrypt from Node core instead of bcrypt/argon2: no native dependency that has
// to be rebuilt on every Node upgrade of the LXC. scrypt is memory-hard and so
// expensive to brute-force on a GPU.
//
// Stored format:   scrypt$<N>$<r>$<p>$<salt-b64url>$<hash-b64url>
//
// The parameters live IN the string: raising the cost later must keep old
// hashes verifiable, otherwise a parameter change locks every account out.
// needsRehash() reports which hashes to recompute on the next good login.

const crypto = require('crypto');

// N=2^15 ≈ 100 ms and 32 MB per verification — expensive offline, unnoticeable
// at login. maxmem must be raised explicitly, Node's 32 MB default throws above
// N=16384.
const PARAMS = { N: 32768, r: 8, p: 1, keylen: 64 };
const MAXMEM = 256 * 1024 * 1024;

// Length is the lever that works; forced character classes push passwords
// towards "Passwort1!" without making them harder to guess.
const MIN_LENGTH = 12;
// Only a guard against pointing the scrypt cost at the server with a 1 MB body.
const MAX_BYTES = 1024;

const b64 = (buf) => buf.toString('base64url');

function scrypt(password, salt, { N, r, p, keylen }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(Buffer.from(String(password), 'utf8'), salt, keylen, { N, r, p, maxmem: MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  if (typeof password !== 'string' || !password) throw new Error('password required');
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${b64(salt)}$${b64(key)}`;
}

function parse(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (!salt.length || !hash.length) return null;
  return { N, r, p, salt, hash, keylen: hash.length };
}

// Never throws: a broken hash in the DB is a failed login, not a 500 that tells
// the caller this account exists.
async function verifyPassword(password, stored) {
  const parsed = parse(stored);
  if (!parsed || typeof password !== 'string' || !password) return false;
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return false;
  try {
    const key = await scrypt(password, parsed.salt, parsed);
    return crypto.timingSafeEqual(key, parsed.hash);
  } catch {
    return false;
  }
}

function needsRehash(stored) {
  const p = parse(stored);
  return !p || p.N !== PARAMS.N || p.r !== PARAMS.r || p.p !== PARAMS.p || p.keylen !== PARAMS.keylen;
}

// Policy check before setting. Returns null when fine, else an error code the
// route maps to 400 (the frontend translates it).
function validatePassword(password) {
  if (typeof password !== 'string' || !password) return 'password required';
  if ([...password].length < MIN_LENGTH) return 'password too short';
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return 'password too long';
  return null;
}

// Constant-time comparison of two secrets of arbitrary length (the .env admin
// password): hash both sides so timingSafeEqual gets equal-length buffers and
// the length itself leaks nothing.
function secretsMatch(expected, given) {
  if (!expected || typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(String(expected)).digest();
  const b = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword, needsRehash, validatePassword, secretsMatch, MIN_LENGTH, PARAMS };
