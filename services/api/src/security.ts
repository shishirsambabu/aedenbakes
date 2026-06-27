import crypto from 'node:crypto';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, expectedHex] = passwordHash.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
