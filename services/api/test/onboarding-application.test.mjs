import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43180;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-onboard-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-onboard-missing-${process.pid}.env`);
let server;
let uniqueCounter = 0;

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

async function loginToken(username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  return { status: response.status, token: body.token, body };
}

function nextLoginId() {
  uniqueCounter += 1;
  return `90000${String(100 + uniqueCounter).slice(-3)}${process.pid % 100}`;
}

async function submitApplication(overrides = {}) {
  const loginId = overrides.loginId ?? nextLoginId();
  const payload = {
    businessName: overrides.businessName ?? `Test Bakery ${loginId}`,
    contactPerson: 'Test Contact',
    loginId,
    phone: loginId,
    defaultAddress: '12 Test Street',
    zone: 'North',
    gstin: '32AAJCS1132Q1Z5',
    requestedCredit: '₹50,000 / 15 days',
    documents: ['GST certificate', 'FSSAI license', 'Cancelled cheque'],
    ...overrides,
  };
  const response = await fetch(`${baseUrl}/customer/applications`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json(), loginId, businessName: payload.businessName };
}

async function decide(token, id, payload) {
  const response = await fetch(`${baseUrl}/admin/applications/${id}/decide`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
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

test('public intake creates only an application — no customer, branch, or login', async () => {
  const { status, body, loginId, businessName } = await submitApplication();
  assert.equal(status, 201);
  assert.equal(body.application.status, 'submitted');
  assert.ok(body.application.id);
  // No customer payload is returned and no session token is issued.
  assert.equal('token' in body, false);
  assert.equal('customer' in body, false);

  // The applicant cannot log in: no login was created.
  const attempt = await loginToken(loginId, 'anything');
  assert.equal(attempt.status, 401);

  // No customer exists yet for this business.
  const owner = await loginToken('owner', 'owner123');
  const customersResponse = await fetch(`${baseUrl}/customers`, {
    headers: { authorization: `Bearer ${owner.token}` },
  });
  const customers = await customersResponse.json();
  assert.equal(customers.customers.some((entry) => entry.name === businessName), false);
});

test('admin approval activates the customer with admin-set terms, ignoring applicant-supplied terms', async () => {
  // Applicant tries to smuggle generous commercial terms into the intake.
  const { body, loginId, businessName } = await submitApplication({ tier: 'Tier A', creditLimit: 999999 });
  const applicationId = body.application.id;

  const owner = await loginToken('owner', 'owner123');
  const approval = await decide(owner.token, applicationId, {
    decision: 'approve',
    tier: 'Tier B',
    creditLimit: 25000,
  });
  assert.equal(approval.status, 201);
  assert.equal(approval.body.application.status, 'approved');
  assert.equal(approval.body.customer.tier, 'Tier B');
  assert.equal(approval.body.customer.creditLimit, 25000);
  assert.ok(approval.body.credentials.temporaryPassword);
  assert.equal(approval.body.credentials.loginId, loginId);

  // The customer now exists and the issued login works.
  const customersResponse = await fetch(`${baseUrl}/customers`, {
    headers: { authorization: `Bearer ${owner.token}` },
  });
  const customers = await customersResponse.json();
  const created = customers.customers.find((entry) => entry.name === businessName);
  assert.ok(created);
  assert.equal(created.creditLimit, 25000);

  const customerLogin = await loginToken(loginId, approval.body.credentials.temporaryPassword);
  assert.equal(customerLogin.status, 200);
  assert.equal(customerLogin.body.user.role, 'customer');
});

test('approval requires admin-set commercial terms', async () => {
  const { body } = await submitApplication();
  const owner = await loginToken('owner', 'owner123');
  const missingTerms = await decide(owner.token, body.application.id, { decision: 'approve' });
  assert.equal(missingTerms.status, 400);
});

test('an already-activated application cannot be approved again', async () => {
  const { body } = await submitApplication();
  const owner = await loginToken('owner', 'owner123');
  const first = await decide(owner.token, body.application.id, { decision: 'approve', tier: 'Tier C', creditLimit: 1000 });
  assert.equal(first.status, 201);
  const second = await decide(owner.token, body.application.id, { decision: 'approve', tier: 'Tier C', creditLimit: 1000 });
  assert.equal(second.status, 409);
});

test('rejection requires a reason and is terminal', async () => {
  const { body } = await submitApplication();
  const owner = await loginToken('owner', 'owner123');

  const noReason = await decide(owner.token, body.application.id, { decision: 'reject' });
  assert.equal(noReason.status, 400);

  const rejected = await decide(owner.token, body.application.id, { decision: 'reject', reason: 'Incomplete KYC' });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.application.status, 'rejected');

  const reattempt = await decide(owner.token, body.application.id, { decision: 'approve', tier: 'Tier C', creditLimit: 1000 });
  assert.equal(reattempt.status, 409);
});

test('non-admins cannot view or decide applications', async () => {
  const { body } = await submitApplication();

  const anon = await fetch(`${baseUrl}/admin/applications`);
  assert.equal(anon.status, 401);

  const customer = await loginToken('9000000002', 'lotus123');
  const forbiddenList = await fetch(`${baseUrl}/admin/applications`, {
    headers: { authorization: `Bearer ${customer.token}` },
  });
  assert.equal(forbiddenList.status, 403);

  const forbiddenDecide = await decide(customer.token, body.application.id, {
    decision: 'approve',
    tier: 'Tier A',
    creditLimit: 999999,
  });
  assert.equal(forbiddenDecide.status, 403);
});
