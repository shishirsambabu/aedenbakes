import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_POSTGRES_TABLES } from '../dist/postgres-preflight.js';
import { requirePostgresDatabaseUrl, resolvePostgresSsl, stripOuterTransaction } from '../dist/postgres-migrations.js';

test('migration loader strips file-level transaction wrappers before ledger transaction', () => {
  const sql = stripOuterTransaction(`
    BEGIN;

    CREATE TABLE example (id text PRIMARY KEY);

    COMMIT;
  `);

  assert.equal(sql, 'CREATE TABLE example (id text PRIMARY KEY);');
});

test('postgres URL guard rejects local file storage for R1 cutover', () => {
  assert.throws(() => requirePostgresDatabaseUrl('data/api-state.sqlite'), /not PostgreSQL/);
  assert.throws(() => requirePostgresDatabaseUrl(''), /missing/);
  assert.equal(requirePostgresDatabaseUrl('postgres://user:pass@example.com/db'), 'postgres://user:pass@example.com/db');
});

test('postgres SSL is enabled for managed hosts and disabled locally', () => {
  assert.equal(resolvePostgresSsl('postgres://postgres:pass@localhost:5432/db'), false);
  assert.equal(resolvePostgresSsl('postgres://postgres:pass@127.0.0.1:5432/db'), false);
  assert.deepEqual(
    resolvePostgresSsl('postgres://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'),
    { rejectUnauthorized: false },
  );
});

test('postgres preflight covers the normalized production schema', () => {
  assert.ok(REQUIRED_POSTGRES_TABLES.includes('customer_applications'));
  assert.ok(REQUIRED_POSTGRES_TABLES.includes('orders'));
  assert.ok(REQUIRED_POSTGRES_TABLES.includes('documents'));
  assert.ok(REQUIRED_POSTGRES_TABLES.includes('delivery_events'));
});
