import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { requirePostgresDatabaseUrl, runPostgresMigrations } from './postgres-migrations.js';

const { Client } = pg;

export const REQUIRED_POSTGRES_TABLES = [
  'aeden_schema_migrations',
  'tenants',
  'roles',
  'permissions',
  'role_permissions',
  'staff_users',
  'staff_user_roles',
  'customer_applications',
  'customer_accounts',
  'customer_branches',
  'customer_users',
  'customer_user_branches',
  'auth_sessions',
  'otp_challenges',
  'idempotency_keys',
  'audit_events',
  'products',
  'branch_product_terms',
  'delivery_slots',
  'product_day_capacity',
  'orders',
  'order_lines',
  'order_approvals',
  'documents',
  'production_batches',
  'production_batch_lines',
  'delivery_manifests',
  'delivery_stops',
  'delivery_events',
] as const;

type TablePresence = {
  table_name: string;
};

type PreflightCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export async function runPostgresPreflight(databaseUrl = process.env.DATABASE_URL?.trim() ?? '') {
  const connectionString = requirePostgresDatabaseUrl(databaseUrl);
  const checks: PreflightCheck[] = [];

  await runPostgresMigrations({ mode: 'check', databaseUrl: connectionString });
  checks.push({ name: 'migrations', ok: true, detail: 'All migration files are applied with matching checksums.' });

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tableResult = await client.query<TablePresence>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
      `,
      [[...REQUIRED_POSTGRES_TABLES]],
    );
    const foundTables = new Set(tableResult.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_POSTGRES_TABLES.filter((table) => !foundTables.has(table));
    checks.push({
      name: 'required_tables',
      ok: missingTables.length === 0,
      detail: missingTables.length === 0 ? 'All required tables exist.' : `Missing tables: ${missingTables.join(', ')}`,
    });

    const pgcryptoResult = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS exists",
    );
    const hasPgcrypto = pgcryptoResult.rows[0]?.exists === true;
    checks.push({
      name: 'pgcrypto',
      ok: hasPgcrypto,
      detail: hasPgcrypto ? 'pgcrypto extension is enabled.' : 'pgcrypto extension is missing.',
    });
  } finally {
    await client.end();
  }

  const failed = checks.filter((check) => !check.ok);
  return {
    ok: failed.length === 0,
    checks,
  };
}

function isDirectRun() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isDirectRun()) {
  runPostgresPreflight()
    .then((result) => {
      for (const check of result.checks) {
        console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
