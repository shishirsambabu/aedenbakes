import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { isPostgresConnectionString, PostgresStore } from '../dist/durability.js';

test('isPostgresConnectionString recognizes postgres URLs only', () => {
  assert.equal(isPostgresConnectionString('postgres://u:p@h:5432/db'), true);
  assert.equal(isPostgresConnectionString('postgresql://u:p@h:5432/db'), true);
  assert.equal(isPostgresConnectionString('  postgres://h/db  '), true);
  assert.equal(isPostgresConnectionString('./data/aeden-bakes.sqlite'), false);
  assert.equal(isPostgresConnectionString('file:local.sqlite'), false);
  assert.equal(isPostgresConnectionString(''), false);
});

test('PostgresStore rejects an unsafe table name before connecting', () => {
  assert.throws(() => new PostgresStore('postgres://u:p@h:5432/db', 'bad; drop table'), /Invalid snapshot table name/);
});

// Live round-trip: only runs when a throwaway PostgreSQL URL is supplied so the
// default suite and CI stay green without a database. Inserts only clearly
// fake rows and removes them (and its throwaway snapshot table) afterward.
const liveUrl = process.env.TEST_DATABASE_URL;
test('PostgresStore round-trips snapshot, principals, and refresh sessions live', { skip: !liveUrl }, async () => {
  const store = new PostgresStore(liveUrl, 'app_state_test_roundtrip');
  const stamp = Date.now();
  const principalId = `test_principal_${stamp}`;
  const refreshId = `test_rsess_${stamp}`;
  try {
    await store.init();

    // Snapshot
    const payload = JSON.stringify({ ok: true, at: stamp });
    await store.saveSnapshot(payload);
    assert.equal(await store.loadSnapshot(), payload);
    await store.saveSnapshot(JSON.stringify({ ok: false }));
    assert.equal(await store.loadSnapshot(), JSON.stringify({ ok: false }));

    // Principals (upsert + list)
    const nowIso = new Date().toISOString();
    const principal = {
      id: principalId,
      username: `test_${stamp}`,
      display_name: 'Test',
      role: 'owner',
      password_hash: 'scrypt$aa$bb',
      customer_id: null,
      active: 1,
      profile_json: '{}',
      created_at: nowIso,
      updated_at: nowIso,
    };
    await store.upsertPrincipal(principal);
    await store.upsertPrincipal({ ...principal, display_name: 'Test Updated' });
    const principals = await store.listPrincipals();
    assert.equal(principals.find((p) => p.id === principalId)?.display_name, 'Test Updated');

    // Refresh sessions (insert, rotate, revoke, list-active)
    const future = new Date(Date.now() + 3600_000).toISOString();
    await store.insertRefreshSession({
      id: refreshId,
      user_id: principalId,
      refresh_token_hash: 'h1',
      previous_token_hash: null,
      user_json: '{}',
      device_label: 'test',
      user_agent: null,
      ip: null,
      created_at: nowIso,
      last_used_at: nowIso,
      expires_at: future,
      revoked_at: null,
    });
    assert.equal((await store.getRefreshSession(refreshId))?.refresh_token_hash, 'h1');
    await store.rotateRefreshSession(refreshId, 'h1', 'h2', new Date().toISOString(), 'agent', '1.2.3.4');
    assert.equal((await store.getRefreshSession(refreshId))?.refresh_token_hash, 'h2');
    assert.ok((await store.listActiveRefreshSessions(principalId)).some((r) => r.id === refreshId));
    assert.equal(await store.markRefreshSessionRevoked(refreshId, new Date().toISOString()), 1);
    assert.equal(await store.markRefreshSessionRevoked(refreshId, new Date().toISOString()), 0);
    assert.equal((await store.listActiveRefreshSessions(principalId)).some((r) => r.id === refreshId), false);
  } finally {
    await store.close();
  }

  // Remove the fake rows and throwaway snapshot table so the database stays clean.
  const client = new pg.Client({ connectionString: liveUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('DELETE FROM auth_refresh_sessions WHERE id = $1', [refreshId]);
  await client.query('DELETE FROM auth_principals WHERE id = $1', [principalId]);
  await client.query('DROP TABLE IF EXISTS app_state_test_roundtrip');
  await client.end();
});
