# Phase 3 Product Blueprint

## Purpose
Phase 3 turns the bakery ops platform into a customer-aware commercial system.

Phase 2 proved that the bakery can take orders, bake them, route them, and reconcile exceptions.
Phase 3 adds the layer that keeps the business healthy over time:

- customer 360 and support visibility
- recurring and standing orders
- notifications and customer communication
- account health and commercial controls
- analytics and operational reporting
- self-service follow-up for customers and support

Phase 3 should make the system easier to run every day, not bigger for its own sake.

## Operating Rules

- Customer and support data must point to the same source of truth.
- Commercial promises should be visible before they are missed.
- Recurring orders must be explicit and editable.
- Notifications must be traceable and retry-safe.
- Customer self-service should reduce support load, not bypass operations.
- Reporting must be derived from operational truth, not manually edited.
- Anything that can affect credit, service promises, or delivery confidence must be auditable.

## Exact Modules

| Module | Responsibility | Primary Data Owned | Notes |
| --- | --- | --- | --- |
| Customer 360 | Show a single customer’s profile, orders, support history, risk, and service pattern | `customer_profiles`, `customer_notes`, `customer_timeline_events` | The super admin view should make account context obvious in one place |
| Support Inbox | Handle complaints, missed deliveries, edits, and follow-ups | `support_cases`, `support_case_messages`, `support_case_actions` | Support needs a queue, not scattered one-off messages |
| Recurring Orders | Manage standing orders, schedules, pauses, and skips | `standing_orders`, `standing_order_runs`, `standing_order_pauses` | Lets wholesale customers repeat predictable demand |
| Notification Orchestrator | Send order confirmations, route updates, issue alerts, and reminders | `notification_jobs`, `notification_deliveries` | Must support retry and delivery-state tracking |
| Account Health | Monitor customer reliability, exposure, and service risk | `account_health_snapshots`, `account_actions` | Gives accounts and support a shared risk view |
| Analytics Console | Show revenue, repeat rate, fill rate, returns, and exception trends | `analytics_snapshots`, `kpi_rollups` | Derived reporting only; no manual tweaking |
| Customer Self-Service | Let customers view order history, reorder, update addresses, and raise issues | `customer_requests`, `saved_addresses` | Keeps low-value support work out of the ops queue |
| Alerting Rules | Trigger warnings for late orders, repeated failures, or risk thresholds | `alert_rules`, `alert_events` | Powers proactive operations rather than reactive firefighting |
| Export and Audit | Preserve commercial actions and reporting evidence | `audit_events`, `report_exports` | Every action should be explainable after the fact |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Inspect everything, override commercial decisions, approve escalations, inspect analytics | Nothing is hidden from owner visibility |
| `manager` | Manage support, approve overrides, review recurring orders, inspect analytics | Cannot silently rewrite timelines or audit records |
| `accounts` | Review health, exposure, payment promises, and customer blocks | Cannot change delivery history |
| `support` | Open and close support cases, send follow-ups, view full customer context | Cannot alter credit or fulfillment records |
| `production` | Read customer patterns that affect the bake plan | Cannot edit customer commercial data |
| `delivery` | View customer notes relevant to service and exceptions | Cannot edit customer commercial data |
| `customer` | View own orders, recurring settings, alerts, and self-service actions | Cannot edit shared operational state directly |

## State Machines

### Support Case State
`open -> investigating -> waiting_customer -> waiting_internal -> resolved -> closed`

Escalation branch:
- `escalated`

Rules:
- `open` is the intake state.
- `investigating` means internal analysis is underway.
- `waiting_customer` means action is blocked on customer input.
- `waiting_internal` means another team must respond.
- `resolved` means the issue is solved but still reviewable.
- `closed` is terminal for normal work.
- `escalated` is for high-risk or high-value exceptions.

### Standing Order State
`draft -> active -> paused -> active -> cancelled`

Rules:
- `draft` is configurable and not yet live.
- `active` means the recurrence will generate future demand.
- `paused` temporarily suppresses generation without deleting the plan.
- `cancelled` is terminal.
- Each occurrence must be visible and editable only through controlled rules.

### Notification State
`queued -> sent -> delivered`

Failure branches:
- `failed`
- `retrying`

Rules:
- Each notification must have a correlation key.
- Failed sends remain visible.
- Retries must not duplicate customer-facing messages.

### Account Health State
`healthy -> watch -> block_soon -> blocked`

Rules:
- Health is driven by exposure, aging, failed deliveries, and support risk.
- `blocked` should prevent new credit or other high-risk actions.
- The state must be explainable from the underlying events.

### Customer Request State
`draft -> submitted -> in_review -> completed`

Rejection branch:
- `rejected`

Rules:
- Self-service requests need a clear outcome.
- Requests that affect operations or credit may need approval.

### Analytics Snapshot State
`building -> ready -> published`

Rules:
- Snapshots are derived and immutable once published.
- Published metrics should reference a snapshot time.

## Database Entities

| Entity | Key Fields | Invariants |
| --- | --- | --- |
| `customer_profiles` | `id`, `customer_id`, `preferred_contact`, `preferred_delivery_notes`, `created_at`, `updated_at` | One live profile per customer |
| `customer_notes` | `id`, `customer_id`, `note_type`, `note`, `created_by`, `created_at` | Notes are append-only |
| `customer_timeline_events` | `id`, `customer_id`, `event_type`, `reference_id`, `payload_json`, `created_at` | Timeline should be explainable and ordered |
| `support_cases` | `id`, `customer_id`, `order_id`, `status`, `priority`, `subject`, `opened_by`, `assigned_to`, `created_at`, `closed_at` | Every customer issue is traceable |
| `support_case_messages` | `id`, `case_id`, `message_type`, `message`, `author_role`, `author_id`, `created_at` | Messages are append-only |
| `support_case_actions` | `id`, `case_id`, `action_type`, `payload_json`, `created_at` | Actions should be reviewable later |
| `standing_orders` | `id`, `customer_id`, `status`, `schedule_json`, `payment_mode`, `delivery_zone`, `created_at`, `updated_at` | Recurrences must be explicit and editable |
| `standing_order_runs` | `id`, `standing_order_id`, `service_date`, `status`, `generated_order_id`, `created_at` | Each occurrence maps to one generated result |
| `standing_order_pauses` | `id`, `standing_order_id`, `start_date`, `end_date`, `reason`, `created_at` | Pauses must not silently delete the schedule |
| `notification_jobs` | `id`, `channel`, `template_code`, `status`, `correlation_key`, `created_at`, `sent_at` | `correlation_key` dedupes retries |
| `notification_deliveries` | `id`, `job_id`, `recipient`, `provider_message_id`, `status`, `attempt_no`, `created_at` | Delivery history must be preserved |
| `account_health_snapshots` | `id`, `customer_id`, `health_state`, `risk_score`, `exposure`, `reason_json`, `created_at` | Health state must be reproducible from the snapshot |
| `account_actions` | `id`, `customer_id`, `action_type`, `reason`, `created_by`, `approved_by`, `created_at` | Risky account actions need a trace |
| `alert_rules` | `id`, `rule_code`, `threshold_json`, `active`, `created_at` | Rules are explicit and versioned |
| `alert_events` | `id`, `rule_id`, `severity`, `payload_json`, `created_at`, `acknowledged_at` | Alerts should not disappear silently |
| `analytics_snapshots` | `id`, `snapshot_time`, `payload_json`, `created_at` | Analytics are derived and immutable |
| `kpi_rollups` | `id`, `metric_code`, `service_date`, `value`, `created_at` | KPI values should be reproducible |
| `customer_requests` | `id`, `customer_id`, `request_type`, `status`, `reason`, `created_at`, `decided_at` | Self-service requests need clear outcomes |
| `saved_addresses` | `id`, `customer_id`, `label`, `address_line`, `delivery_zone`, `active` | Customers can manage addresses without losing auditability |
| `report_exports` | `id`, `report_code`, `created_by`, `created_at`, `payload_json` | Exports must match the snapshot used to create them |
| `audit_events` | `id`, `actor_role`, `actor_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at` | Phase 3 actions remain auditable |

## Batch Roadmap

### Batch 3.1: Customer 360 and Support Inbox
Deliver:
- customer timeline
- support case queue
- note-taking and follow-up
- customer issue visibility from super admin

Exit criteria:
- a single customer can be reviewed end to end
- support cases have a clear lifecycle
- customer context is visible without digging through raw orders

### Batch 3.2: Recurring Orders
Deliver:
- standing order setup
- schedule editing
- pause and resume
- generated order runs

Exit criteria:
- recurring demand is explicit
- pauses do not delete history
- generated runs are linked back to the recurrence

### Batch 3.3: Notifications
Deliver:
- order confirmation messages
- support follow-up messages
- exception alerts
- retry-safe delivery tracking

Exit criteria:
- notification sends can be traced
- retries do not duplicate messages
- failures remain visible for review

### Batch 3.4: Account Health and Alerts
Deliver:
- health snapshots
- alert rules
- escalation handling
- support/account coordination

Exit criteria:
- risk states are explainable
- alerts fire from defined thresholds
- blocks and watches are visible before they hurt operations

### Batch 3.5: Analytics and Reporting
Deliver:
- KPI rollups
- customer segment views
- operational trend dashboards
- exportable reports

Exit criteria:
- metrics are derived from operational truth
- snapshots can be reproduced
- reports are suitable for owner and manager review

## Phase 3 Boundaries
Not in Phase 3:
- procurement planning
- raw-material inventory
- warehouse routing
- accounting automation beyond the existing receivables model
- machine-optimized forecasting

Phase 3 should stay focused on the commercial layer around the bakery day:
help the team support customers better, protect revenue, and spot problems before they become fire drills.
