# Aeden Bakes QC Checklist

Use this checklist at the end of every phase before marking the phase complete.

## 1. Phase Inventory

- Confirm what the phase claims to add.
- List every touched surface:
  - API routes
  - state or database changes
  - Flutter apps
  - web portal
  - ERP sync
  - approval logic
  - offline sync logic

## 2. Build And Type Verification

- Build every affected app or service.
- Check for compile errors, missing imports, broken assumptions, and type drift.
- Run format and lint checks if available.
- Verify the app or service starts cleanly.

## 3. State Machine Audit

- Verify every workflow transition is explicit and legal.
- Block invalid transitions.
- Check rollback, unlock, and cancel paths.
- Check idempotency for repeated actions.
- Check duplicate-event handling.
- Verify approval thresholds fire at the correct boundaries.

## 4. Data Integrity Audit

- Confirm entities persist all required fields.
- Check snapshot, load, and replay consistency.
- Verify audit events are written for every risky action.
- Ensure no silent state loss after restart.
- Verify dedupe keys for offline events.
- Check referential consistency between customers, orders, batches, delivery events, and approvals.

## 5. Offline And Sync Audit

- Simulate disconnected delivery flow.
- Queue actions locally.
- Reconnect and confirm replay works exactly once.
- Verify duplicates are rejected or deduped safely.
- Verify failures remain visible.
- Check conflict handling if the server changed while offline.

## 6. Guardrail And Approval Audit

- Check whether risky admin actions require approval.
- Verify approval reasons are specific enough.
- Check note requirements, thresholds, and escalation logic.
- Confirm the approval inbox shows all pending items.
- Confirm approve and reject outcomes leave a complete audit trail.

## 7. ERP Sync Audit

- Verify contract mapping is stable.
- Check preview and push payloads.
- Validate failure handling, retry posture, and reconciliation behavior.
- Confirm ERP pushes do not mutate source records unexpectedly.
- Check whether sync status is persisted and visible in admin.

## 8. UI Failure-State Audit

For each app, verify:

- loading state
- empty state
- error state
- auth failure
- session expiry
- permission denied
- partial data
- offline mode
- retry behavior

## 9. Stress And Abuse Checks

- Rapid repeated clicks on critical actions.
- Duplicate submissions.
- Out-of-order sync events.
- Large order counts.
- Large batch counts.
- Long-running sessions.
- Restart during pending sync or approval states.

## 10. Report Format

Return findings in this shape:

- severity
- file path
- exact issue
- why it matters
- minimal fix recommendation
- test needed to prove the fix

Example:

- `High` - `[services/api/src/server.ts]` batch unlock can bypass lock ownership if session is stale. Fix: validate current owner before transition. Test: locked batch cannot be unlocked by non-owner.
- `Medium` - `[apps/mobile/delivery/lib/main.dart]` offline queue replay lacks visible retry state for rejected events. Fix: keep failed events pinned until manually cleared. Test: rejected payload remains visible after sync.

## 11. Exit Criteria

Phase complete only if:

- all builds pass
- no critical or high issues remain
- state transitions are safe
- offline replay is deterministic
- approvals are enforced correctly
- ERP sync is traceable
- user-facing failure states are covered

