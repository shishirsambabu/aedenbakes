import assert from 'node:assert/strict';
import test from 'node:test';
import { isPostgresConnectionString, PostgresSnapshotStore } from '../dist/durability.js';

test('isPostgresConnectionString recognizes postgres URLs only', () => {
  assert.equal(isPostgresConnectionString('postgres://u:p@h:5432/db'), true);
  assert.equal(isPostgresConnectionString('postgresql://u:p@h:5432/db'), true);
  assert.equal(isPostgresConnectionString('  postgres://h/db  '), true);
  assert.equal(isPostgresConnectionString('./data/aeden-bakes.sqlite'), false);
  assert.equal(isPostgresConnectionString('file:local.sqlite'), false);
  assert.equal(isPostgresConnectionString(''), false);
});

test('PostgresSnapshotStore rejects an unsafe table name before connecting', () => {
  assert.throws(() => new PostgresSnapshotStore('postgres://u:p@h:5432/db', 'bad; drop table'), /Invalid snapshot table name/);
});

// Live round-trip: only runs when a throwaway PostgreSQL URL is supplied so the
// default suite and CI stay green without a database.
const liveUrl = process.env.TEST_DATABASE_URL;
test('PostgresSnapshotStore round-trips a snapshot against a live database', { skip: !liveUrl }, async () => {
  const store = new PostgresSnapshotStore(liveUrl, 'app_state_test_roundtrip');
  try {
    await store.init();
    const payload = JSON.stringify({ ok: true, at: Date.now() });
    await store.saveSnapshot(payload);
    assert.equal(await store.loadSnapshot(), payload);
    const updated = JSON.stringify({ ok: false });
    await store.saveSnapshot(updated);
    assert.equal(await store.loadSnapshot(), updated);
  } finally {
    await store.close();
  }
});
