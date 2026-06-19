# Aeden Bakes Master Product Blueprint

This is the single phase-by-phase blueprint for the Aeden Bakes platform.

It keeps the product split into strict build phases so we can ship the bakery system in controlled batches without leaving gaps in the business flow.

## Product Goal

Build a B2B bakery operations platform that covers:

- wholesale ordering
- branch-wise customer management
- production planning
- delivery execution
- returns and exceptions
- credit control
- support handling
- customer communication
- analytics
- ERP integration
- production-grade storage and deployment

## Core Roles Across The Platform

These are the system roles used across the roadmap.

| Role | Main Responsibility |
| --- | --- |
| `owner` | Full control, approvals, overrides, strategy, reporting |
| `super_admin` | Platform-wide control, customer onboarding, account setup, master data |
| `manager` | Daily operations, approvals, edits, oversight |
| `accounts` | Credit, receivables, risk, invoices, reconciliation |
| `production` | Batch locking, bake plans, shortages, floor execution |
| `delivery` | Route manifests, POD, failures, returns, replay |
| `support` | Cases, follow-up, customer issues, resolution tracking |
| `customer_admin` | Customer-side business admin, branch and user control |
| `customer_user` | Customer-side ordering and self-service |
| `system` | Scheduled jobs, sync jobs, notifications, worker tasks |

## Shared Platform Foundations

These tables are shared by multiple phases and should not be skipped.

| Table | Purpose |
| --- | --- |
| `users` | Login identities for internal and customer users |
| `roles` | Role definitions and permissions |
| `sessions` | Durable auth sessions |
| `customers` | Customer master records |
| `customer_branches` | Branches, outlets, and delivery locations |
| `saved_addresses` | Branch and customer address records |
| `customer_users` | Customer-side user membership to an account |
| `permissions` | Permission catalog |
| `role_permissions` | Role-to-permission mapping |
| `audit_events` | Append-only audit trail |
| `approvals` | Approval inbox and decision log |
| `attachments` | Metadata for stored files |
| `files` | Object-storage file records |
| `notifications` | Notification jobs and delivery status |
| `jobs` | Background job queue |
| `logs` | Operational log records |
| `migrations` | Rollout and schema migration records |

## System State Machines

These are the main state machines used across phases.

| State Machine | States |
| --- | --- |
| Order | `draft -> confirmed -> locked -> in_production -> out_for_delivery -> delivered` |
| Order Exception | `partial_delivery`, `failed_delivery`, `cancelled` |
| Product-Day Capacity | `open -> throttled -> closed` |
| Delivery Slot | `open -> nearly_full -> full -> locked` |
| Production Batch | `draft -> locked -> in_progress -> completed` |
| Delivery Manifest | `draft -> locked -> dispatched -> completed` |
| Delivery Event | `queued -> accepted -> applied` with `rejected`, `duplicate` branches |
| Return | `requested -> pending_review -> approved -> captured` with `rejected` branch |
| Approval | `pending -> approved -> applied` with `rejected` branch |
| Standing Order | `draft -> active -> paused -> active -> cancelled` |
| Support Case | `open -> investigating -> waiting_customer -> waiting_internal -> resolved -> closed` |
| Account Health | `healthy -> watch -> block_soon -> blocked` |
| Notification | `queued -> sent -> delivered` with `failed`, `retrying` branches |
| ERP Sync Job | `idle -> queued -> exporting -> healthy` with `degraded`, `down`, `retrying` branches |
| Storage Readiness | `disabled -> configured -> live -> degraded` |
| Queue Job | `queued -> processing -> succeeded` with `failed`, `retrying` branches |
| Migration Run | `planned -> running -> verified -> complete` with `blocked`, `rollback_needed` branches |

## Phase 1 To Phase 5 Foundation

Phases 1 to 5 already define the base product and production-grade infrastructure.

### Phase 1

Purpose:
- wholesale order capture against real capacity
- delivery slot allocation
- production sheet generation
- receivables visibility
- order lifecycle rules

Modules:
- Catalog and Capacity
- Cart and Checkout
- Delivery Slot Planner
- Order Service
- Production Sheet Builder
- Fulfillment Status Flow
- Accounts and Ledger
- Admin Capacity Control
- Audit and Events

Roles:
- `owner`
- `manager`
- `production`
- `delivery`
- `accounts`
- `customer`

Tables:
- `products`
- `product_day_capacity`
- `delivery_slots`
- `customers`
- `orders`
- `order_items`
- `order_status_history`
- `production_batches`
- `production_batch_lines`
- `account_ledger_entries`
- `capacity_adjustments`
- `audit_events`
- `idempotency_keys`

Build batches:
- Batch 1: master data and hard capacity
- Batch 2: customer order flow
- Batch 3: production and dispatch
- Batch 4: accounts and operational controls

### Phase 2

Purpose:
- production lock and batch control
- delivery manifest execution
- proof of delivery and exception capture
- returns and partial fulfillment
- admin edits and approvals
- ERP sync traceability

Modules:
- Production Batch Manager
- Batch Shortage Review
- Delivery Manifest Builder
- Delivery Execution
- Returns Desk
- Admin Order Control
- Approval Inbox
- ERP Sync Trace
- Audit Ledger
- Operational Reports

Roles:
- `owner`
- `manager`
- `production`
- `delivery`
- `accounts`
- `support`
- `customer`

Tables:
- `production_batches`
- `production_batch_lines`
- `delivery_manifests`
- `delivery_manifest_stops`
- `delivery_events`
- `returns`
- `return_items`
- `credit_notes`
- `order_edits`
- `override_requests`
- `approvals`
- `erp_sync_jobs`
- `erp_sync_attempts`
- `erp_contract_snapshots`
- `audit_events`
- `reports`

Build batches:
- Batch 2.1: production locking
- Batch 2.2: delivery manifest and POD
- Batch 2.3: returns and partial fulfillment
- Batch 2.4: admin edits and approvals
- Batch 2.5: ERP sync traceability

### Phase 3

Purpose:
- customer 360
- support inbox
- recurring orders
- notifications
- account health
- analytics
- customer self-service

Modules:
- Customer 360
- Support Inbox
- Recurring Orders
- Notification Orchestrator
- Account Health
- Analytics Console
- Customer Self-Service
- Alerting Rules
- Export and Audit

Roles:
- `owner`
- `manager`
- `accounts`
- `support`
- `production`
- `delivery`
- `customer`

Tables:
- `customer_profiles`
- `customer_notes`
- `customer_timeline_events`
- `support_cases`
- `support_case_messages`
- `support_case_actions`
- `standing_orders`
- `standing_order_runs`
- `standing_order_pauses`
- `notification_jobs`
- `notification_deliveries`
- `account_health_snapshots`
- `account_actions`
- `alert_rules`
- `alert_events`
- `analytics_snapshots`
- `kpi_rollups`
- `customer_requests`
- `saved_addresses`
- `report_exports`
- `audit_events`

Build batches:
- Batch 3.1: customer 360 and support inbox
- Batch 3.2: recurring orders
- Batch 3.3: notifications
- Batch 3.4: account health and alerts
- Batch 3.5: analytics and reporting

### Phase 4

Purpose:
- real database
- durable auth
- object storage
- queue worker
- ERP sync layer
- observability

Modules:
- Database Core
- Auth and Sessions
- Object Storage
- Queue Worker
- Sync Adapter Layer
- Observability
- Migration Tools

Roles:
- `owner`
- `manager`
- `accounts`
- `support`
- `production`
- `delivery`
- `customer`
- `system`

Tables:
- `users`
- `sessions`
- `files`
- `jobs`
- `migrations`
- `logs`

Build batches:
- Batch 4.1: database migration
- Batch 4.2: auth and session hardening
- Batch 4.3: object storage
- Batch 4.4: queue and worker
- Batch 4.5: observability and rollout safety

### Phase 5

Purpose:
- deployment readiness
- CI/CD
- release checks
- environment hardening
- local-to-live rollout discipline

Modules:
- Environment Configuration
- Release Pipeline
- Build Verification
- Smoke Testing
- Demo Toggle Controls
- Deployment Checklist

Roles:
- `owner`
- `super_admin`
- `manager`
- `system`

Tables:
- none new by design

Build batches:
- Batch 5.1: release readiness
- Batch 5.2: deployment configuration
- Batch 5.3: smoke test and go-live prep

## Phase 6 To Phase 12 Roadmap

These are the next phases the product now needs for a real B2B bakery rollout.

### Phase 6: Customer Structure

Purpose:
- branch-wise ordering
- customer roles and approvals
- customer hierarchy
- per-branch visibility
- per-branch address control

Modules:
- Customer Hierarchy
- Branch Management
- Customer User Management
- Branch Serviceability
- Branch Notes and Preferences
- Customer Approval Matrix

Roles:
- `owner`
- `super_admin`
- `manager`
- `customer_admin`
- `customer_user`
- `support`

Tables:
- `customer_branches`
- `customer_users`
- `branch_roles`
- `branch_permissions`
- `branch_serviceability`
- `branch_notes`
- `saved_addresses`
- `approval_rules`

State machines:
- Customer account: `active -> restricted -> blocked -> closed`
- Branch: `active -> paused -> service_hold -> closed`
- Customer approval request: `draft -> submitted -> approved -> rejected`

Build batches:
- Batch 6.1: customer hierarchy and branches
- Batch 6.2: customer user accounts and permissions
- Batch 6.3: branch serviceability and notes
- Batch 6.4: approval routing for customer-side actions

### Phase 7: Recurring Commercial Engine

Purpose:
- subscription and standing order flexibility
- pause, skip, resume
- holiday handling
- quantity edits
- per-branch recurring schedules

Modules:
- Standing Order Builder
- Recurrence Rules
- Skip and Pause Manager
- Auto-Generate Runs
- Branch Recurrence Controls
- Recurrence Change Approval

Roles:
- `owner`
- `manager`
- `customer_admin`
- `support`
- `accounts`

Tables:
- `standing_orders`
- `standing_order_runs`
- `standing_order_pauses`
- `standing_order_changes`
- `standing_order_approvals`
- `recurrence_rules`

State machines:
- Standing order: `draft -> active -> paused -> active -> cancelled`
- Standing order run: `pending -> generated -> confirmed -> skipped -> completed`
- Recurrence change: `draft -> submitted -> approved -> applied -> rejected`

Build batches:
- Batch 7.1: standing order setup
- Batch 7.2: pause, skip, and resume logic
- Batch 7.3: per-branch recurrence support
- Batch 7.4: run generation and approvals

### Phase 8: Commercial Control Layer

Purpose:
- substitution handling
- strong credit management
- customer-specific pricing
- contract pricing tiers
- credit holds
- overdue blocks

Modules:
- Pricing Engine
- Credit Ledger
- Credit Hold Manager
- Substitution Rules
- Product Substitutions
- Commercial Overrides
- Risk Scoring

Roles:
- `owner`
- `manager`
- `accounts`
- `super_admin`
- `support`

Tables:
- `pricing_rules`
- `customer_pricing`
- `customer_contracts`
- `credit_limits`
- `credit_ledger_entries`
- `credit_hold_events`
- `risk_scores`
- `substitution_rules`
- `substitution_events`
- `override_requests`
- `approvals`

State machines:
- Account health: `healthy -> watch -> block_soon -> blocked`
- Credit hold: `none -> warning -> hold -> release`
- Substitution decision: `proposed -> approved -> applied -> rejected`

Build batches:
- Batch 8.1: pricing and contract tiers
- Batch 8.2: credit ledger and risk states
- Batch 8.3: holds and blocks
- Batch 8.4: substitution rules and approvals

### Phase 9: Communication Layer

Purpose:
- push notifications
- WhatsApp updates
- SMS updates
- order confirmations
- dispatch alerts
- delay alerts
- invoice reminders

Modules:
- Notification Orchestrator
- Push Gateway
- WhatsApp Gateway
- SMS Gateway
- Template Manager
- Delivery Receipt Tracking
- Correlation and Retry

Roles:
- `owner`
- `manager`
- `support`
- `accounts`
- `customer_admin`
- `customer_user`
- `system`

Tables:
- `notification_jobs`
- `notification_deliveries`
- `message_templates`
- `notification_preferences`
- `notification_channels`
- `notification_events`

State machines:
- Notification job: `queued -> sent -> delivered`
- Retry path: `failed -> retrying -> sent`
- Channel status: `enabled -> degraded -> disabled`

Build batches:
- Batch 9.1: push notification foundation
- Batch 9.2: WhatsApp delivery
- Batch 9.3: SMS fallback
- Batch 9.4: templates and retry-safe tracking

### Phase 10: Support And Documentation

Purpose:
- support ticketing
- downloadable invoices
- document storage
- GST docs
- credit docs
- proof documents

Modules:
- Support Desk
- Ticket Routing
- Case Notes
- Invoice Export
- Document Vault
- Customer Evidence Store

Roles:
- `owner`
- `manager`
- `support`
- `accounts`
- `customer_admin`
- `customer_user`

Tables:
- `support_cases`
- `support_case_messages`
- `support_case_actions`
- `support_assignments`
- `invoice_exports`
- `documents`
- `files`
- `document_tags`
- `document_access_logs`

State machines:
- Support case: `open -> investigating -> waiting_customer -> waiting_internal -> resolved -> closed`
- Document: `draft -> uploaded -> verified -> archived`

Build batches:
- Batch 10.1: support case workflow
- Batch 10.2: downloadable invoices
- Batch 10.3: document vault and tags
- Batch 10.4: support history and access logs

### Phase 11: Delivery Confidence Layer

Purpose:
- route and delivery proof confidence
- signature capture
- photo capture
- timestamp and location capture
- failed delivery reasons
- return capture
- offline replay

Modules:
- Route Manifest
- Delivery Stop Proof
- Signature Capture
- Photo Capture
- Failure Reason Capture
- Return Capture
- Offline Replay Guard

Roles:
- `owner`
- `manager`
- `delivery`
- `support`
- `accounts`

Tables:
- `delivery_manifests`
- `delivery_manifest_stops`
- `delivery_events`
- `proof_of_delivery`
- `delivery_photos`
- `failure_reasons`
- `returns`
- `return_items`
- `event_outbox`

State machines:
- Delivery manifest: `draft -> locked -> dispatched -> completed`
- Delivery stop: `pending -> reached -> completed -> failed -> returned`
- Delivery event: `queued -> accepted -> applied` with `duplicate`, `rejected`

Build batches:
- Batch 11.1: manifest and stop proof
- Batch 11.2: signature and photo capture
- Batch 11.3: return capture and failure reasons
- Batch 11.4: offline replay and duplicate protection

### Phase 12: Analytics And Management Intelligence

Purpose:
- proper customer analytics
- branch analytics
- repeat purchase analytics
- return-rate analytics
- delivery performance analytics
- credit risk analytics
- pricing and margin reporting

Modules:
- Analytics Snapshots
- KPI Rollups
- Customer Segmentation
- Branch Performance
- Return Analysis
- Delivery Performance
- Credit Risk Reporting
- Margin and Pricing Intelligence

Roles:
- `owner`
- `super_admin`
- `manager`
- `accounts`
- `support`
- `production`

Tables:
- `analytics_snapshots`
- `kpi_rollups`
- `segment_definitions`
- `segment_memberships`
- `report_exports`
- `branch_metrics`
- `customer_metrics`
- `margin_snapshots`
- `risk_snapshots`

State machines:
- Analytics snapshot: `building -> ready -> published`
- Report export: `queued -> generated -> delivered`

Build batches:
- Batch 12.1: core KPI rollups
- Batch 12.2: customer and branch analytics
- Batch 12.3: credit and risk reporting
- Batch 12.4: margin, returns, and delivery intelligence

## No-Gap Coverage Check

These are the business concerns that must exist somewhere in the roadmap.

| Concern | Covered In |
| --- | --- |
| Branch-wise ordering | Phase 6 |
| Customer roles and approvals | Phase 6 |
| Standing orders and subscriptions | Phase 7 |
| Substitution handling | Phase 8 |
| Push notifications | Phase 9 |
| WhatsApp and SMS | Phase 9 |
| Strong credit management | Phase 8 |
| Support ticketing | Phase 10 |
| Downloadable invoices | Phase 10 |
| Document storage | Phase 10 and Phase 4 |
| Route and delivery proof confidence | Phase 11 |
| Customer analytics | Phase 12 |
| Production batch control | Phases 1 and 2 |
| Admin edits and overrides | Phase 2 |
| Returns and partials | Phase 2 and Phase 11 |
| ERP integration | Phase 2 and Phase 4 |
| Production-grade storage | Phase 4 |
| Deployment hardening | Phase 5 |

## Operating Rule For All Phases

Each phase must follow the same gate:

1. Define the UI/UX target.
2. Implement only that phase.
3. Run QC.
4. Run Visual QA.
5. Run Advisor review.
6. Apply fixes.
7. Re-run builds and tests.
8. Close the phase only when the gate is clean.

## Product Principle

This is a B2B bakery operations platform, not a shopping app.
Every phase must make it more:

- deterministic
- auditable
- permission-aware
- operationally realistic
- safe under exceptions
