'use strict';
// Unit: lib/password.js — scrypt format, verification, policy, rehash signal,
// constant-time secret compare (docs/auth.md → Invarianten).

const test = require('node:test');
const assert = require('node:assert');
const password = require('../../lib/password');

test('hash → verify round trip, wrong password fails', async () => {
  const h = await password.hashPassword('korrekt-pferd-batterie');
  assert.match(h, /^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
  assert.equal(await password.verifyPassword('korrekt-pferd-batterie', h), true);
  assert.equal(await password.verifyPassword('falsch-pferd-batterie', h), false);
});

test('same password → different salt → different hash', async () => {
  const a = await password.hashPassword('gleiches-passwort-1');
  const b = await password.hashPassword('gleiches-passwort-1');
  assert.notEqual(a, b);
});

test('broken or foreign hash never throws, just fails', async () => {
  for (const stored of [null, '', 'bcrypt$x', 'scrypt$0$8$1$AA$AA', 'scrypt$a$b$c$d$e']) {
    assert.equal(await password.verifyPassword('irgendwas-langes', stored), false);
  }
});

test('needsRehash: current params no, weaker params yes', async () => {
  const h = await password.hashPassword('aktuelles-passwort');
  assert.equal(password.needsRehash(h), false);
  assert.equal(password.needsRehash(h.replace('scrypt$32768$', 'scrypt$16384$')), true);
});

test('policy: length only, with an upper byte cap', () => {
  assert.equal(password.validatePassword(''), 'password required');
  assert.equal(password.validatePassword('a'.repeat(password.MIN_LENGTH - 1)), 'password too short');
  assert.equal(password.validatePassword('a'.repeat(password.MIN_LENGTH)), null);
  assert.equal(password.validatePassword('a'.repeat(1025)), 'password too long');
});

test('secretsMatch: equal only for identical secrets, empty never matches', () => {
  assert.equal(password.secretsMatch('env-geheimnis', 'env-geheimnis'), true);
  assert.equal(password.secretsMatch('env-geheimnis', 'env-geheimnis '), false);
  assert.equal(password.secretsMatch('', ''), false);
  assert.equal(password.secretsMatch(null, 'x'), false);
});
