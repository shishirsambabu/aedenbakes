import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43179;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-auth-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-auth-missing-${process.pid}.env`);
let server;

function isolatedEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides, DOTENV_CONFIG_PATH: missingEnvPath };
  for (const key of [
    'MSG91_WIDGET_ID',
    'MSG91_AUTHKEY',
    'MSG91_AUTH_TOKEN',
    'VASY_API_BASE_URL',
    'VASY_API_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ]) {
    delete environment[key];
  }
  return environment;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API did not become ready');
}

async function startServer() {
  server = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: isolatedEnvironment({
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: databasePath,
      ENABLE_DEMO_ACCOUNTS: 'true',
      EXPOSE_OTP_DEBUG_CODE: 'false',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
}

async function stopServer() {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
  }
}

async function login(username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { status: response.status, body: await response.json() };
}

async function refresh(refreshToken) {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  await startServer();
});

after(async () => {
  await stopServer();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await rm(databasePath, { force: true });
  await rm(`${databasePath}-shm`, { force: true });
  await rm(`${databasePath}-wal`, { force: true });
});

test('login issues an access token and a rotating refresh token for the device', async () => {
  const { status, body } = await login('owner', 'owner123');
  assert.equal(status, 200);
  assert.ok(body.token);
  assert.ok(body.refreshToken);
  assert.ok(body.refreshToken.startsWith(`${body.sessionId}.`));
  assert.ok(body.expiresAt);
  assert.ok(body.refreshExpiresAt);
  assert.equal(body.user.role, 'owner');
});

test('refresh rotates the refresh token and returns a working access token', async () => {
  const { body: session } = await login('owner', 'owner123');

  const rotated = await refresh(session.refreshToken);
  assert.equal(rotated.status, 200);
  assert.ok(rotated.body.token);
  assert.notEqual(rotated.body.token, session.token);
  assert.notEqual(rotated.body.refreshToken, session.refreshToken);
  assert.equal(rotated.body.sessionId, session.sessionId);

  const me = await fetch(`${baseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${rotated.body.token}` },
  });
  assert.equal(me.status, 200);
});

test('replaying a rotated refresh token is detected and revokes the session', async () => {
  const { body: session } = await login('owner', 'owner123');

  const first = await refresh(session.refreshToken);
  assert.equal(first.status, 200);

  // Replay the original (already-rotated) token.
  const replay = await refresh(session.refreshToken);
  assert.equal(replay.status, 401);
  assert.equal(replay.body.code, 'REFRESH_TOKEN_REUSE');

  // The whole device session is now revoked, so the latest token also fails.
  const afterReuse = await refresh(first.body.refreshToken);
  assert.equal(afterReuse.status, 401);
});

test('a user can list and revoke a single device session', async () => {
  const deviceA = await login('owner', 'owner123');
  const deviceB = await login('owner', 'owner123');

  const listResponse = await fetch(`${baseUrl}/auth/sessions`, {
    headers: { authorization: `Bearer ${deviceB.body.token}` },
  });
  const list = await listResponse.json();
  assert.ok(list.sessions.length >= 2);
  const current = list.sessions.find((entry) => entry.id === deviceB.body.sessionId);
  assert.equal(current.current, true);

  const revokeResponse = await fetch(`${baseUrl}/auth/sessions/${deviceA.body.sessionId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${deviceB.body.token}` },
  });
  assert.equal(revokeResponse.status, 200);

  // Device A can no longer refresh.
  const blocked = await refresh(deviceA.body.refreshToken);
  assert.equal(blocked.status, 401);
  // Device B is still able to refresh.
  const stillValid = await refresh(deviceB.body.refreshToken);
  assert.equal(stillValid.status, 200);
});

test('revoke-all keeps the current session and drops the others', async () => {
  const deviceA = await login('owner', 'owner123');
  const deviceB = await login('owner', 'owner123');

  const revokeAll = await fetch(`${baseUrl}/auth/sessions/revoke-all`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deviceB.body.token}` },
  });
  assert.equal(revokeAll.status, 200);

  const blocked = await refresh(deviceA.body.refreshToken);
  assert.equal(blocked.status, 401);
  const stillValid = await refresh(deviceB.body.refreshToken);
  assert.equal(stillValid.status, 200);
});

test('refresh tokens survive an API restart', async () => {
  const { body: session } = await login('owner', 'owner123');

  await stopServer();
  await startServer();

  // The in-memory access token is gone after restart...
  const staleAccess = await fetch(`${baseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(staleAccess.status, 401);

  // ...but the persisted refresh token still mints a new access token.
  const rotated = await refresh(session.refreshToken);
  assert.equal(rotated.status, 200);
  const me = await fetch(`${baseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${rotated.body.token}` },
  });
  assert.equal(me.status, 200);
});

test('password change validates, rotates credentials, and revokes other sessions', async () => {
  const deviceA = await login('support', 'support123');
  const deviceB = await login('support', 'support123');

  const wrongCurrent = await fetch(`${baseUrl}/auth/password`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deviceB.body.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'nope', newPassword: 'support-strong-1' }),
  });
  assert.equal(wrongCurrent.status, 401);

  const weakNew = await fetch(`${baseUrl}/auth/password`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deviceB.body.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'support123', newPassword: 'short' }),
  });
  assert.equal(weakNew.status, 400);

  const changed = await fetch(`${baseUrl}/auth/password`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deviceB.body.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'support123', newPassword: 'support-strong-1' }),
  });
  assert.equal(changed.status, 200);
  const changedBody = await changed.json();
  assert.ok(changedBody.revokedSessions >= 1);

  // Other device session is revoked.
  const blocked = await refresh(deviceA.body.refreshToken);
  assert.equal(blocked.status, 401);

  // Old password no longer works; new password does.
  const oldLogin = await login('support', 'support123');
  assert.equal(oldLogin.status, 401);
  const newLogin = await login('support', 'support-strong-1');
  assert.equal(newLogin.status, 200);
});
