import 'dotenv/config';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const { Client } = pg;

type Migration = {
  version: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
};

type AppliedMigration = {
  version: string;
  checksum_sha256: string;
};

type MigrationMode = 'apply' | 'check';

export async function loadPostgresMigrations(migrationsDir = join(process.cwd(), 'migrations', 'postgres')) {
  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/u.test(file))
    .sort((a, b) => a.localeCompare(b));

  const migrations: Migration[] = [];
  for (const filename of files) {
    const sql = stripOuterTransaction(await readFile(join(migrationsDir, filename), 'utf8'));
    const [version] = filename.split('_', 1);
    migrations.push({
      version,
      name: filename.replace(/^\d+_/u, '').replace(/\.sql$/u, ''),
      filename,
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    });
  }

  return migrations;
}

export function stripOuterTransaction(sql: string) {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/iu, '')
    .replace(/\s*COMMIT\s*;\s*$/iu, '')
    .trim();
}

// Managed Postgres providers (Supabase, RDS, etc.) require TLS. Local
// development databases do not. We keep remote connections encrypted without
// verifying the CA chain so the recovery cutover does not need provider CA
// bundles; production can tighten this once a CA is pinned.
export function resolvePostgresSsl(connectionString: string): false | { rejectUnauthorized: boolean } {
  try {
    const host = new URL(connectionString).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }
  } catch {
    // Fall through to the encrypted default for anything URL-like.
  }
  return { rejectUnauthorized: false };
}

export function requirePostgresDatabaseUrl(databaseUrl = process.env.DATABASE_URL?.trim() ?? '') {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing. Add a managed PostgreSQL connection string before running migrations.');
  }

  if (!/^postgres(ql)?:\/\//iu.test(databaseUrl)) {
    throw new Error('DATABASE_URL is not PostgreSQL. Current local SQLite/file storage cannot pass the R1 database gate.');
  }

  return databaseUrl;
}

export async function runPostgresMigrations(options: { mode?: MigrationMode; databaseUrl?: string } = {}) {
  const mode = options.mode ?? 'apply';
  const databaseUrl = requirePostgresDatabaseUrl(options.databaseUrl);
  const migrations = await loadPostgresMigrations();
  const client = new Client({ connectionString: databaseUrl, ssl: resolvePostgresSsl(databaseUrl) });

  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('aeden_bakes_schema_migrations'))");
    await ensureMigrationLedger(client);
    const applied = await getAppliedMigrations(client);
    const pending: Migration[] = [];

    for (const migration of migrations) {
      const appliedMigration = applied.get(migration.version);
      if (appliedMigration) {
        if (appliedMigration.checksum_sha256 !== migration.checksum) {
          throw new Error(
            `Migration checksum mismatch for ${migration.filename}. Do not edit applied migrations; create a new migration instead.`,
          );
        }
        continue;
      }

      pending.push(migration);
    }

    if (mode === 'check') {
      if (pending.length > 0) {
        throw new Error(`Pending PostgreSQL migrations: ${pending.map((migration) => migration.filename).join(', ')}`);
      }
      return { applied: applied.size, pending: 0 };
    }

    for (const migration of pending) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          `
          INSERT INTO aeden_schema_migrations (version, name, checksum_sha256)
          VALUES ($1, $2, $3)
          `,
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return { applied: applied.size + pending.length, pending: 0 };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('aeden_bakes_schema_migrations'))").catch(() => undefined);
    await client.end();
  }
}

async function ensureMigrationLedger(client: pg.Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS aeden_schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client: pg.Client) {
  const result = await client.query<AppliedMigration>(
    'SELECT version, checksum_sha256 FROM aeden_schema_migrations ORDER BY version',
  );
  return new Map(result.rows.map((row) => [row.version, row]));
}

function isDirectRun() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isDirectRun()) {
  const mode: MigrationMode = process.argv.includes('--check') ? 'check' : 'apply';
  runPostgresMigrations({ mode })
    .then((result) => {
      console.log(`PostgreSQL migration ${mode} complete. Applied: ${result.applied}. Pending: ${result.pending}.`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
