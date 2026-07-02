# Recovery R1 Security Batch Gate

Date: 2026-06-21

Batch status: **pass**

Overall R1 status: **in progress - PostgreSQL adapter and cutover rehearsal remain**

## Delivered

- Replaced plaintext password comparison with salted Node `scrypt` hashing and timing-safe verification.
- Added automatic migration of legacy password records to hashes.
- Removed customer authentication records from the generic application snapshot.
- Added normalized `auth_principals` storage to the running SQLite recovery database.
- Replaced UUID bearer tokens with 256-bit random session tokens.
- Store only SHA-256 session-token hashes at rest.
- Invalidate sessions safely on API restart rather than restoring raw bearer tokens.
- Added login throttling and 15-minute blocking after repeated failures.
- Added per-phone/client OTP request throttling and per-challenge verification attempt limits.
- Added Helmet security headers, removed framework identification, limited JSON request size, and added request IDs.
- Closed customer cross-tenant access to branch serviceability and document/invoice downloads.
- Added normalized PostgreSQL migrations for tenants, roles, permissions, staff, customer applications, customers, branches, customer users, sessions, OTP, idempotency, audit, catalog, capacity, orders, documents, production, and delivery.
- Added a PostgreSQL migration runner with transaction wrapping, advisory locking, migration ledger, and SHA-256 checksum mismatch protection.
- Added `db:migrate` and `db:migrate:check` API commands; the check intentionally fails until `DATABASE_URL` is a PostgreSQL connection string.
- Added `db:preflight` to verify required production tables and `pgcrypto` before database cutover.
- Fixed the migration runner to strip SQL-file `BEGIN/COMMIT` wrappers before applying the ledger transaction.
- Added `cutover:rehearsal` to read the local SQLite recovery snapshot and generate a JSON import-readiness report with counts, totals, orphan checks, duplicate ID checks, and legacy auth blockers.
- Added `cutover:repair` to safely backfill missing order branch IDs from each customer's active branch before migration, including default branch creation for historical customer orders that predated branch-wise ordering.
- Extracted authorization rules into a central policy module so role and permission decisions have one source of truth.
- Extracted password and session cryptography into `src/security.ts` with direct unit tests.

## Verification

- API TypeScript build: pass.
- API tests: 23 pass, 0 fail.
- Tests verify password salting, password verification, token entropy, token hashing, login throttling, OTP throttling, anonymous rejection, tenant isolation, honest connector states, and fail-closed production startup.
- Policy tests verify high-risk permissions and customer resource boundaries.
- Live local API health: pass.
- Live owner login after migration: pass with a 43-character high-entropy token.
- Production dependency audit at high severity: zero findings.
- PostgreSQL migration check: blocked as expected until `DATABASE_URL` is Postgres.
- PostgreSQL migration unit checks verify URL guarding, table preflight coverage, and safe transaction wrapping.
- Cutover rehearsal tests verify clean snapshots, orphan blockers, legacy auth blockers, and local-source database guarding.

## Remaining R1 work

1. Obtain/configure a managed PostgreSQL `DATABASE_URL`; the current configured value is a local file path.
2. Build the PostgreSQL repository adapter that uses the normalized schema.
3. Import and reconcile existing SQLite customer/order/operations data into normalized tables.
4. Add staff invitation flows and a full forgot-password reset (depends on R7 email/OTP delivery). Refresh-token rotation, device sessions, explicit revocation, and authenticated password change are now delivered (see addendum).
5. Replace role checks scattered through the monolith with centralized policy modules and test every route.
6. Demonstrate backup, restore, migration rollback, and count/financial reconciliation in staging.

## Session lifecycle addendum (2026-06-29)

Batch status: **pass**

Delivered:

- Persistent device sessions backed by `auth_refresh_sessions`, storing only SHA-256 token hashes at rest, so refresh tokens survive an API restart while short-lived access tokens do not.
- Refresh-token rotation on every `/auth/refresh`, with replay detection: presenting an already-rotated token revokes the whole device session.
- `GET /auth/sessions`, `DELETE /auth/sessions/:id`, and `POST /auth/sessions/revoke-all` for device-session listing and revocation, scoped to the signed-in user.
- Authenticated `POST /auth/password` change that verifies the current password, enforces a minimum length, rejects no-op changes, rehashes, and revokes all other device sessions.
- Logout now revokes the current device session in addition to clearing the access token.
- Audit events `auth_password_changed`, `auth_session_revoked`, and `auth_token_reuse_detected`.

Verification:

- API build: pass. API tests: 30 pass, 0 fail (7 new).
- New tests cover rotation, refresh-token replay revocation, single/all device revocation, refresh survival across a real kill-and-respawn restart, and password-change validation plus session revocation.

## PostgreSQL runtime cutover addendum (2026-07-02, batches A1 + A2)

Batch status: **pass**

Delivered:

- `src/durability.ts`: `PostgresStore` (single pooled, TLS-enabled store) owning
  the state snapshot plus the durable identity tables (`auth_principals`,
  `auth_refresh_sessions`), selected by DATABASE_URL scheme.
- The application-state snapshot (A1) and auth principals + refresh sessions
  (A2) now persist to and load from managed PostgreSQL when DATABASE_URL is
  postgres, so business data and logins survive redeploys on ephemeral-disk
  hosts. Access tokens remain local and expire on restart by design.
- Auth/session/principal persistence functions converted to async with a
  PostgreSQL branch and a preserved SQLite branch (development and tests).
- Production fail-closed guard updated: instead of an unconditional block, it
  now requires a managed PostgreSQL DATABASE_URL (plus CORS and MSG91). A
  missing or SQLite/file DATABASE_URL is still rejected in production.

Verification:

- API build: pass. Tests: 53 pass, 1 skipped (54 total). The skipped test is a
  live PostgreSQL round-trip that runs only when TEST_DATABASE_URL is set.
- Live verification against the Supabase database (via TEST_DATABASE_URL)
  round-trips the snapshot, principal upsert/list, and refresh-session
  insert/rotate/revoke/list-active, then cleans up its fake rows.
- New runtime test asserts production rejects a non-PostgreSQL DATABASE_URL.

Remaining before a production pilot: centralized authorization coverage
(R1.5), backup/restore/rollback demonstration, and the normalized-table
rewrite that replaces the single-row snapshot for multi-instance safety.

## Authorization coverage addendum (2026-07-02, R1.5)

Batch status: **pass**

- Audited every route: all data endpoints carry `authenticate` plus
  `requireAnyRole`/`requirePermission`, and all three checks resolve through
  the central `policy` module (role, permission, and cross-tenant). The only
  unauthenticated routes are the intended public ones (`/`, `/health`, login,
  refresh, OTP request/verify, public application intake, `/storage/status`).
- Added `test/authorization.test.mjs`: a route-level matrix asserting
  anonymous rejection (401), customers blocked from staff routes and staff
  blocked from customer routes (403), role-scoped routes enforcing the right
  role, permission-gated routes rejecting roles that lack the permission
  (with an owner positive control), cross-tenant denial (404) on documents and
  branch serviceability, and positive controls for authorized roles.
- No authorization gaps were found; the R1 centralization now has test cover.

## Gate decision

The R1 secure data and identity cutover is complete on managed PostgreSQL, and
authorization is centralized and test-covered (R1.5). Production can boot with
a managed PostgreSQL DATABASE_URL; full production certification (load,
backup/restore) remains R9.
