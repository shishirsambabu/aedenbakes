import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const port = 43177;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-test-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-missing-${process.pid}.env`);
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

before(async () => {
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
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  await rm(databasePath, { force: true });
  await rm(`${databasePath}-shm`, { force: true });
  await rm(`${databasePath}-wal`, { force: true });
});

test('health reports honest local connector state', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(response.headers.get('x-content-type-options'));
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.environment, 'test');
  assert.equal(body.otpProvider, 'local');
  assert.equal(body.erpProvider, 'not_configured');
  assert.equal('databasePath' in body, false);
});

test('protected routes reject anonymous access', async () => {
  const response = await fetch(`${baseUrl}/customers`);
  assert.equal(response.status, 401);
});

test('unsafe prototype onboarding is disabled by default', async () => {
  const response = await fetch(`${baseUrl}/customer/onboard`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, 'ONBOARDING_RECOVERY_IN_PROGRESS');
});

test('demo staff login works only in the non-production test profile', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'owner123' }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.role, 'owner');
  assert.ok(body.token);
});

test('passwords and session tokens are one-way protected at rest', async () => {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'owner123' }),
  });
  const login = await loginResponse.json();
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const stateRow = database.prepare('SELECT snapshot FROM app_state WHERE id = 1').get();
    assert.ok(stateRow);
    assert.equal(stateRow.snapshot.includes('"password":'), false);
    assert.equal(stateRow.snapshot.includes('"passwordHash":'), false);

    const principals = database.prepare('SELECT password_hash FROM auth_principals').all();
    assert.ok(principals.length > 0);
    assert.equal(principals.every((row) => row.password_hash.startsWith('scrypt$')), true);

    const sessionRows = database.prepare('SELECT token FROM auth_sessions').all();
    assert.ok(sessionRows.length > 0);
    assert.equal(sessionRows.some((row) => row.token === login.token), false);
    assert.equal(
      sessionRows.some((row) => row.token === crypto.createHash('sha256').update(login.token).digest('hex')),
      true,
    );
  } finally {
    database.close();
  }
});

test('login throttling blocks repeated invalid credentials', async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'throttle-probe', password: 'incorrect' }),
    });
    assert.equal(response.status, attempt < 5 ? 401 : 429);
  }

  const blockedResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'throttle-probe', password: 'incorrect' }),
  });
  assert.equal(blockedResponse.status, 429);
  assert.ok(Number(blockedResponse.headers.get('retry-after')) > 0);
});

test('OTP requests are throttled per phone and client', async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/auth/otp/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '9999900011' }),
    });
    assert.equal(response.status, 200);
  }
  const blockedResponse = await fetch(`${baseUrl}/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '9999900011' }),
  });
  assert.equal(blockedResponse.status, 429);
  assert.ok(Number(blockedResponse.headers.get('retry-after')) > 0);
});

test('customer sessions cannot access another customer branch or document', async () => {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: '9000000002', password: 'lotus123' }),
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  const headers = { authorization: `Bearer ${login.token}` };

  const branchResponse = await fetch(`${baseUrl}/branches/branch_cafe_nook_main/serviceability/check`, {
    method: 'POST',
    headers,
  });
  assert.equal(branchResponse.status, 404);

  const documentResponse = await fetch(`${baseUrl}/documents/doc_gst_cafe_nook/download`, { headers });
  assert.equal(documentResponse.status, 404);
});

test('external notifications stay queued until a provider sends them', async () => {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'owner123' }),
  });
  const login = await loginResponse.json();
  const response = await fetch(`${baseUrl}/notifications/queue`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${login.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      customerId: 'cust_cafe_nook',
      channel: 'whatsapp',
      subject: 'Runtime smoke test',
      correlationKey: `runtime-smoke-${process.pid}`,
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.job.status, 'queued');
  assert.equal(body.deliveries[0].status, 'queued');
  assert.equal(body.deliveries[0].providerMessageId, null);
});

test('unconfigured storage and ERP do not claim success', async () => {
  const storageResponse = await fetch(`${baseUrl}/storage/status`);
  const storage = await storageResponse.json();
  // Without R2 credentials the API uses real local storage, not cloud.
  assert.equal(storage.mode, 'local');
  assert.equal(storage.r2Configured, false);
  assert.equal(storage.uploadStorageEnabled, true);

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'owner123' }),
  });
  const login = await loginResponse.json();
  const erpResponse = await fetch(`${baseUrl}/erp/sync/trigger`, {
    method: 'POST',
    headers: { authorization: `Bearer ${login.token}` },
  });
  assert.equal(erpResponse.status, 503);
});

test('production startup fails closed without required configuration', async () => {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: isolatedEnvironment({ NODE_ENV: 'production', PORT: '43178', DATABASE_URL: '' }),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /Unsafe production configuration/);
});
