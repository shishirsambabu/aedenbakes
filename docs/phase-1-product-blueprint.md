# Phase 1 Product Blueprint

## Purpose
Phase 1 ships a bakery production-capacity ERP loop for wholesale customers:

- customers book against real product capacity for `today` and `tomorrow`
- each order is tied to a delivery slot and payment mode
- confirmed tomorrow orders roll into a production sheet grouped by item and slot
- order status moves through a simple linear fulfillment flow
- receivables risk is visible enough to block or warn accounts before more credit is extended

## Operating Rules
- Capacity is booked against a product-day, not shelf inventory.
- `Tomorrow` is the primary planning horizon.
- Order confirmation is the reservation point for both product capacity and delivery slot capacity.
- Cutoffs are enforced before booking, not after baking.
- Status transitions are linear; phase 1 does not support arbitrary jumps.
- All admin overrides are auditable.

## Exact Modules

| Module | Responsibility | Primary Data Owned | Notes |
| --- | --- | --- | --- |
| Catalog and Capacity | Show products, prices, cutoffs, and remaining capacity for `today` or `tomorrow` | `products`, `product_day_capacity` | Customer sees real remaining units, not a fake availability flag |
| Cart and Checkout | Build cart, choose payment mode, confirm order | `orders`, `order_items`, `idempotency_keys` | Supports `prepaid`, `part-pay`, and `credit` |
| Delivery Slot Planner | Maintain route windows and slot fill limits | `delivery_slots` | Slots are capped per route and date |
| Order Service | Create confirmed orders and attach slot, service date, and payment mode | `orders`, `order_items` | Enforces all booking rules at commit time |
| Production Sheet Builder | Aggregate tomorrow orders into item totals and slot splits | `production_batches`, `production_batch_lines` | Output is the baker-facing working list |
| Fulfillment Status Flow | Move orders from confirmed to delivered in sequence | `orders`, `order_status_history` | No direct jump to later states |
| Accounts and Ledger | Track outstanding balances, due dates, and account risk | `customers`, `account_ledger_entries` | Risk state lives on `customers` and is driven by ledger aging |
| Admin Capacity Control | Raise or reduce tomorrow capacity when the bakery changes plan | `capacity_adjustments` | Only for authorized roles |
| Audit and Events | Record every important change | `audit_events` | Required for overrides, status moves, and capacity edits |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Change global policies, override capacity, approve exceptions, inspect all data | Nothing in phase 1 is blocked from owner visibility |
| `manager` | Edit product and slot plans, review orders, approve operational overrides | Cannot silently rewrite ledger history |
| `production` | Read the production sheet, mark baking progress, reconcile counts | Cannot edit pricing or customer credit |
| `delivery` | Advance orders through dispatch and delivery states, view slot loads | Cannot change production quantities |
| `accounts` | Update receivables, risk states, and credit holds | Cannot alter fulfillment history |
| `customer` | Browse capacity, build cart, place order, choose payment mode and slot | Cannot bypass capacity or cutoff rules |

## State Machines

### Order State
`Draft` is a client-side cart state only. Persisted orders use this flow:

`Confirmed` -> `In production` -> `Out for delivery` -> `Delivered`

Rules:
- `Confirmed` is only valid if product capacity and slot capacity both pass.
- `In production` means the order has been pulled into the bake plan.
- `Out for delivery` means the order has left the bakery.
- `Delivered` is terminal for phase 1.

### Product-Day Capacity State
`Open` -> `Throttled` -> `Closed`

Rules:
- `Open`: healthy remaining capacity
- `Throttled`: low remaining units or close to cutoff
- `Closed`: sold out, cutoff passed, or manually closed by an authorized role

### Delivery Slot State
`Open` -> `Nearly full` -> `Full` -> `Locked`

Rules:
- computed from `booked_orders / max_orders`
- `Locked` blocks further booking for that slot
- route capacity and order cutoff can both force `Locked`

### Account Risk State
`Healthy` -> `Watch` -> `Block soon` -> `Blocked`

Rules:
- driven by outstanding balance, aging, and manual review
- `Blocked` prevents new credit exposure and can block new orders if policy requires it

## Database Entities

| Entity | Key Fields | Invariants |
| --- | --- | --- |
| `products` | `id`, `name`, `category`, `unit_price`, `default_cutoff_time`, `badge`, `note`, `active` | Product names are stable; products are soft-disabled, not hard-deleted |
| `product_day_capacity` | `id`, `product_id`, `service_date`, `capacity`, `booked_quantity`, `status`, `version`, `updated_at` | `booked_quantity <= capacity`; every update is versioned |
| `delivery_slots` | `id`, `service_date`, `label`, `window_start`, `window_end`, `max_orders`, `booked_orders`, `status` | Slot counts cannot exceed `max_orders` |
| `customers` | `id`, `name`, `tier`, `credit_limit`, `outstanding_balance`, `due_date`, `risk_state` | Customer identity is shared by orders and ledger |
| `orders` | `id`, `customer_id`, `service_date`, `slot_id`, `payment_mode`, `status`, `amount_total`, `source`, `idempotency_key`, `created_at` | One confirmed order belongs to one service date and one slot |
| `order_items` | `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `line_total` | Item rows are immutable after confirm except by a controlled cancel/edit path |
| `order_status_history` | `id`, `order_id`, `from_status`, `to_status`, `actor_role`, `actor_id`, `changed_at` | Every fulfillment transition is append-only |
| `production_batches` | `id`, `service_date`, `status`, `generated_at`, `locked_at`, `printed_at` | One batch per service date in phase 1 |
| `production_batch_lines` | `id`, `batch_id`, `product_id`, `slot_id`, `quantity` | Derived only from confirmed tomorrow orders |
| `account_ledger_entries` | `id`, `customer_id`, `order_id`, `entry_type`, `amount`, `due_date`, `status`, `posted_at` | Ledger must balance to posted commercial activity |
| `capacity_adjustments` | `id`, `product_id`, `service_date`, `delta`, `reason`, `actor_id`, `created_at` | Every manual delta has a reason and actor |
| `audit_events` | `id`, `actor_role`, `actor_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at` | Required for overrides and status changes |
| `idempotency_keys` | `key`, `scope`, `request_hash`, `created_at` | Prevents duplicate confirm actions on retry |

## Batch Roadmap

### Batch 1: Master Data and Hard Capacity
Deliver:
- product catalog
- service-date capacity records
- delivery slots
- customer master data

Exit criteria:
- remaining capacity is visible per product-day
- slot counts cannot exceed route limits
- every seed row has a stable identifier

### Batch 2: Customer Order Flow
Deliver:
- cart build and removal
- payment mode choice
- slot selection
- order confirmation against live capacity

Exit criteria:
- one confirmation creates one order and one item set
- capacity and slot counts are decremented atomically
- duplicates are blocked by idempotency

### Batch 3: Production and Dispatch
Deliver:
- production sheet grouped by product and slot
- order status progression
- production board for the bakery team

Exit criteria:
- tomorrow orders roll into a deterministic sheet
- status cannot skip a step
- dispatch sees only the orders it needs

### Batch 4: Accounts and Operational Controls
Deliver:
- receivables view
- risk state updates
- credit hold rules
- admin capacity overrides with audit trails

Exit criteria:
- risky accounts are visible before more credit is extended
- capacity overrides never go negative
- every exception is traceable

## Phase 1 Boundaries
Not in phase 1:
- procurement planning
- raw-material inventory
- multi-warehouse routing
- automated payment collection
- full POS replacement

Phase 1 should stay focused on the bakery day: take the order, protect capacity, bake the right quantities, deliver on the right slot, and keep receivables controlled.
