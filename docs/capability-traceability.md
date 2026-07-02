# Capability Traceability

This file is the release truth source during the recovery program. A capability is `real` only when its UI, authorization, persistence, external side effect where applicable, audit event, and automated tests all work.

| Capability | Current state | Release wording | Recovery phase |
| --- | --- | --- | --- |
| Password authentication | Recovery implementation | Salted scrypt hashes in normalized identity storage; production cutover awaits PostgreSQL | R1 |
| Staff/customer sessions | Recovery implementation | 256-bit access tokens (hashed at rest) plus persistent rotating refresh tokens with replay detection, device-session listing/revocation, and authenticated password change; refresh tokens survive API restart; full forgot-password reset still awaits R7 email/OTP | R1, R2 |
| Tenant authorization | Recovery implementation | Central policy module is the single source of truth for role, permission, and cross-tenant checks; a route-level authorization test matrix covers anonymous, wrong-role, permission-gated, and cross-tenant denials with positive controls | R1, R3 |
| Production seed hygiene | Recovery implementation | Demo staff and demo customer logins (hardcoded passwords) are seeded only when demo accounts are enabled; a fresh production database seeds a single owner from BOOTSTRAP_OWNER_USERNAME/PASSWORD instead. Persisted principals load regardless of the demo flag | R1 |
| Customer OTP | Recovery implementation | MSG91 configured and enabled (health reports otpProvider: msg91); real SMS send/verify not yet exercised end to end with a live handset | R0, R2 |
| Customer onboarding | Recovery implementation | Public intake creates only an application; no customer, branch, login, or session exists until admin approval. Real document upload still pending (R2.2) | R2 |
| GST/FSSAI/cheque upload | Recovery implementation | Real byte upload to local object storage with SHA-256 checksum, MIME/size validation, ownership-guarded content download, and admin verify/reject; R2/S3 cloud adapter still pending | R2 |
| Customer approval | Recovery implementation | Admin approval is the only activation path; commercial terms (tier, credit limit) are admin-set, not applicant-supplied; approval is blocked until all mandatory KYC documents (GST, FSSAI, cheque) are attached and verified, then creates the customer, branch, account user, and login and re-keys the KYC documents. Maker-checker credit approval still pending | R2 |
| Customer session restore | Absent | Session is not retained after relaunch | R2 |
| Branch management | Recovery implementation | Customer-requested branches start pending_approval and cannot be ordered against; staff drive a guarded approval/suspension state machine (pending -> active -> paused/service_hold/closed) with role and tenant guards. Branch-level GST/PO settings still pending | R3 |
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
| Managed PostgreSQL runtime | Recovery implementation | When DATABASE_URL is postgres, the app-state snapshot, auth principals, and refresh sessions all persist to managed PostgreSQL (verified live against Supabase), so business data and logins survive redeploys. Access tokens stay local/ephemeral by design. Single-instance snapshot model until the normalized-table rewrite | R1 |
| Production deployment | Config-gated | API boots in production only with a managed PostgreSQL DATABASE_URL, configured CORS, and MSG91; the R1 durable cutover (snapshot + identity) is complete. Full production certification (load, backup/restore, R1.5 authorization coverage) remains R9 | R1, R9 |
