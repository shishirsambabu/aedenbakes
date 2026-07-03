import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43187;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-ccat-${process.pid}.sqlite`);
const missingEnvPath = join(tmpdir(), `aeden-bakes-ccat-missing-${process.pid}.env`);
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

async function createAndPublish(owner, body, publish = true) {
  const created = await (
    await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: { authorization: `Bearer ${owner}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
  const id = created.product.id;
  if (publish) {
    await fetch(`${baseUrl}/admin/products/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${owner}`, 'content-type': 'application/json' },
      body: JSON.stringify({ published: true }),
    });
  }
  return id;
}

async function catalog(customer, query = '') {
  const response = await fetch(`${baseUrl}/customer/catalog${query}`, {
    headers: { authorization: `Bearer ${customer}` },
  });
  return (await response.json()).products;
}

let owner;
let customer;
let ryeId;
let cookieId;
let secretId;

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
  owner = await token('owner', 'owner123');
  customer = await token('9000000001', 'nook123');
  ryeId = await createAndPublish(owner, { name: 'Artisan Rye', category: 'Breads', price: 100, sku: 'rye-1' });
  cookieId = await createAndPublish(owner, { name: 'Butter Cookie', category: 'Cookies', price: 50, sku: 'cookie-1' });
  secretId = await createAndPublish(owner, { name: 'Secret Item', category: 'Breads', price: 200 }, false);
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

test('customer catalog shows only published products', async () => {
  const items = await catalog(customer);
  assert.ok(items.some((p) => p.id === ryeId));
  assert.ok(items.some((p) => p.id === cookieId));
  assert.equal(items.some((p) => p.id === secretId), false); // unpublished hidden
});

test('search and category filters narrow the catalog', async () => {
  const byName = await catalog(customer, '?q=rye');
  assert.ok(byName.some((p) => p.id === ryeId));
  assert.equal(byName.some((p) => p.id === cookieId), false);

  const bySku = await catalog(customer, '?q=cookie-1');
  assert.ok(bySku.some((p) => p.id === cookieId));

  const byCategory = await catalog(customer, '?category=cookies');
  assert.ok(byCategory.some((p) => p.id === cookieId));
  assert.equal(byCategory.some((p) => p.id === ryeId), false);
});

test('price sort orders cheaper products first', async () => {
  const items = await catalog(customer, '?sort=price_asc');
  const cookiePos = items.findIndex((p) => p.id === cookieId);
  const ryePos = items.findIndex((p) => p.id === ryeId);
  assert.ok(cookiePos >= 0 && ryePos >= 0);
  assert.ok(cookiePos < ryePos, 'cheaper cookie should sort before pricier rye');
});

test('favorites can be added, reflected in the catalog, and removed', async () => {
  const add = await fetch(`${baseUrl}/customer/favorites`, {
    method: 'POST',
    headers: { authorization: `Bearer ${customer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: ryeId }),
  });
  assert.equal(add.status, 201);

  const withFav = await catalog(customer);
  assert.equal(withFav.find((p) => p.id === ryeId)?.favorite, true);
  assert.equal(withFav.find((p) => p.id === cookieId)?.favorite, false);

  const favList = await (await fetch(`${baseUrl}/customer/favorites`, { headers: { authorization: `Bearer ${customer}` } })).json();
  assert.ok(favList.products.some((p) => p.id === ryeId));

  const remove = await fetch(`${baseUrl}/customer/favorites/${ryeId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${customer}` },
  });
  assert.equal(remove.status, 200);
  const afterRemove = await catalog(customer);
  assert.equal(afterRemove.find((p) => p.id === ryeId)?.favorite, false);
});

test('adding a non-existent product as favorite is rejected', async () => {
  const response = await fetch(`${baseUrl}/customer/favorites`, {
    method: 'POST',
    headers: { authorization: `Bearer ${customer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'prod_missing' }),
  });
  assert.equal(response.status, 404);
});
