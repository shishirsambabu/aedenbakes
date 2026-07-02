# Recovery R2 Onboarding Batch Gate

Date: 2026-06-29

Batch status: **pass** (R2.1 application state machine)

Overall R2 status: **in progress - real document upload (R2.2) and KYC review depth remain**

## Context

The audit's #1 Critical finding was that public onboarding self-activated a
customer, branch, admin user, and session before any review, and accepted
client-supplied commercial tier and credit limit. The self-activating
`/customer/onboard` path was disabled during R0 (returns 503), but the
applications surface that remained was display-only: approving an application
merely flipped a status string and created nothing.

## Delivered

- Public `POST /customer/applications` intake that creates **only** an
  application record. It never creates a customer, branch, login, or session,
  and it captures applicant-requested credit as an unverified note only.
- Per-client/login submission throttling on intake.
- Hardened `POST /admin/applications/:id/decide` state machine:
  - `approve` is the **only** activation path. It requires admin-set
    commercial terms (tier and a non-negative credit limit) supplied in the
    decision body; applicant-supplied terms are never applied. Activation
    creates the customer, primary branch, account user, and customer login,
    and returns the issued credentials.
  - `reject` and `request_more_info` require a reason/note.
  - Terminal states (approved+activated, rejected) cannot be re-decided;
    duplicate logins are blocked.
- Activation factored into `activateCustomerFromApplication` so terms flow
  from the admin decision, not the request payload.
- New application fields (loginId, phone, address, decision, activation refs)
  added to the persisted record; existing display seeds remain valid.

## Verification

- API build: pass. API tests: 36 pass, 0 fail (6 new).
- New tests assert: intake creates no customer/login/session; the applicant
  cannot log in pre-approval; applicant-supplied tier/credit are ignored and
  admin terms are applied; approval activates and the issued login works;
  approval requires terms; rejection requires a reason and is terminal;
  re-approval of an activated application is blocked; non-admins (anonymous
  and customer) cannot list or decide.

## Remaining R2 work

1. R2.2 real document storage: file picker, MIME/size checks, signed
   upload/download, checksums, replacement, rejection reason, retention.
2. KYC review depth: per-document review/verify, maker-checker credit
   approval, needs-information re-upload loop, and full audit history in the
   web and Flutter admin surfaces.
3. R2.3 customer session continuity in the apps (the API refresh-token
   foundation from R1 is in place; the Flutter clients must persist and use
   it).
4. OTP identity binding on intake when MSG91 is configured.

## KYC-gated activation addendum (2026-06-29, R2.4)

Batch status: **pass**

Delivered:

- `GET /admin/applications/:id` detail returns the application, its attached
  documents, and a KYC status summary (missing/unverified/satisfied).
- `POST /admin/applications/:id/documents` lets an admin attach real KYC
  document bytes to an application during review (reuses the R2.2 storage
  adapter), namespaced to the application until activation.
- Approval is now blocked with 422 unless every mandatory KYC document type
  (GST, FSSAI, cheque) is attached and verified. On activation the documents
  are re-keyed onto the new customer.

This closes the R2 exit-gate clause "a customer cannot activate without
approved KYC". Verified by a new test that walks no-docs (422) ->
attached-but-unverified (422) -> all-verified (approved), plus updates to the
existing activation tests to complete KYC first.

## Gate decision

R2.1 and R2.4 pass locally. Customer activation now has an enforced approval
boundary with server-controlled terms and mandatory verified KYC. Production
remains blocked pending the R1 managed-PostgreSQL cutover and the remaining R2
cloud-storage work.
