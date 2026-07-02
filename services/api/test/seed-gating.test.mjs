import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const missingEnvPath = join(tmpdir(), `aeden-seed-missing-${process.pid}.env`);
const started = [];

function baseEnv(overrides) {
  const environment = { ...process.env, ...overrides, DOTENV_CONFIG_PATH: missingEnvPath };
  for (const key of ['MSG91_WIDGET_ID', 'MSG91_AUTHKEY', 'MSG91_AUTH_TOKEN', 'VASY_API_BASE_URL', 'VASY_API_KEY']) {
    delete environment[key];
  }
  return environment;
}

async function startServer(port, env) {
  const databasePath = join(tmpdir(), `aeden-seed-${port}-${process.pid}.sqlite`);
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: baseEnv({ NODE_ENV: 'test', PORT: String(port), DATABASE_URL: databasePath, ...env }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push({ server, databasePath });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return baseUrl;
    } catch {
      // starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API did not become ready');
}

async function loginStatus(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

after(async () => {
  for (const { server, databasePath } of started) {
    if (server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    await rm(databasePath, { force: true });
    await rm(`${databasePath}-shm`, { force: true });
    await rm(`${databasePath}-wal`, { force: true });
  }
});

test('with demo accounts disabled, no demo staff or customer logins are seeded', async () => {
  const baseUrl = await startServer(43183, { ENABLE_DEMO_ACCOUNTS: 'false' });
  assert.equal((await loginStatus(baseUrl, 'owner', 'owner123')).status, 401);
  assert.equal((await loginStatus(baseUrl, '9000000001', 'nook123')).status, 401);
  assert.equal((await loginStatus(baseUrl, '9000000002', 'lotus123')).status, 401);
});

test('a bootstrap owner from env can sign in when demo accounts are disabled', async () => {
  const baseUrl = await startServer(43184, {
    ENABLE_DEMO_ACCOUNTS: 'false',
    BOOTSTRAP_OWNER_USERNAME: 'founder',
    BOOTSTRAP_OWNER_PASSWORD: 'bootstrap-strong-1',
  });

  // Demo credentials still do not exist.
  assert.equal((await loginStatus(baseUrl, 'owner', 'owner123')).status, 401);

  // The bootstrap owner can sign in.
  const login = await loginStatus(baseUrl, 'founder', 'bootstrap-strong-1');
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'owner');
});
