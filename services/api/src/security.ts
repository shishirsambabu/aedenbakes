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

// Refresh tokens carry their session id as a prefix so the server can locate
// the stored record without scanning, then verify the secret against a hash.
export function generateRefreshToken(sessionId: string) {
  const secret = crypto.randomBytes(32).toString('base64url');
  return `${sessionId}.${secret}`;
}

export function parseRefreshTokenSessionId(token: string) {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex >= token.length - 1) {
    return null;
  }
  return token.slice(0, separatorIndex);
}

// Constant-time comparison for two equal-length hex digests.
export function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
}
