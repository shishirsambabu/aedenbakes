# Phase 2 Product Blueprint

## Purpose
Phase 2 hardens the bakery operations loop around the confirmed order base from Phase 1.

It adds the operational controls that matter after orders exist:

- production locking and line control
- delivery manifest execution
- proof of delivery and exception capture
- returns and partial fulfillment handling
- admin edits with approval gates
- ERP sync traceability and recovery

Phase 2 is not about adding more storefront polish. It is about making the bakery workflow deterministic, auditable, and hard to misuse.

## Operating Rules

- The production batch is the operational unit of truth.
- Delivery actions must always map back to a real order and route stop.
- No delivery event may silently overwrite prior state.
- Returns and failed drops are append-only business events, not destructive edits.
- Risky admin actions must be visible and, where needed, approved.
- ERP sync must never become the source of truth.
- Offline driver actions must replay exactly once.
- Every override must leave an audit trail.

## Exact Modules

| Module | Responsibility | Primary Data Owned | Notes |
| --- | --- | --- | --- |
| Production Batch Manager | Build, lock, unlock, and complete production batches | `production_batches`, `production_batch_lines` | The batch is generated from confirmed orders and frozen when locked |
| Batch Shortage Review | Surface underfilled, short, or substituted lines | `production_batch_lines`, `batch_exceptions` | Lets production see where the plan is weak before baking starts |
| Delivery Manifest Builder | Convert confirmed dispatchable orders into route manifests | `delivery_manifests`, `delivery_manifest_stops` | Manifest should be route- and slot-aware |
| Delivery Execution | Capture out-for-delivery, delivered, failed, and partial results | `delivery_events`, `delivery_manifest_stops`, `orders` | Must support offline queueing and replay |
| Returns Desk | Capture returns, refusals, damage, and short delivery recovery | `returns`, `return_items`, `credit_notes` | Handles commercial fallout from delivery exceptions |
| Admin Order Control | Edit order quantities, swap slots, cancel with reason, and override cutoffs | `order_edits`, `override_requests` | High-risk actions go through approval where needed |
| Approval Inbox | Review and decide risky operational changes | `approvals` | Central gate for edits, returns, and overrides |
| ERP Sync Trace | Preview, queue, retry, and reconcile Vasy exports | `erp_sync_jobs`, `erp_sync_attempts`, `erp_contract_snapshots` | Keeps sync transparent without mutating source truth |
| Audit Ledger | Record every important operational and financial mutation | `audit_events` | Every phase-2 action must be explainable after the fact |
| Operational Reports | Show batch status, returns, exceptions, and route performance | `reports`, derived views | For super admin and operations leads |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Approve anything, override limits, inspect all data, push ERP exports | Nothing is hidden from owner visibility |
| `manager` | Edit orders, manage batches, approve exceptions, review returns, inspect ERP sync | Cannot silently rewrite audit history |
| `production` | Lock and run batches, mark shortages, record production completion | Cannot edit customer credit or ERP source data |
| `delivery` | Execute routes, capture POD, mark failed deliveries, capture returns | Cannot change batch quantities or pricing |
| `accounts` | Review returns, credit notes, receivables, and risk states | Cannot alter delivery history |
| `support` | View customer history, identify blocked orders, help resolve exceptions | Cannot approve high-risk operational changes |
| `customer` | View own orders, track fulfillment, see serviceability | Cannot edit confirmed operational records |

## State Machines

### Production Batch State
`draft -> locked -> in_progress -> completed`

Rules:
- `draft` is editable.
- `locked` freezes quantities for production.
- `in_progress` means the team has started execution.
- `completed` is terminal.
- `unlock` is only allowed from `locked` and only for privileged roles.

### Order Fulfillment State
`confirmed -> locked -> in_production -> out_for_delivery -> delivered`

Exception states:
- `partial_delivery`
- `failed_delivery`
- `cancelled`

Rules:
- `locked` means the order is committed to production or dispatch.
- `in_production` means the item is in the bakery queue.
- `out_for_delivery` means it has left the bakery.
- `delivered` is the normal terminal state.
- `partial_delivery` and `failed_delivery` are terminal exception outcomes unless a return or correction flow continues.

### Delivery Event State
`queued -> accepted -> applied`

Failure branches:
- `rejected`
- `duplicate`

Rules:
- Every driver action starts queued if offline.
- The server must accept or reject the replay exactly once.
- Duplicates must not create a second business effect.

### Return State
`requested -> pending_review -> approved -> captured`

Rejection branch:
- `rejected`

Rules:
- Return capture requires a reason.
- High-value or high-impact returns can require approval.
- Captured returns must update customer/account reporting, not delete the order history.

### Approval State
`pending -> approved -> applied`

Rejection branch:
- `rejected`

Rules:
- Approval records are append-only.
- Applying an approval must update the target object and write an audit event.

### ERP Sync State
`idle -> queued -> exporting -> healthy`

Failure branches:
- `degraded`
- `down`
- `retrying`

Rules:
- ERP sync is a replica contract, not the source of truth.
- Failed attempts must remain visible.
- Retrying must not duplicate side effects.

## Database Entities

| Entity | Key Fields | Invariants |
| --- | --- | --- |
| `production_batches` | `id`, `service_date`, `status`, `created_at`, `locked_at`, `completed_at`, `created_by` | One batch can be the active production lock for a service date |
| `production_batch_lines` | `id`, `batch_id`, `product_id`, `slot_id`, `planned_quantity`, `short_quantity`, `actual_quantity` | Totals must reconcile to the batch and source orders |
| `delivery_manifests` | `id`, `service_date`, `route_code`, `status`, `generated_at`, `locked_at` | Manifests should be deterministic from the dispatch set |
| `delivery_manifest_stops` | `id`, `manifest_id`, `order_id`, `sequence`, `status`, `attempt_count` | Sequence must be stable after lock |
| `delivery_events` | `id`, `event_key`, `order_id`, `manifest_id`, `stop_id`, `event_type`, `payload_json`, `captured_at`, `synced_at` | `event_key` must dedupe offline replay |
| `returns` | `id`, `order_id`, `customer_id`, `status`, `reason`, `created_at`, `approved_at`, `captured_at` | A return is traceable to one order and one reason |
| `return_items` | `id`, `return_id`, `product_id`, `quantity`, `unit_price`, `line_total` | Return quantities cannot exceed the fulfilled quantity without approval |
| `credit_notes` | `id`, `customer_id`, `return_id`, `amount`, `status`, `created_at` | Credit notes must reconcile to approved returns |
| `order_edits` | `id`, `order_id`, `field_name`, `before_value`, `after_value`, `reason`, `created_by`, `approved_by`, `status` | All edits require a trail and may require approval |
| `override_requests` | `id`, `target_type`, `target_id`, `reason`, `status`, `created_by`, `decided_by` | Overrides are explicit and auditable |
| `approvals` | `id`, `action`, `target_id`, `status`, `reason`, `requested_by`, `decided_by`, `decided_at` | Pending approvals must be visible until resolved |
| `erp_sync_jobs` | `id`, `provider`, `status`, `queued_at`, `started_at`, `completed_at`, `failed_at` | Sync jobs must be replay-safe and observable |
| `erp_sync_attempts` | `id`, `job_id`, `attempt_no`, `status`, `payload_hash`, `response_code`, `created_at` | Retry history must be preserved |
| `erp_contract_snapshots` | `id`, `provider`, `exported_at`, `order_count`, `batch_count`, `payload_json` | Export previews should be inspectable and reproducible |
| `audit_events` | `id`, `actor_role`, `actor_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at` | Every risky action produces a record |
| `reports` | `id`, `report_type`, `service_date`, `payload_json`, `created_at` | Reports are derived, not manually edited |

## Batch Roadmap

### Batch 2.1: Production Locking
Deliver:
- deterministic batch generation
- lock/unlock controls
- shortage flags
- production audit events

Exit criteria:
- a batch can be built from confirmed orders
- the lock action freezes the plan
- unlock only works for the right roles
- batch state never skips a step

### Batch 2.2: Delivery Manifest and POD
Deliver:
- route manifest generation
- stop sequencing
- POD capture
- failed delivery capture
- offline delivery replay

Exit criteria:
- drivers only act on assigned stops
- replay does not duplicate events
- delivery status updates are traceable
- route exceptions stay visible

### Batch 2.3: Returns and Partial Fulfillment
Deliver:
- return capture
- partial delivery flow
- short-delivery handling
- customer and account impact tracking

Exit criteria:
- returns are linked to a real order
- partials and failures are auditable
- returns do not destroy the order trail
- financial impact is visible

### Batch 2.4: Admin Edits and Approvals
Deliver:
- order quantity edits
- slot or cutoff overrides
- approval inbox
- reason-gated changes

Exit criteria:
- risky changes require approval
- edits preserve before/after state
- approval decisions are auditable
- capacity and credit rules still hold

### Batch 2.5: ERP Sync Traceability
Deliver:
- Vasy export preview
- sync queue
- retry and failure tracking
- reconciliation visibility

Exit criteria:
- ERP exports are previewable
- sync failures stay visible
- retries are deduped safely
- source records remain authoritative

## Phase 2 Boundaries
Not in Phase 2:
- procurement planning
- raw material inventory
- multi-warehouse routing
- automated payment collection
- advanced forecasting

Phase 2 should stay focused on the bakery day itself:
make the batch, run the route, capture the exceptions, and keep every exception traceable.
