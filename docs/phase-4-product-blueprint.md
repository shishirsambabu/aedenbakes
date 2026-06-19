# Phase 4 Product Blueprint

## Purpose

Phase 4 hardens the platform into a real production backend.

Phase 3 proved the workflows.
Phase 4 replaces the remaining demo-grade infrastructure with production-grade storage, queues, and observability.

## Operating Rules

- The database becomes the source of truth.
- File-backed API state must be removed.
- Uploads must either be truly stored or clearly rejected.
- Async work must be durable and retry-safe.
- Secrets must stay out of the repo.
- Every integration must fail safely and visibly.

## Exact Modules

| Module | Responsibility | Primary Data Owned | Notes |
| --- | --- | --- | --- |
| Database Core | Persist all orders, customers, batches, support, and commercial data | all core entities | Replace JSON file state with a real DB |
| Auth and Sessions | Secure login, roles, sessions, and customer portal access | sessions, auth users | Add durable session storage |
| Object Storage | Store KYC documents, receipts, proof images, and exports | upload records, file metadata | Wire R2 or equivalent provider |
| Queue Worker | Process notifications, sync jobs, retries, and report generation | job queue records | Background work must survive restarts |
| Sync Adapter Layer | Integrate Vasy ERP and future providers cleanly | sync jobs, payloads, contracts | Keep vendor logic isolated |
| Observability | Log, trace, and monitor background and API failures | log events, metrics | Make failures visible to operators |
| Migration Tools | Move data from local demo state to production storage | migration checkpoints | Supports safe rollout and rollback |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Control everything | Nothing hidden |
| `manager` | Approve operational and commercial work | Cannot bypass audit rules |
| `accounts` | Review risk, health, receivables, and reports | Cannot edit source of truth data directly |
| `support` | Handle cases and customer follow-up | Cannot alter financial history |
| `production` | Use production data safely | Cannot change storage architecture |
| `delivery` | Use route and POD data safely | Cannot change storage architecture |
| `customer` | Use self-service and uploads | Cannot touch core system data |

## State Machines

### Storage Readiness
`disabled -> configured -> live -> degraded`

### Queue Job
`queued -> processing -> succeeded`

Failure branches:
- `failed`
- `retrying`

### Migration Run
`planned -> running -> verified -> complete`

Failure branches:
- `blocked`
- `rollback_needed`

## Database Entities

| Entity | Key Fields | Invariants |
| --- | --- | --- |
| `users` | `id`, `role`, `username`, `password_hash`, `active` | login data must be secure |
| `sessions` | `id`, `user_id`, `expires_at`, `revoked_at` | session records must expire cleanly |
| `files` | `id`, `customer_id`, `bucket`, `key`, `status`, `created_at` | upload records must match the stored object |
| `jobs` | `id`, `job_type`, `status`, `payload_json`, `attempt_count` | retries must be idempotent |
| `migrations` | `id`, `name`, `status`, `created_at`, `completed_at` | migration steps must be auditable |
| `logs` | `id`, `level`, `scope`, `message`, `created_at` | operational errors must be inspectable |

## Batch Roadmap

### Batch 4.1: Database Migration
Deliver:
- schema design
- persistent storage layer
- seed import from current JSON state

Exit criteria:
- API reads and writes from a real database
- current demo state can be imported
- no required workflow depends on the JSON file

### Batch 4.2: Auth and Session Hardening
Deliver:
- durable sessions
- secret handling
- session revocation

Exit criteria:
- login survives restarts
- sessions can be invalidated
- secrets are no longer demo-only

### Batch 4.3: Object Storage
Deliver:
- R2 or equivalent upload flow
- KYC document storage
- receipt and proof image support

Exit criteria:
- uploads are stored externally
- demo fallback is removed or isolated
- file metadata is traceable

### Batch 4.4: Queue and Worker
Deliver:
- background jobs
- retry handling
- notification delivery
- ERP export jobs

Exit criteria:
- async work survives process restarts
- retries are safe
- failures are visible

### Batch 4.5: Observability and Rollout Safety
Deliver:
- logs
- metrics
- alerts
- migration checkpointing

Exit criteria:
- operators can see failures quickly
- rollout can be reversed safely
- the platform behaves like a production system

## Phase 4 Boundaries

Not in Phase 4:
- new storefront features
- new commercial workflows
- advanced forecasting
- warehouse planning

Phase 4 should make the current product trustworthy to run, not larger to sell.

