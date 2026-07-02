# Recovery R2.2 Document Storage Batch Gate

Date: 2026-06-29

Batch status: **pass** (R2.2 real document storage - local adapter)

Overall R2 status: **in progress - R2/S3 cloud adapter and KYC review depth remain**

## Context

KYC and document upload were simulated: the API stored metadata only and the
download endpoint returned JSON, never a file. The audit flagged this as a
High gap (no real GST/FSSAI/cheque evidence to review).

## Delivered

- `src/storage.ts`: a filesystem-backed `LocalObjectStorage` adapter with
  path-traversal-safe keys, plus `validateDocumentUpload` (base64 decode,
  size ceiling, magic-byte MIME detection with declared-type cross-check) and
  a SHA-256 checksum. This is the local development storage the recovery plan
  calls for until R2/S3 credentials are supplied.
- Real byte upload:
  - `POST /documents` (staff) accepts optional `contentBase64`; without bytes
    the record is an honest `draft` placeholder, with bytes it becomes
    `uploaded` and records checksum, size, and detected MIME type.
  - `POST /customer/documents` (customer) uploads the customer's own KYC bytes,
    scoped to their account.
- `GET /documents/:id/content` streams the real stored bytes with an
  ownership guard, an access-log entry, and an `x-checksum-sha256` header;
  returns 409 when only metadata exists.
- `POST /documents/:id/verify` now refuses to verify a document with no stored
  content; `POST /documents/:id/reject` records a required rejection reason.
- `/storage/status` reports the local adapter truthfully (mode `local`,
  `uploadStorageEnabled: true`, allowed MIME types, and the size limit)
  instead of claiming metadata-only.
- Uploads directory is git-ignored.

## Verification

- API build: pass. API tests: 48 pass, 0 fail (12 new).
- Unit tests: MIME detection, upload validation (empty/unrecognized/mismatched/
  oversized), extension mapping, and storage round-trip plus path-traversal
  safety.
- HTTP tests: real-byte upload with checksum and content round-trip; rejection
  of unrecognized content; metadata-only documents have no content and cannot
  be verified; verify/reject transitions; customer self-upload with
  cross-customer content access denied; stored bytes survive an API restart.

## Remaining R2 work

1. R2/S3 (Cloudflare R2) object-storage adapter and signed upload/download
   URLs for production, selected by configuration.
2. KYC review depth: wire document verify/reject and re-upload into the
   application review flow and the admin surfaces; maker-checker on credit.
3. Antivirus/malware scanning at the `validateDocumentUpload` hook.
4. R2.3 customer session continuity in the Flutter apps.

## Gate decision

R2.2 local storage passes. Uploaded documents are now real, checksummed,
ownership-guarded files rather than metadata. Production still requires the R2
cloud adapter and the R1 managed-PostgreSQL cutover.
