import pg from 'pg';
import { resolvePostgresSsl } from './postgres-migrations.js';

// Durable stores for state that must survive redeploys on ephemeral-disk hosts
// (e.g. Render). When DATABASE_URL is a postgres:// connection string the app
// uses PostgresStore; otherwise the local SQLite file remains the store
// (handled inline in server.ts for development and tests).

export interface SnapshotStore {
  init(): Promise<void>;
  loadSnapshot(): Promise<string | null>;
  saveSnapshot(json: string): Promise<void>;
  close(): Promise<void>;
}

export type PrincipalRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  password_hash: string;
  customer_id: string | null;
  active: number;
  profile_json: string;
  created_at: string;
  updated_at: string;
};

export type RefreshSessionRow = {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  previous_token_hash: string | null;
  user_json: string;
  device_label: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export interface AuthStore {
  listPrincipals(): Promise<PrincipalRow[]>;
  upsertPrincipal(principal: PrincipalRow): Promise<void>;
  getRefreshSession(id: string): Promise<RefreshSessionRow | null>;
  insertRefreshSession(row: RefreshSessionRow): Promise<void>;
  rotateRefreshSession(
    id: string,
    previousHash: string,
    newHash: string,
    lastUsedAt: string,
    userAgent: string | null,
    ip: string | null,
  ): Promise<void>;
  markRefreshSessionRevoked(id: string, revokedAt: string): Promise<number>;
  listActiveRefreshSessions(userId: string): Promise<RefreshSessionRow[]>;
}

export function isPostgresConnectionString(databaseUrl: string) {
  return /^postgres(ql)?:\/\//iu.test(databaseUrl.trim());
}

// Single managed-PostgreSQL store owning the state snapshot plus the durable
// identity tables (principals and refresh sessions). One shared pool.
export class PostgresStore implements SnapshotStore, AuthStore {
  private readonly pool: pg.Pool;
  private readonly snapshotTable: string;

  constructor(connectionString: string, snapshotTable = 'app_state') {
    if (!/^[a-z_][a-z0-9_]*$/iu.test(snapshotTable)) {
      throw new Error(`Invalid snapshot table name: ${snapshotTable}`);
    }
    this.snapshotTable = snapshotTable;
    this.pool = new pg.Pool({
      connectionString,
      ssl: resolvePostgresSsl(connectionString),
      max: 4,
    });
  }

  async init() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.snapshotTable} (
        id integer PRIMARY KEY,
        snapshot text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS auth_principals (
        id text PRIMARY KEY,
        username text NOT NULL UNIQUE,
        display_name text NOT NULL,
        role text NOT NULL,
        password_hash text NOT NULL,
        customer_id text,
        active integer NOT NULL DEFAULT 1,
        profile_json text NOT NULL,
        created_at text NOT NULL,
        updated_at text NOT NULL
      )`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        refresh_token_hash text NOT NULL,
        previous_token_hash text,
        user_json text NOT NULL,
        device_label text NOT NULL,
        user_agent text,
        ip text,
        created_at text NOT NULL,
        last_used_at text NOT NULL,
        expires_at text NOT NULL,
        revoked_at text
      )`,
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS auth_refresh_sessions_user_idx ON auth_refresh_sessions (user_id)',
    );
  }

  async loadSnapshot() {
    const result = await this.pool.query<{ snapshot: string }>(
      `SELECT snapshot FROM ${this.snapshotTable} WHERE id = 1`,
    );
    return result.rows[0]?.snapshot ?? null;
  }

  async saveSnapshot(json: string) {
    await this.pool.query(
      `INSERT INTO ${this.snapshotTable} (id, snapshot, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`,
      [json],
    );
  }

  async listPrincipals() {
    const result = await this.pool.query<PrincipalRow>(
      'SELECT * FROM auth_principals ORDER BY created_at',
    );
    return result.rows;
  }

  async upsertPrincipal(principal: PrincipalRow) {
    await this.pool.query(
      `INSERT INTO auth_principals (
        id, username, display_name, role, password_hash, customer_id, active, profile_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        customer_id = EXCLUDED.customer_id,
        active = EXCLUDED.active,
        profile_json = EXCLUDED.profile_json,
        updated_at = EXCLUDED.updated_at`,
      [
        principal.id,
        principal.username,
        principal.display_name,
        principal.role,
        principal.password_hash,
        principal.customer_id,
        principal.active,
        principal.profile_json,
        principal.created_at,
        principal.updated_at,
      ],
    );
  }

  async getRefreshSession(id: string) {
    const result = await this.pool.query<RefreshSessionRow>(
      'SELECT * FROM auth_refresh_sessions WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async insertRefreshSession(row: RefreshSessionRow) {
    await this.pool.query(
      `INSERT INTO auth_refresh_sessions (
        id, user_id, refresh_token_hash, previous_token_hash, user_json,
        device_label, user_agent, ip, created_at, last_used_at, expires_at, revoked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        row.id,
        row.user_id,
        row.refresh_token_hash,
        row.previous_token_hash,
        row.user_json,
        row.device_label,
        row.user_agent,
        row.ip,
        row.created_at,
        row.last_used_at,
        row.expires_at,
        row.revoked_at,
      ],
    );
  }

  async rotateRefreshSession(
    id: string,
    previousHash: string,
    newHash: string,
    lastUsedAt: string,
    userAgent: string | null,
    ip: string | null,
  ) {
    await this.pool.query(
      `UPDATE auth_refresh_sessions
       SET previous_token_hash = $1, refresh_token_hash = $2, last_used_at = $3, user_agent = $4, ip = $5
       WHERE id = $6`,
      [previousHash, newHash, lastUsedAt, userAgent, ip, id],
    );
  }

  async markRefreshSessionRevoked(id: string, revokedAt: string) {
    const result = await this.pool.query(
      'UPDATE auth_refresh_sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL',
      [revokedAt, id],
    );
    return result.rowCount ?? 0;
  }

  async listActiveRefreshSessions(userId: string) {
    const result = await this.pool.query<RefreshSessionRow>(
      'SELECT * FROM auth_refresh_sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_used_at DESC',
      [userId],
    );
    return result.rows;
  }

  async close() {
    await this.pool.end();
  }
}
