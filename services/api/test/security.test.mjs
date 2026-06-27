import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from '../dist/security.js';

test('password hashes are salted and verifiable', () => {
  const first = hashPassword('correct horse battery staple');
  const second = hashPassword('correct horse battery staple');
  assert.notEqual(first, second);
  assert.equal(verifyPassword('correct horse battery staple', first), true);
  assert.equal(verifyPassword('wrong password', first), false);
  assert.equal(verifyPassword('correct horse battery staple', 'invalid'), false);
});

test('session tokens have sufficient entropy and only hashes are persisted', () => {
  const token = generateSessionToken();
  assert.ok(token.length >= 43);
  const tokenHash = hashSessionToken(token);
  assert.equal(tokenHash.length, 64);
  assert.notEqual(tokenHash, token);
  assert.equal(hashSessionToken(token), tokenHash);
});
