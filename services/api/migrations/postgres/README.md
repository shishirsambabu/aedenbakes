# PostgreSQL Migration Foundation

These migrations define the normalized target schema for Recovery R1. They are intentionally not executed by the current SQLite prototype.

Execution order:

1. `001_identity_core.sql`
2. `002_commerce_operations.sql`

Run the ledger-backed migration command only against a dedicated staging/production
PostgreSQL database:

```powershell
npm run db:migrate
npm run db:migrate:check
npm run db:preflight
```

The runner stores applied migration versions and SHA-256 checksums in
`aeden_schema_migrations`. If an already-applied migration file is edited later,
the command fails loudly; create a new migration instead.

`db:preflight` verifies that every required production table exists and that the
PostgreSQL `pgcrypto` extension is enabled. It is the cutover smoke test to run
before pointing any app at a managed database.

Before production use, the PostgreSQL adapter must:

- create one Aeden Bakes tenant and explicit seed roles/permissions;
- import customers without plaintext passwords or raw sessions;
- preserve source IDs through an external-ID mapping table;
- reconcile counts and financial totals before cutover;
- support rollback from a verified backup.

The API remains fail-closed in production until that adapter and the R1 migration tests are complete.
