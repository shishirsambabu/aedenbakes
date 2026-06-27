# Aeden Bakes Product Recovery Audit

Date: 2026-06-20

## Executive verdict

The repository is a broad functional prototype, not a production-ready B2B bakery platform. It has many screens, route names, and domain objects, but several flows only simulate completion. The correct response is not another feature sprint. The product needs a controlled recovery program that proves each workflow from UI action through authorization, database transaction, external provider, audit trail, and automated test.

Current release recommendation: **do not onboard a paying bakery or real customer yet**.

## What was verified

- API TypeScript build: pass.
- Root Vite prototype build: pass.
- Next.js super-admin production build: pass.
- Customer Flutter analyze and single widget test: pass.
- Production Flutter analyze and single widget test: pass.
- Delivery Flutter test: pass; analyze has one warning because its error state is never displayed.
- API runtime root, health, login, catalog, and admin operations smoke requests: reachable.
- Super-admin lint: 54 warnings, including many implemented-but-unreachable actions.
- API automated tests: none.
- Super-admin automated tests: none.
- Mobile business-flow tests: none; each app has one shell/splash test.
- Live interactive browser audit: unavailable in this session. Repository screenshots and source were audited instead.

## Critical product gaps

| Severity | Gap | Evidence | Consequence |
| --- | --- | --- | --- |
| Critical | Public onboarding creates an active customer, branch, admin user, and session before admin approval, and accepts client-supplied tier/credit limit. | `services/api/src/server.ts:1641`, `services/api/src/server.ts:1765`, `services/api/src/server.ts:1837` | Unreviewed applicants can become active customers with self-selected commercial terms. |
| Critical | Passwords are stored and compared in plaintext; seed state contains credentials and sessions; login/OTP have no rate limiting. | `services/api/src/server.ts:1393`, `services/api/data/api-state.json`, `services/api/src/server.ts:1451` | Credential exposure, brute force, session leakage. |
| Critical | Customer document download lacks ownership checks. | `services/api/src/server.ts:3912` | One customer can retrieve another customer's document or invoice metadata. |
| Critical | `.env` is not ignored at the repository root and the API does not load it. Runtime currently reports local OTP despite MSG91 values being present. | `.gitignore`, `services/api/src/server.ts:63`, runtime `/health` | Secret leak risk and real OTP silently disabled. |
| Critical | Production data is a full JSON snapshot in local SQLite, deployed without a persistent disk or managed database. | `services/api/src/server.ts:800`, `services/api/src/server.ts:5829`, `render.yaml` | Data loss on redeploy and unsafe multi-instance behavior. |
| Critical | Orders have no idempotency key or atomic capacity/credit reservation. | `services/api/src/server.ts:1915`, `services/api/src/server.ts:5269` | Double taps and concurrent requests can duplicate orders and overbook production. |
| High | KYC upload is simulated. Flutter toggles local flags and sends filenames marked verified; the API stores metadata only. | `apps/mobile/customer/lib/main.dart:1489`, `services/api/src/server.ts:1654`, `services/api/src/server.ts:3851` | No real GST/FSSAI/cheque evidence exists to review. |
| High | Customer app session, onboarding, cart, and selected branch are not persisted. | `apps/mobile/customer/lib/main.dart:280`, `apps/mobile/customer/pubspec.yaml` | Relaunch loses the user journey and may cause repeat submissions. |
| High | Notifications are marked delivered without contacting SMS, WhatsApp, email, or push providers. | `services/api/src/server.ts:4588` | The UI reports delivery that never happened. |
| High | Vasy sync is a simulator that accepts valid-looking rows and reports success without calling Vasy. | `services/api/src/server.ts:4513` | ERP status is misleading; accounting and stock do not reconcile. |
| High | Payment modes are labels only; there is no payment gateway, webhook, transaction, settlement, refund, or credit-note flow. | `apps/mobile/customer/lib/main.dart:1698`; repository search found no gateway integration | Prepaid and part-pay orders cannot be safely collected or reconciled. |
| High | Reports and invoices are JSON/metadata, not generated PDF/CSV files. | `services/api/src/server.ts:3747`, `services/api/src/server.ts:3813`, `services/api/src/server.ts:3941` | Users cannot download legally useful invoices or management reports. |
| High | Delivery POD is typed text and a `photo://` string, not camera/photo/signature/location evidence. | `apps/mobile/delivery/lib/main.dart:276` | Disputes cannot be resolved with trustworthy proof. |
| High | Delivery offline queue is memory-only. | `apps/mobile/delivery/lib/main.dart:54`, `apps/mobile/delivery/lib/main.dart:233` | POD, returns, and failures disappear when the app restarts. |
| High | Return capture assigns all returns to the first order line. | `services/api/src/server.ts:4255` | SKU inventory, credit notes, and margin become wrong. |
| High | Branch approval rules exist but customer branch creation activates immediately. | `services/api/src/server.ts:921`, `services/api/src/server.ts:2275` | Approval controls are bypassed. |
| High | Manifest state transitions can be skipped and writebacks do not require a valid dispatched state. | `services/api/src/server.ts:4067`, `services/api/src/server.ts:4097` | Routes can be completed or altered out of sequence. |
| High | There is no Flutter admin app. There are two separate web admin-like surfaces, and the root Vite app is entirely in-memory mock data. | `apps/mobile/`, `src/App.tsx:1`, `apps/web/super-admin/src/app/page.tsx` | The promised mobile admin product does not exist and admin behavior is duplicated. |
| High | Super-admin is not deployed by `render.yaml`; only the API is defined. | `render.yaml` | No production admin link exists from repository infrastructure. |
| Medium | Production and delivery apps auto-login with compile-time staff credentials. | `apps/mobile/production/lib/main.dart:105`, `apps/mobile/delivery/lib/main.dart:115` | Shared credentials and no operator accountability. |
| Medium | Production depends on three reads succeeding together and has no last-known-good/offline mode. | `apps/mobile/production/lib/main.dart:143` | A catalog outage can block floor operations. |
| Medium | Delivery errors are stored but never shown; stale seeded routes can look live. | `apps/mobile/delivery/lib/main.dart:48`, `apps/mobile/delivery/lib/main.dart:462` | Drivers can act on stale data without warning. |
| Medium | Support cases can close without a mandatory resolution note or evidence. | `services/api/src/server.ts:2494` | Disputes can be closed without an accountable resolution trail. |
| Medium | Standing-order approval can show approved before the change is successfully applied. | `services/api/src/server.ts:3165` | Approval status is not trustworthy. |
| Medium | Customer serviceability can expose another customer's branch by ID. | `services/api/src/server.ts:2412` | Cross-tenant metadata leak. |
| Medium | Super-admin has dead role-incompatible CTAs, nested interactive controls, customer-data leakage to production roles, 54 lint warnings, and corrupted text. | `apps/web/super-admin/src/app/page.tsx:1206`, `:2074`, `:4418` | Confusing behavior, accessibility failures, and RBAC inconsistency. |
| Medium | Next.js dependency audit reports a moderate PostCSS XSS advisory through the installed Next version. | `apps/web/super-admin/package-lock.json` and `npm audit` | Dependency risk must be resolved before release. |
| Medium | No CI workflow, API integration suite, web test suite, contract tests, load tests, migration tests, or recovery tests exist. | package scripts and repository inventory | There is no reliable quality gate. |

## UI/UX defects

- The shared brown/gold palette is present, but consistency is superficial because each app implements its own large UI file instead of shared components and tokens.
- Customer onboarding presents simulated verification as real verification.
- Customer download, support, order-detail, and notification actions are mostly snackbars or non-actions.
- Customer catalog lacks strong search, sort, filters, availability explanations, substitute choices, and branch-aware price/stock clarity.
- Production screens prioritize a large decorative hero over station execution, timers, weights, yields, wastage, allergen controls, and exception resolution.
- Delivery desktop/tablet layouts produce oversized empty metric cards; error/offline state is hidden.
- Admin has two overlapping products: the Vite prototype and Next.js super-admin. Users cannot know which is authoritative.
- The Next.js page is 5,171 lines and has unreachable handlers, invalid nested controls, mojibake, and role-dependent dead navigation.
- None of the apps has a complete accessibility pass for keyboard use, semantics, focus, contrast, text scaling, or screen readers.

## Missing B2B bakery capabilities

### Customer commerce

- Real onboarding application state, KYC review, rejection/re-upload, and activation.
- Multiple branch switching with branch-level addresses, GST, pricing, credit, users, approvals, and order history.
- Buyer, requester, approver, finance, receiver, and account-admin roles.
- Cart approval thresholds and maker-checker ordering.
- Draft orders, reorder, quote/request-for-price, purchase-order number, attachments, and cost-centre references.
- Real prepaid/part-pay collection, payment failure recovery, refunds, credit notes, and statement reconciliation.
- Search, filters, favorites, recently ordered, pack sizes, MOQ, lead time, allergens, dietary tags, shelf life, and tax breakdown.
- Substitution consent per product/order and explicit accept/reject workflow.
- Standing-order calendar with pause, skip, holiday exceptions, branch-specific schedules, and approval history.
- Order detail timeline, edit/cancel window, invoice/credit-note download, ticket creation, and communication history.

### Bakery operations

- Recipe/BOM, ingredient lots, supplier receipts, raw-material inventory, allergen segregation, and expiry/FEFO.
- Demand planning by SKU/day/route and true finite capacity by mixer, oven, proofer, line, labour, and shift.
- Batch genealogy, scale/weight capture, yield, wastage, rework, QC checks, hold/release, and traceability/recall.
- Packaging labels, batch labels, barcode/QR scans, pick lists, dispatch verification, and cold-chain/temperature where relevant.
- Production exceptions for shortage, machine failure, staff shortage, late orders, substitutions, and partial fulfilment.
- Maker-checker controls for batch unlock, order override, pricing, credit, refunds, returns, and write-offs.

### Delivery and returns

- Driver/device authentication, assigned routes, vehicle checks, dispatch handoff, navigation, call customer, and ETA.
- Real camera capture, receiver name/signature/OTP, GPS/time proof, tamper-resistant media, and proof review.
- Persistent encrypted offline queue with retries, conflict resolution, and duplicate protection.
- Line-level partial delivery, shortage, damage, rejection, return reason, reusable-crate tracking, and cash/cheque collection.
- Failed delivery reschedule, reverse logistics, credit-note trigger, and dispute workflow.

### Admin, finance, and management

- Flutter admin app for mobile operational approvals; Next.js remains the desktop super-admin.
- Product, recipe, price list, branch assortment, day availability, blackout, capacity, and cutoff management.
- Customer/KYC queue, credit approval, branch/user approval, order exceptions, substitutions, refunds, and returns.
- AR ledger, invoice ageing, payments, adjustments, credit notes, limits, holds, dunning, and statements.
- GST-compliant invoice artifacts, e-invoice/e-waybill requirements where applicable, downloadable files, retention, and access logs.
- Vasy connector with credentials, mapping, outbox, retries, reconciliation, dead-letter queue, and operator-visible failures.
- Real SMS/WhatsApp/email/push providers, consent, templates, opt-out, delivery receipts, and retry policy.
- Auditable analytics based on transactional tables, with branch/SKU/customer/route/margin/waste/service-level drilldowns.

## Target product architecture

- **Apps:** customer Flutter, production Flutter, delivery Flutter, admin Flutter, Next.js super-admin.
- **Remove:** root Vite prototype after any useful UI is migrated; it must not remain a second source of truth.
- **API:** modular TypeScript service split into auth, customers, catalog, orders, capacity, production, delivery, finance, documents, notifications, ERP, support, analytics, and audit modules.
- **Database:** managed PostgreSQL with normalized tables, foreign keys, constraints, indexes, migrations, tenant/customer ownership, transactions, and row-level authorization in the service layer.
- **Files:** object storage adapter with local emulator/dev storage and R2/S3-compatible production storage; signed uploads and downloads.
- **Async work:** durable jobs/outbox for notifications, document generation, ERP sync, analytics refresh, and retries.
- **Auth:** hashed passwords, OTP identity binding, refresh/session rotation, device sessions, rate limits, staff SSO-ready roles, and revocation.
- **Observability:** structured logs, request IDs, error tracking, uptime checks, provider dashboards, audit events, and alerts.

## Recovery build roadmap

No later phase starts until the previous phase gate passes.

### Phase R0 - Containment and truth reset

**Batch R0.1: secrets and runtime configuration**
- Ignore all env files, rotate the exposed MSG91 auth key/token, add `.env.example`, load env explicitly, and fail startup when required production variables are absent.
- Remove debug OTP and demo credentials from production builds.

**Batch R0.2: product truth**
- Mark every screen/action as `real`, `partial`, `mock`, or `absent` in a traceability matrix.
- Remove “delivered”, “verified”, “synced”, and “download” wording where no external action/file exists.
- Freeze new feature work until critical findings have owners and tests.

**Batch R0.3: repository baseline**
- Add CI for API build/test, web lint/build/test, Flutter analyze/test, secret scanning, dependency audit, and migration checks.
- Split generated screenshots and local state from source control.

**Exit gate:** no secrets tracked; production startup rejects unsafe config; CI runs on every change; current capabilities are honestly labelled.

### Phase R1 - Secure data and application foundation

**Batch R1.1: PostgreSQL and migrations**
- Introduce normalized core tables: tenants, staff_users, roles, permissions, sessions, customers, applications, branches, customer_users, products, price_lists, capacities, slots, orders, order_lines, audit_events, idempotency_keys.
- Add migrations, seed profiles, backup/restore, and staging database.

**Batch R1.2: authentication and tenant authorization**
- Hash passwords, add OTP throttling, session rotation/revocation, account lockout, device records, and ownership guards.
- Replace auto-login credentials in production and delivery with staff sign-in and device session storage.

**Batch R1.3: API modularization**
- Break the 6,817-line server into modules, schemas, repositories, services, policies, routes, and provider adapters.
- Add request validation, secure headers, restricted CORS, request-size limits, standardized errors, and request IDs.

**Exit gate:** authorization isolation tests pass; password/session/OTP security tests pass; concurrent writes are transactional; backup restoration is demonstrated.

### Phase R2 - Real onboarding, KYC, and customer identity

**Batch R2.1: application state machine**
- `draft -> otp_verified -> submitted -> under_review -> needs_information | approved | rejected -> activated`.
- Public submission creates only an application. Admin approval creates the customer, terms, branch, users, and login.

**Batch R2.2: document storage**
- Real file picker, MIME/size checks, malware-ready scanning hook, signed upload, checksums, preview, replacement, rejection reason, and retention.
- GSTIN format/duplicate checks and recorded verification source; FSSAI and cheque review remain human-verifiable until an approved provider is added.

**Batch R2.3: customer session continuity**
- Securely persist sessions, onboarding progress, selected branch, and safe cart state.
- Add logout, session expiry, restore, and account recovery.

**Batch R2.4: admin KYC queues**
- Build application list/detail/diff, document viewer, comments, maker-checker credit approval, rejection/re-upload, and full audit history in web and Flutter admin.

**Exit gate:** a customer cannot activate without approved KYC; real files can be uploaded/reviewed; restart resumes safely; negative authorization tests pass.

### Phase R3 - Branch, roles, approvals, catalog, and pricing

**Batch R3.1: branch hierarchy**
- Branch create/edit/activate/suspend approval state machines, serviceability, delivery instructions, GST/PO settings, and branch switching.

**Batch R3.2: customer RBAC**
- Account admin, buyer, requester, approver, finance, receiver, viewer; scoped by branch and amount threshold.

**Batch R3.3: product master**
- SKU, pack/unit, MOQ, category, tax, allergens, shelf life, lead time, images, recipe link, publish state, branch assortment, price lists, and effective dates.

**Batch R3.4: catalog experience**
- Search, filters, favorites, recent/reorder, branch pricing, cutoff and capacity messages, sold-out state, substitutions, and accessible responsive layouts.

**Exit gate:** cross-branch access is denied; all product changes are auditable; published availability and price match customer checkout.

### Phase R4 - Order, capacity, approval, and payment integrity

**Batch R4.1: transactional order engine**
- Server-calculated price/tax/total, idempotency keys, atomic capacity and credit reservation, order versioning, cutoff rules, and conflict responses.

**Batch R4.2: customer order lifecycle**
- Draft, submit, maker-checker approval, confirm/reject, modify/cancel window, PO attachment, timeline, reorder, and support handoff.

**Batch R4.3: substitutions and shortages**
- Per-line consent, recommended substitute, customer decision, price difference, partial fulfilment, and audit trail.

**Batch R4.4: payments and credit**
- Payment provider adapter, checkout, webhook verification, idempotent transactions, failures, refunds, part-pay balance, credit ledger, holds, ageing, and statements.

**Exit gate:** concurrency tests cannot overbook capacity or credit; duplicate requests create one order/payment; totals reconcile to ledger entries.

### Phase R5 - Production control and food traceability

**Batch R5.1: demand and finite capacity**
- Aggregate confirmed orders by service date/slot/SKU; model lines, stations, equipment, labour, shifts, and hard capacity.

**Batch R5.2: recipes, inventory, and lots**
- BOM, ingredients, supplier lots, FEFO, reservations, shortages, substitutions, allergen flags, and traceability.

**Batch R5.3: floor execution**
- Station assignments, lock/start/pause/complete transitions, quantities, timers, weights, yield, waste, rework, notes, and scans.

**Batch R5.4: QC and release**
- Checklists, temperature/weight tolerances, hold/release, supervisor override, labels, pack verification, and recall lookup.

**Exit gate:** every delivered line traces to a batch and ingredient lots; invalid state jumps fail; production remains usable with last-known-good data during a read outage.

### Phase R6 - Dispatch, delivery proof, and returns

**Batch R6.1: manifest and assignment**
- Route planning, vehicle/driver assignment, pick/scan verification, lock/dispatch/complete guards, and handoff signatures.

**Batch R6.2: driver execution**
- Stop sequence, navigation handoff, ETA, call customer, receiver verification, real camera/signature/GPS/time capture, and proof upload.

**Batch R6.3: durable offline**
- Encrypted persistent queue, retry/backoff, stable idempotency keys, conflict handling, sync visibility, and recovery after app restart.

**Batch R6.4: line-level exceptions**
- Partial delivery, exact SKU returns, damage/rejection reason, reschedule, reverse logistics, crates, collections, and credit-note trigger.

**Exit gate:** kill-and-relaunch offline test preserves events; duplicate proof cannot double-apply; mixed-SKU return updates the correct lines and finance records.

### Phase R7 - Communications, support, documents, and ERP

**Batch R7.1: provider-backed communication**
- MSG91 OTP/SMS/WhatsApp, Resend email, and FCM push adapters; consent, templates, delivery receipts, opt-out, retry, and dead-letter queue.

**Batch R7.2: support and disputes**
- Customer tickets, SLA, assignment, conversation, attachments, order links, mandatory resolution, reopen, escalation, and CSAT.

**Batch R7.3: invoices and reports**
- Generate real GST PDF invoices, credit notes, statements, CSV/XLSX management reports, signed downloads, retention, and access logs.

**Batch R7.4: Vasy integration**
- Credential/config screen, field mappings, transactional outbox, push/pull jobs, retries, reconciliation, dead-letter handling, and manual repair.

**Exit gate:** provider sandbox messages have receipts; real files download; ERP failures remain visible and recoverable without false success.

### Phase R8 - Admin products and management intelligence

**Batch R8.1: Flutter admin app**
- Mobile approvals, application review, order exceptions, product availability, production alerts, delivery exceptions, credit holds, returns, and notifications.

**Batch R8.2: desktop super-admin consolidation**
- Remove the Vite mock, split the Next.js monolith, fix RBAC/dead CTAs/accessibility, and provide authoritative navigation and deep links.

**Batch R8.3: analytics**
- Transaction-derived KPIs for revenue, margin, waste, OTIF, fill rate, returns, ageing, collections, customer/branch/SKU/route, and cohort retention.

**Batch R8.4: audit and governance**
- Immutable audit trail, before/after values, actor/device/reason, export, retention, privileged-action alerts, and maker-checker policies.

**Exit gate:** every admin action has a working UI, authorized API, durable record, audit event, and automated test; no duplicate admin product remains.

### Phase R9 - Release certification

**Batch R9.1: automated quality**
- Unit, integration, contract, widget/component, end-to-end, migration, offline, and provider sandbox suites.

**Batch R9.2: non-functional testing**
- Load/concurrency, soak, backup/restore, failover, security/OWASP, dependency, accessibility, responsive, low-network, and low-end device tests.

**Batch R9.3: operations readiness**
- Staging/prod separation, deployment pipelines, feature flags, monitoring, alerts, runbooks, incident response, support ownership, privacy policy, terms, and data retention.

**Batch R9.4: bakery pilot**
- Shadow one real bakery day without financial posting, reconcile all orders/batches/routes/returns manually, then run a limited live pilot with rollback criteria.

**Exit gate:** zero open Critical/High defects; backup restore and rollback pass; pilot reconciliation is exact; owner signs off workflow by workflow.

## Required phase-gate routine

For every batch:

1. Product owner writes acceptance examples and failure cases.
2. Engineer implements database migration, policy, service, API, UI, audit event, and telemetry together.
3. Automated tests cover success, authorization, validation, duplicate/retry, concurrency where applicable, and restart/recovery.
4. UI/UX review checks brand consistency, empty/loading/error/offline states, responsiveness, accessibility, and truthful copy.
5. QC runs builds, tests, provider sandbox checks, security checks, and exploratory workflow testing.
6. Advisor reviews business risk, accounting/operational consequences, and pilot readiness.
7. Fixes are applied and the full gate reruns.
8. Batch is marked done only with evidence links; compilation alone is never completion.

## First implementation sequence

The next build loop should execute only these items first:

1. R0.1 secrets/config containment.
2. R0.2 truthful capability labelling and duplicate-admin decision.
3. R0.3 CI and test harness.
4. R1.1 managed PostgreSQL schema/migrations.
5. R1.2 auth and tenant isolation.
6. R2.1 pending onboarding state machine.
7. R2.2 real document upload adapter with local development storage until R2/S3 credentials are available.

This sequence closes the most dangerous holes before adding more visible features.
