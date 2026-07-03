import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findMinimumOrderQuantityViolation } from '../dist/catalog.js';

test('findMinimumOrderQuantityViolation flags lines below MOQ only', () => {
  const products = [
    { id: 'p1', name: 'Sourdough', minimumOrderQuantity: 10 },
    { id: 'p2', name: 'Croissant' },
  ];
  assert.equal(findMinimumOrderQuantityViolation([{ productId: 'p1', quantity: 10 }], products), null);
  assert.equal(findMinimumOrderQuantityViolation([{ productId: 'p2', quantity: 1 }], products), null);
  assert.match(
    findMinimumOrderQuantityViolation([{ productId: 'p1', quantity: 4 }], products),
    /minimum order quantity of 10/,
  );
});

const port = 43186;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-catalog-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-catalog-missing-${process.pid}.env`);
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

async function createProduct(t, body) {
  const response = await fetch(`${baseUrl}/admin/products`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
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

test('product master fields are stored and normalized on create', async () => {
  const owner = await token('owner', 'owner123');
  const created = await createProduct(owner, {
    name: 'Multigrain Loaf',
    category: 'Breads',
    price: 120,
    sku: 'mg-loaf-01',
    packSize: '400 g',
    unitOfMeasure: 'loaf',
    minimumOrderQuantity: 6,
    taxRatePercent: 5,
    hsnCode: '1905',
    allergens: ['gluten', 'sesame', '  '],
    shelfLifeDays: 3,
    leadTimeDays: 1,
  });
  assert.equal(created.status, 201);
  const p = created.body.product;
  assert.equal(p.sku, 'MG-LOAF-01');
  assert.equal(p.minimumOrderQuantity, 6);
  assert.equal(p.taxRatePercent, 5);
  assert.deepEqual(p.allergens, ['gluten', 'sesame']);
  assert.equal(p.shelfLifeDays, 3);
});

test('product master validation rejects duplicate SKU and out-of-range values', async () => {
  const owner = await token('owner', 'owner123');
  await createProduct(owner, { name: 'First', category: 'Breads', price: 50, sku: 'dup-1' });

  assert.equal((await createProduct(owner, { name: 'Second', category: 'Breads', price: 50, sku: 'DUP-1' })).status, 400);
  assert.equal(
    (await createProduct(owner, { name: 'Bad MOQ', category: 'Breads', price: 50, minimumOrderQuantity: 0 })).status,
    400,
  );
  assert.equal(
    (await createProduct(owner, { name: 'Bad Tax', category: 'Breads', price: 50, taxRatePercent: 150 })).status,
    400,
  );
});

test('product master fields can be patched', async () => {
  const owner = await token('owner', 'owner123');
  const created = await createProduct(owner, { name: 'Patchable', category: 'Breads', price: 80 });
  const id = created.body.product.id;

  const patched = await fetch(`${baseUrl}/admin/products/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${owner}`, 'content-type': 'application/json' },
    body: JSON.stringify({ minimumOrderQuantity: 12, taxRatePercent: 18, sku: 'patch-01' }),
  });
  assert.equal(patched.status, 200);
  const p = (await patched.json()).product;
  assert.equal(p.minimumOrderQuantity, 12);
  assert.equal(p.taxRatePercent, 18);
  assert.equal(p.sku, 'PATCH-01');
});
