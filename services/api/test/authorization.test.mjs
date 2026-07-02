import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43182;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-authz-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-authz-missing-${process.pid}.env`);
let server;

function isolatedEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides, DOTENV_CONFIG_PATH: missingEnvPath };
  for (const key of ['MSG91_WIDGET_ID', 'MSG91_AUTHKEY', 'MSG91_AUTH_TOKEN', 'VASY_API_BASE_URL', 'VASY_API_KEY']) {
    delete environment[key];
  }
  return environment;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API did not become ready');
}

async function token(username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await response.json()).token;
}

function authed(t, method = 'GET', body) {
  const init = { method, headers: { authorization: `Bearer ${t}` } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return init;
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

const PROTECTED_GET_ROUTES = [
  '/customers',
  '/orders',
  '/admin/applications',
  '/documents',
  '/analytics/overview',
  '/customer/dashboard',
  '/production/batches',
  '/delivery/manifest',
  '/auth/me',
];

test('anonymous requests are rejected on protected routes', async () => {
  for (const route of PROTECTED_GET_ROUTES) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 401, `${route} should reject anonymous`);
  }
});

test('customer tokens cannot reach staff-only routes', async () => {
  const t = await token('9000000001', 'nook123');
  const forbidden = [
    ['GET', '/customers'],
    ['GET', '/orders'],
    ['GET', '/admin/applications'],
    ['GET', '/documents'],
    ['GET', '/analytics/overview'],
    ['GET', '/production/batches'],
    ['GET', '/delivery/manifest'],
    ['POST', '/admin/products'],
  ];
  for (const [method, route] of forbidden) {
    const response = await fetch(`${baseUrl}${route}`, authed(t, method, method === 'POST' ? {} : undefined));
    assert.equal(response.status, 403, `customer must be forbidden from ${method} ${route}`);
  }
});

test('staff tokens cannot reach customer-only routes', async () => {
  const t = await token('owner', 'owner123');
  const forbidden = [
    ['GET', '/customer/dashboard'],
    ['GET', '/customer/orders'],
    ['GET', '/customer/standing-orders'],
    ['POST', '/customer/orders'],
  ];
  for (const [method, route] of forbidden) {
    const response = await fetch(`${baseUrl}${route}`, authed(t, method, method === 'POST' ? {} : undefined));
    assert.equal(response.status, 403, `staff must be forbidden from ${method} ${route}`);
  }
});

test('role-scoped staff routes enforce the specific role', async () => {
  const support = await token('support', 'support123');
  const delivery = await token('delivery', 'delivery123');
  const production = await token('production', 'production123');

  // Product management is owner/manager only.
  assert.equal((await fetch(`${baseUrl}/admin/products`, authed(support, 'POST', {}))).status, 403);
  // Production batches exclude the delivery role.
  assert.equal((await fetch(`${baseUrl}/production/batches`, authed(delivery))).status, 403);
  // Delivery manifest excludes the production role.
  assert.equal((await fetch(`${baseUrl}/delivery/manifest`, authed(production))).status, 403);
});

test('permission-gated routes reject roles without the permission', async () => {
  const accounts = await token('accounts', 'accounts123');
  const support = await token('support', 'support123');
  const owner = await token('owner', 'owner123');

  // canCaptureReturns: accounts lacks it.
  assert.equal((await fetch(`${baseUrl}/admin/orders/ord_x/returns`, authed(accounts, 'POST', {}))).status, 403);
  // canEditOrders: support lacks it.
  assert.equal((await fetch(`${baseUrl}/admin/orders/ord_x/adjust`, authed(support, 'POST', {}))).status, 403);
  // canSyncErp: accounts lacks it.
  assert.equal((await fetch(`${baseUrl}/erp/sync/trigger`, authed(accounts, 'POST'))).status, 403);
  // Owner has canSyncErp, so it passes the guard and reaches the honest
  // "not configured" response rather than 403/401.
  assert.equal((await fetch(`${baseUrl}/erp/sync/trigger`, authed(owner, 'POST'))).status, 503);
});

test('cross-tenant access to another customer is denied', async () => {
  const lotus = await token('9000000002', 'lotus123');
  const cases = [
    ['GET', '/documents/doc_gst_cafe_nook/download'],
    ['GET', '/documents/doc_gst_cafe_nook/content'],
    ['POST', '/branches/branch_cafe_nook_main/serviceability/check'],
  ];
  for (const [method, route] of cases) {
    const response = await fetch(`${baseUrl}${route}`, authed(lotus, method));
    assert.equal(response.status, 404, `cross-tenant ${method} ${route} must be denied`);
  }
});

test('authorized roles still succeed (positive controls)', async () => {
  const owner = await token('owner', 'owner123');
  assert.equal((await fetch(`${baseUrl}/customers`, authed(owner))).status, 200);
  assert.equal((await fetch(`${baseUrl}/orders`, authed(owner))).status, 200);
  assert.equal((await fetch(`${baseUrl}/admin/applications`, authed(owner))).status, 200);

  const nook = await token('9000000001', 'nook123');
  assert.equal((await fetch(`${baseUrl}/customer/dashboard`, authed(nook))).status, 200);
});
