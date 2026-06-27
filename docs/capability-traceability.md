# Capability Traceability

This file is the release truth source during the recovery program. A capability is `real` only when its UI, authorization, persistence, external side effect where applicable, audit event, and automated tests all work.

| Capability | Current state | Release wording | Recovery phase |
| --- | --- | --- | --- |
| Password authentication | Recovery implementation | Salted scrypt hashes in normalized identity storage; production cutover awaits PostgreSQL | R1 |
| Staff/customer sessions | Recovery implementation | 256-bit bearer tokens with token hashes at rest; sessions expire on API restart until refresh rotation is built | R1, R2 |
| Tenant authorization | Partial | Known branch and document cross-tenant leaks are closed; full policy coverage remains in progress | R1, R3 |
| Customer OTP | Partial | MSG91-capable; runtime configuration and live provider test required | R0, R2 |
| Customer onboarding | Unsafe prototype | Application intake prototype; does not represent approved activation | R2 |
| GST/FSSAI/cheque upload | Simulated | Document metadata only; files are not uploaded | R2 |
| Customer approval | Partial | Admin decision screens exist; activation boundary is not enforced | R2 |
| Customer session restore | Absent | Session is not retained after relaunch | R2 |
| Branch management | Partial | Branch records exist; approval and tenant guards are incomplete | R3 |
| Customer roles/approvals | Partial | Role records exist; end-to-end enforcement is incomplete | R3 |
| Catalog and pricing | Partial | Prototype catalog with server data; commercial rules need hardening | R3 |
| Cart and checkout | Partial | Order request only; no payment settlement | R4 |
| Capacity reservation | Unsafe prototype | Calculated counters, not atomic reservation | R4 |
| Credit controls | Partial | Limit checks exist; no authoritative ledger/reconciliation | R4 |
| Payments/refunds | Absent | No payment provider connected | R4 |
| Standing orders | Partial | Basic records and controls; calendar and approval integrity incomplete | R4 |
| Substitutions | Partial | Rules/events exist; customer decision flow incomplete | R4 |
| Production batches | Partial | Batch status controls exist; no recipe, inventory, QC, or traceability | R5 |
| Delivery manifests | Partial | Route records exist; transition guards are incomplete | R6 |
| POD/photo/signature | Simulated | Typed metadata only; no trusted media capture | R6 |
| Offline delivery sync | Unsafe prototype | Memory queue only; restart loses actions | R6 |
| Returns | Unsafe prototype | Order-level prototype; mixed-SKU returns are incorrect | R6 |
| WhatsApp/SMS/email/push | Simulated | External messages remain queued; no provider delivery occurs | R7 |
| Support tickets | Partial | Case records exist; resolution and evidence rules incomplete | R7 |
| Documents/invoices | Simulated | Metadata/JSON only; no downloadable legal files | R7 |
| Vasy ERP | Absent | Contract preview only; sync endpoints return unavailable/not implemented | R7 |
| Flutter admin app | Absent | Not built | R8 |
| Next.js super-admin | Partial | Broad prototype with dead controls and no automated UI tests | R8 |
| Root Vite admin/customer demo | Mock | Internal reference only; scheduled for removal after consolidation | R8 |
| Analytics | Partial | Derived prototype metrics; not finance-certified | R8 |
| Production deployment | Blocked by design | API refuses production startup until secure PostgreSQL authentication cutover is complete | R1, R9 |
