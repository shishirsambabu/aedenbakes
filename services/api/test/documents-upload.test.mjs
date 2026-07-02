import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43181;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = join(tmpdir(), `aeden-bakes-docs-${process.pid}.sqlite`);
const uploadDir = mkdtempSync(join(tmpdir(), 'aeden-docs-uploads-'));
const missingEnvPath = join(tmpdir(), `aeden-bakes-docs-missing-${process.pid}.env`);
let server;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
const PDF_B64 = PDF.toString('base64');
const PDF_SHA = createHash('sha256').update(PDF).digest('hex');

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
      // starting
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
      UPLOAD_STORAGE_DIR: uploadDir,
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

async function token(username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await response.json()).token;
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
  rmSync(uploadDir, { recursive: true, force: true });
});

test('storage status honestly reports the local adapter', async () => {
  const status = await (await fetch(`${baseUrl}/storage/status`)).json();
  assert.equal(status.mode, 'local');
  assert.equal(status.uploadStorageEnabled, true);
  assert.equal(status.r2Configured, false);
});

test('admin upload persists real bytes with a checksum, and content round-trips', async () => {
  const admin = await token('owner', 'owner123');
  const uploadResponse = await fetch(`${baseUrl}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      customerId: 'cust_cafe_nook',
      documentType: 'gst',
      title: 'GST Certificate',
      fileName: 'gst.pdf',
      contentBase64: PDF_B64,
    }),
  });
  assert.equal(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.equal(document.status, 'uploaded');
  assert.equal(document.contentStored, true);
  assert.equal(document.mimeType, 'application/pdf');
  assert.equal(document.sizeBytes, PDF.length);
  assert.equal(document.checksumSha256, PDF_SHA);
  assert.equal(document.contentUrl, `/documents/${document.id}/content`);

  const contentResponse = await fetch(`${baseUrl}${document.contentUrl}`, {
    headers: { authorization: `Bearer ${admin}` },
  });
  assert.equal(contentResponse.status, 200);
  assert.equal(contentResponse.headers.get('x-checksum-sha256'), PDF_SHA);
  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  assert.ok(bytes.equals(PDF));
});

test('uploads with unrecognized content are rejected', async () => {
  const admin = await token('owner', 'owner123');
  const response = await fetch(`${baseUrl}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      customerId: 'cust_cafe_nook',
      title: 'Bad file',
      fileName: 'notes.txt',
      contentBase64: Buffer.from('this is plain text, not a document').toString('base64'),
    }),
  });
  assert.equal(response.status, 415);
});

test('a metadata-only document has no content and cannot be verified', async () => {
  const admin = await token('owner', 'owner123');
  const created = await (
    await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: JSON.stringify({ customerId: 'cust_cafe_nook', title: 'Placeholder', fileName: 'todo.pdf' }),
    })
  ).json();
  assert.equal(created.document.status, 'draft');
  assert.equal(created.document.contentStored, false);

  const content = await fetch(`${baseUrl}/documents/${created.document.id}/content`, {
    headers: { authorization: `Bearer ${admin}` },
  });
  assert.equal(content.status, 409);

  const verify = await fetch(`${baseUrl}/documents/${created.document.id}/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}` },
  });
  assert.equal(verify.status, 409);
});

test('verify and reject transitions require stored content and a reason', async () => {
  const admin = await token('owner', 'owner123');
  const created = await (
    await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust_cafe_nook',
        title: 'FSSAI',
        fileName: 'fssai.pdf',
        contentBase64: PDF_B64,
      }),
    })
  ).json();

  const verified = await fetch(`${baseUrl}/documents/${created.document.id}/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}` },
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).document.status, 'verified');

  const noReason = await fetch(`${baseUrl}/documents/${created.document.id}/reject`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(noReason.status, 400);

  const rejected = await fetch(`${baseUrl}/documents/${created.document.id}/reject`, {
    method: 'POST',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Illegible scan' }),
  });
  assert.equal(rejected.status, 200);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.document.status, 'rejected');
  assert.equal(rejectedBody.document.rejectionReason, 'Illegible scan');
});

test('a customer uploads its own document and cannot read another customer content', async () => {
  const nook = await token('9000000001', 'nook123');
  const uploaded = await (
    await fetch(`${baseUrl}/customer/documents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${nook}`, 'content-type': 'application/json' },
      body: JSON.stringify({ documentType: 'cheque', title: 'Cheque', fileName: 'cheque.pdf', contentBase64: PDF_B64 }),
    })
  ).json();
  assert.equal(uploaded.document.contentStored, true);

  const lotus = await token('9000000002', 'lotus123');
  const cross = await fetch(`${baseUrl}/documents/${uploaded.document.id}/content`, {
    headers: { authorization: `Bearer ${lotus}` },
  });
  assert.equal(cross.status, 404);
});

test('stored document bytes survive an API restart', async () => {
  const admin = await token('owner', 'owner123');
  const created = await (
    await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust_cafe_nook',
        title: 'Persisted',
        fileName: 'persist.pdf',
        contentBase64: PDF_B64,
      }),
    })
  ).json();
  const documentId = created.document.id;

  // Allow the debounced state snapshot to flush before restarting.
  await new Promise((resolve) => setTimeout(resolve, 300));
  await stopServer();
  await startServer();

  const admin2 = await token('owner', 'owner123');
  const contentResponse = await fetch(`${baseUrl}/documents/${documentId}/content`, {
    headers: { authorization: `Bearer ${admin2}` },
  });
  assert.equal(contentResponse.status, 200);
  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  assert.ok(bytes.equals(PDF));
});
