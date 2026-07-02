import pg from 'pg';
import { resolvePostgresSsl } from './postgres-migrations.js';

// Durable store for the application-state snapshot. Two backends exist: the
// local SQLite file (used for development and tests) is handled inline in
// server.ts, and this managed-PostgreSQL store is used when DATABASE_URL is a
// postgres:// connection string so the snapshot survives redeploys on hosts
// with ephemeral disks (e.g. Render).
export interface SnapshotStore {
  init(): Promise<void>;
  loadSnapshot(): Promise<string | null>;
  saveSnapshot(json: string): Promise<void>;
  close(): Promise<void>;
}

export function isPostgresConnectionString(databaseUrl: string) {
  return /^postgres(ql)?:\/\//iu.test(databaseUrl.trim());
}

export class PostgresSnapshotStore implements SnapshotStore {
  private readonly pool: pg.Pool;
  private readonly tableName: string;

  constructor(connectionString: string, tableName = 'app_state') {
    // Table name is not user-controlled (fixed by the app), but validate it
    // anyway so it can never be an injection vector.
    if (!/^[a-z_][a-z0-9_]*$/iu.test(tableName)) {
      throw new Error(`Invalid snapshot table name: ${tableName}`);
    }
    this.tableName = tableName;
    this.pool = new pg.Pool({
      connectionString,
      ssl: resolvePostgresSsl(connectionString),
      max: 4,
    });
  }

  async init() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id integer PRIMARY KEY,
        snapshot text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
  }

  async loadSnapshot() {
    const result = await this.pool.query<{ snapshot: string }>(
      `SELECT snapshot FROM ${this.tableName} WHERE id = 1`,
    );
    return result.rows[0]?.snapshot ?? null;
  }

  async saveSnapshot(json: string) {
    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, snapshot, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`,
      [json],
    );
  }

  async close() {
    await this.pool.end();
  }
}
