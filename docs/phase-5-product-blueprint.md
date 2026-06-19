# Phase 5 Product Blueprint

## Purpose

Phase 5 moves Aeden Bakes from a working internal system to a controlled production rollout.

Phase 4 made the backend durable.
Phase 5 makes the deployment durable:

- remote hosting
- live object storage
- secure environment management
- backups and restore drills
- observability and alerting
- rollout safety and rollback
- production access controls

Phase 5 should reduce operational risk, not add new product surface area.

## Operating Rules

- Production data must live in a remote, backed-up environment.
- Demo data and production data must be clearly separated.
- Cloud object storage must be either live or explicitly disabled.
- Every secret must come from environment configuration, never from source code.
- Deployments must be repeatable and reversible.
- Monitoring must tell us when the system is failing before customers tell us.
- Rollback must be a normal operational action, not an emergency invention.

## Exact Modules

| Module | Responsibility | Primary Data Owned | Notes |
| --- | --- | --- | --- |
| Production Hosting | Run the API and web apps in a managed environment | deployment config, runtime vars | Stable prod URLs and environments |
| Managed Database | Store operational data remotely with backups | all core app entities | Phase 4 SQLite becomes migration source only |
| Object Storage Live | Store KYC documents, images, and exports in cloud storage | file metadata, object keys | R2 becomes real here |
| Secret Management | Keep keys and credentials out of code | env bindings, deployment secrets | Must support rotation |
| Monitoring and Alerts | Detect downtime, failures, and queue backlogs | alert rules, metrics, logs | Drives operator visibility |
| Backup and Restore | Protect against accidental loss or bad deploys | backup snapshots, restore points | Must be tested, not assumed |
| Release Orchestrator | Manage staged rollout and rollback | release records, version tags | Supports safe promotion |
| Production Access Control | Limit who can touch live systems | access grants, audit trail | Different from demo credentials |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Approve rollout, inspect prod data, authorize rollback | Nothing hidden from owner |
| `manager` | Review production readiness, approve routine ops | Cannot bypass deployment gates |
| `accounts` | Review production data and reports | Cannot change infrastructure secrets |
| `support` | Handle live customer issues | Cannot deploy code |
| `production` | Operate production workflow | Cannot manage cloud secrets |
| `delivery` | Operate live route and POD workflow | Cannot manage cloud secrets |
| `customer` | Use live onboarding and ordering | Cannot see admin deployment controls |

## State Machines

### Deployment State
`planned -> deploying -> healthy -> degraded -> rollback`

Rules:
- `planned` means release is prepared but not promoted.
- `deploying` means rollout is in progress.
- `healthy` means the release passed checks and is serving traffic.
- `degraded` means something works but key checks are failing.
- `rollback` is a deliberate recovery path.

### Storage State
`demo -> configured -> live -> blocked`

Rules:
- `demo` means local or placeholder behavior is still active.
- `configured` means credentials exist but validation is still running.
- `live` means object storage is functional and verified.
- `blocked` means storage should not be used until corrected.

### Backup State
`missing -> scheduled -> verified -> restorable`

Rules:
- Backups must be scheduled before live rollout.
- Verification must confirm the backup can actually be restored.
- `restorable` means a test restore succeeded.

### Alert State
`open -> acknowledged -> resolved`

Rules:
- Alerts must not disappear silently.
- Acknowledgement must be visible.
- Resolved alerts remain in history.

## Database Entities

| Entity | Key Fields | Invariants |
| --- | --- | --- |
| `deployments` | `id`, `env`, `version`, `status`, `started_at`, `completed_at` | each release must be traceable |
| `deployment_checks` | `id`, `deployment_id`, `check_type`, `status`, `details_json` | checks must be repeatable |
| `backups` | `id`, `env`, `storage_ref`, `status`, `created_at` | backups must be linked to a live env |
| `restore_tests` | `id`, `backup_id`, `status`, `tested_at`, `notes` | restore tests must be logged |
| `storage_objects` | `id`, `customer_id`, `bucket`, `key`, `content_type`, `status` | object metadata must match storage state |
| `secrets_audit` | `id`, `secret_name`, `rotated_at`, `rotated_by` | secret rotation must be auditable |
| `monitoring_events` | `id`, `severity`, `scope`, `message`, `created_at`, `resolved_at` | incidents must have a trail |
| `production_access` | `id`, `role`, `granted_by`, `created_at`, `revoked_at` | live access must be controlled |

## Batch Roadmap

### Batch 5.1: Production Environment Setup
Deliver:
- production API hosting
- production web deployment
- environment separation
- runtime secret loading

Exit criteria:
- prod and demo environments are distinct
- no secrets are committed to code
- the production runtime boots cleanly

### Batch 5.2: Managed Database Migration
Deliver:
- remote database provisioning
- data import from SQLite
- schema migration path
- backup baseline

Exit criteria:
- production data lives remotely
- SQLite remains only as a local source/migration aid
- restore path is defined

### Batch 5.3: Live Object Storage
Deliver:
- R2 provisioning
- upload handling
- metadata persistence
- demo fallback removal or isolation

Exit criteria:
- document uploads are truly stored
- uploads are traceable
- storage failure is visible

### Batch 5.4: Monitoring and Alerts
Deliver:
- uptime checks
- error logging
- alert rules
- incident visibility

Exit criteria:
- failures are visible before escalation
- operator alerts are actionable
- alert history is preserved

### Batch 5.5: Backup and Rollback Safety
Deliver:
- scheduled backups
- restore drill
- deployment rollback procedure
- release checklist

Exit criteria:
- a restore test has been passed
- rollback can be executed safely
- the rollout process is documented

### Batch 5.6: Production Access and Go-Live
Deliver:
- prod access controls
- role review
- go-live checklist
- handoff notes

Exit criteria:
- live access is limited to the right people
- the system is ready for customer use
- rollout status is visible and controlled

## Phase 5 Boundaries

Not in Phase 5:
- new customer features
- new production workflows
- new delivery workflows
- new analytics models

Phase 5 should make the current product safe to run in the real world.

