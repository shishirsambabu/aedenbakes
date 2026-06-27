# Recovery R0 Phase Gate

Date: 2026-06-21

Status: **conditional pass - credential rotation required**

## Delivered

- All `.env` files and local Codex screenshots are ignored by Git.
- The committed runtime snapshot containing passwords and session tokens was removed.
- A safe `.env.example` documents configuration without secrets.
- The API now loads its local `.env` explicitly.
- Production startup fails closed while secure authentication R1 is incomplete or required configuration is missing.
- Debug OTP and demo accounts cannot be enabled in production.
- CORS is restricted to configured origins and request JSON is size-limited.
- Health output no longer leaks filesystem paths or session counts.
- Local health verification reports MSG91 configured, Vasy not configured, and onboarding recovery mode disabled.
- Unsafe self-activating onboarding is disabled by default.
- External notifications remain queued instead of falsely reporting delivery.
- Vasy routes return unavailable/not-implemented instead of simulated success.
- Storage reports metadata-only instead of implying uploads exist.
- Customer UI distinguishes GSTIN format checking from GSTN/admin verification and labels local document placeholders honestly.
- Delivery UI visibly warns when live route data cannot be verified.
- Capability truth is recorded in `docs/capability-traceability.md`.
- GitHub Actions quality gates now cover API tests/audit, web builds/lint/audit, all Flutter analyzers/tests, and secret scanning.

## Verification evidence

- API build and seven runtime smoke tests: pass.
- Root Vite build: pass.
- Next.js super-admin production build: pass.
- Customer Flutter analyze and test: pass.
- Production Flutter analyze and test: pass.
- Delivery Flutter analyze and test: pass with zero warnings.
- API and root production dependency audits at high severity: pass.
- Tracked MSG91 secret pattern scan: zero matches.
- Isolated runtime loaded `.env` and reported `otpProvider: msg91`.

## Open gate items

1. Rotate the MSG91 auth key and mobile SDK token because both were pasted into the conversation. Update only the ignored local `.env` and private deployment secrets afterward.
2. Push the branch to GitHub so the new workflow runs in the hosted environment.

## Known carryovers

- Super-admin lint succeeds with 54 warnings. These identify unreachable controls and dead state and remain scheduled for R8 consolidation.
- `npm audit` reports a moderate PostCSS advisory through the current Next.js dependency. Resolve during the next dependency-hardening batch without accepting an unsafe major downgrade.
- Password hashing, normalized PostgreSQL data, tenant isolation, and secure sessions are R1 work. Production is intentionally blocked until they exist.
- Real pending onboarding and object uploads are R2 work. Customer activation is intentionally blocked until they exist.

## Gate decision

R1 implementation may begin locally, but no deployment or customer onboarding is approved until the MSG91 credentials are rotated and R1 security tests pass.
