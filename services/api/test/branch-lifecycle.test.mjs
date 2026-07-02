import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43185;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-branch-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-branch-missing-${process.pid}.env`);
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

async function transition(t, branchId, status) {
  const response = await fetch(`${baseUrl}/branches/${branchId}/transition`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return { status: response.status, body: await response.json() };
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

async function requestBranch(customerToken, code) {
  const response = await fetch(`${baseUrl}/customer/branches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Branch ${code}`, code, serviceZone: 'North' }),
  });
  return { status: response.status, body: await response.json() };
}

test('a customer-requested branch starts pending and cannot be ordered against', async () => {
  const customer = await token('9000000001', 'nook123');
  const created = await requestBranch(customer, 'PEND1');
  assert.equal(created.status, 201);
  assert.equal(created.body.branch.status, 'pending_approval');

  const order = await fetch(`${baseUrl}/customer/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${customer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ branchId: created.body.branch.id, items: [] }),
  });
  assert.equal(order.status, 400);
  assert.match((await order.json()).error, /pending_approval/);
});

test('staff drive the branch approval state machine with valid transitions only', async () => {
  const customer = await token('9000000001', 'nook123');
  const owner = await token('owner', 'owner123');
  const branchId = (await requestBranch(customer, 'SM1')).body.branch.id;

  // Invalid jump: pending -> paused is not allowed.
  assert.equal((await transition(owner, branchId, 'paused')).status, 409);

  // Approve, then suspend and reactivate.
  assert.equal((await transition(owner, branchId, 'active')).body.branch.status, 'active');
  assert.equal((await transition(owner, branchId, 'service_hold')).body.branch.status, 'service_hold');
  assert.equal((await transition(owner, branchId, 'active')).body.branch.status, 'active');

  // Close is terminal.
  assert.equal((await transition(owner, branchId, 'closed')).body.branch.status, 'closed');
  assert.equal((await transition(owner, branchId, 'active')).status, 409);
});

test('branch transitions are guarded by role and existence', async () => {
  const customer = await token('9000000001', 'nook123');
  const branchId = (await requestBranch(customer, 'RB1')).body.branch.id;

  // Customers cannot drive transitions.
  assert.equal((await transition(customer, branchId, 'active')).status, 403);
  // Unknown branch.
  assert.equal((await transition(await token('owner', 'owner123'), 'branch_missing', 'active')).status, 404);
});
