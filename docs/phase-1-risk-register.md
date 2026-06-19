# Phase 1 Risk Register

| Scenario | What Can Go Wrong | Guardrail | Signal / Test |
| --- | --- | --- | --- |
| Two users confirm the last units at the same time | Oversell on a product-day or slot | Re-read capacity at commit time and reserve with versioned rows or a lock | Concurrent confirm test must end with one success and one rejection |
| Admin reduces tomorrow capacity below what is already booked | Negative availability or broken production plan | Disallow capacity below booked quantity unless an explicit exception workflow is used | Capacity edit test must fail when booked exceeds proposed capacity |
| Clock crosses cutoff while a cart is still open | Order sneaks in after the bake window | Use server time only and re-check cutoff at confirmation | Cutoff test must reject late confirms even if the page is stale |
| Slot fill is updated, but the order save path does not check it | Route becomes overbooked | Slot capacity must be validated in the same transaction as the order | Slot-overbook test must reject the overflow order |
| User double-clicks confirm or retries after a network hiccup | Duplicate order and duplicate reservation | Require an idempotency key for confirm | Repeat-submission test must create one order only |
| Product master is changed after orders are already confirmed | Production sheet and order lines drift apart | Freeze order lines at confirm time and use soft edits only | Product-edit test must not mutate historical orders |
| Production sheet is printed from stale data | Bakers work from a sheet that misses late orders | Version the batch, timestamp the print, and force refresh on every confirm or capacity edit | Sheet-version test must detect stale prints |
| Order status is advanced out of order | Delivery board no longer matches reality | Validate linear transitions only | Status-jump test must reject skipping steps |
| Ledger shows healthy while a customer is actually risky | Credit gets extended too far | Drive risk from posted ledger entries, not from remembered state | Aging test must move accounts to warning states on schedule |
| A customer keeps a cart open overnight | They see capacity that no longer exists | Re-check availability on confirm and expire stale carts by service date | Overnight-cart test must fail safely |
| A service date is interpreted in the wrong timezone | Orders land on the wrong day | Store and compare service dates in one canonical bakery timezone | Timezone test must show consistent cutoff behavior |
| Manual override is done without a reason | No audit trail for later review | Require reason text and actor identity on every override | Audit test must block blank override reasons |

## Guardrail Rules
- Never let booked quantity exceed capacity.
- Never let a slot exceed max orders.
- Never let an order skip a state.
- Never trust client time for cutoff decisions.
- Never mutate historical order lines after confirmation.
- Never allow manual overrides without an audit event.
- Never print or dispatch from an unversioned production sheet.
- Never let credit risk be inferred from stale UI state alone.

## Operational Triage
- If the problem is capacity-related, freeze booking first.
- If the problem is status-related, freeze dispatch next.
- If the problem is ledger-related, block new credit until the ledger is reconciled.
- If the problem is data drift, regenerate the production sheet from source orders before release.
