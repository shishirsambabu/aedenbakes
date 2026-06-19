# Phase 6 Product Blueprint

## Purpose

Phase 6 turns Aeden Bakes into a real multi-branch B2B customer platform.

This phase adds the customer hierarchy that wholesale operations need in the real world:

- one customer account can have many branches
- one branch can have many users
- each user can have a different permission level
- ordering, approvals, and serviceability can be branch-aware
- support and operations can see the correct location context

Without this phase, the product still behaves too much like a single-account ordering app.

## Operating Rules

- A customer account is not the same thing as a branch.
- A branch is not the same thing as a user.
- Branch-level serviceability must be checked before order actions.
- Customer-side approvals must be explicit and auditable.
- A customer admin can manage their own account, but not bypass platform controls.
- Roles must be scoped so one outlet cannot silently control another outlet.
- Branch notes and delivery instructions must be visible to the right teams.

## Exact Screens

### Super Admin Portal

1. Customer list
2. Customer detail
3. Branch detail
4. Branch user management
5. Approval rules
6. Branch serviceability editor
7. Account setup wizard

### Customer App / Customer Portal

1. Account home
2. Branch selector
3. Branch list
4. Branch detail
5. Invite user
6. Role and permission view
7. Approval inbox
8. Branch notes and delivery instructions

### Support / Operations Views

1. Customer 360 entry point
2. Branch context panel
3. Serviceability status panel
4. Approval review panel

## Exact Modules

| Module | Responsibility | Notes |
| --- | --- | --- |
| Customer Hierarchy | Represent one account with many branches | This becomes the parent model for all future customer features |
| Branch Management | Add, edit, pause, and close branches | Branches own addresses, delivery notes, and serviceability |
| Customer User Management | Add users to an account or branch | Supports admin, accountant, buyer, store manager, and viewer-style roles |
| Branch Serviceability | Decide whether a branch can order on a given day | Must consider zone, cutoff, blocked status, and account health |
| Customer Approval Matrix | Control risky customer-side actions | Used for branch creation, address changes, recurring order changes, and credit-impacting actions |
| Account Context Panel | Show the full account structure to support and super-admin teams | Helps staff avoid acting on the wrong branch |
| Branch Notes and Preferences | Store instructions specific to a branch | Delivery notes, packaging notes, gate instructions, contact preferences |

## Exact Roles

| Role | Can Do | Cannot Do |
| --- | --- | --- |
| `owner` | Full access across all customers and branches | Nothing is hidden |
| `super_admin` | Create customers, branches, and customer users | Cannot bypass audit rules |
| `manager` | Review accounts, approve changes, inspect hierarchy | Cannot silently modify history |
| `accounts` | Review credit-impacting actions and account structure | Cannot change delivery history |
| `support` | View account context and help resolve branch issues | Cannot approve risky actions |
| `customer_admin` | Manage branches, invite users, review approvals | Cannot bypass commercial controls |
| `customer_user` | Place orders, view branch data, raise requests for assigned scope | Cannot edit account-level controls |

## State Machines

### Customer Account State

`active -> restricted -> blocked -> closed`

Rules:
- `active` means the account can operate normally.
- `restricted` means some actions are limited because of risk or policy.
- `blocked` means high-risk actions are stopped.
- `closed` means the account is no longer active.

### Branch State

`active -> paused -> service_hold -> closed`

Rules:
- `active` means the branch can order and receive service.
- `paused` means the branch is temporarily not taking new orders.
- `service_hold` means the branch is blocked because of operations, credit, or service issues.
- `closed` means the branch is no longer operational.

### Customer User Invitation State

`draft -> sent -> accepted -> active -> revoked`

Rules:
- invitations must be tied to a branch or account scope
- accepted invites create a usable user membership
- revoked invites must not remain usable

### Customer Approval Request State

`draft -> submitted -> approved -> applied`

Failure branch:
- `rejected`

Rules:
- branch creation, branch edits, and other risky actions may require approval
- applied approvals must be auditable

## Exact Database Tables

| Table | Key Fields | Invariants |
| --- | --- | --- |
| `customers` | `id`, `name`, `tier`, `status`, `credit_limit`, `risk_state`, `created_at` | One master row per business customer |
| `customer_branches` | `id`, `customer_id`, `name`, `code`, `status`, `service_zone`, `created_at`, `updated_at` | A branch belongs to exactly one customer |
| `customer_users` | `id`, `customer_id`, `branch_id`, `user_id`, `role`, `status`, `created_at` | A user membership must be scoped correctly |
| `branch_roles` | `id`, `code`, `name`, `description` | Defines customer-facing roles |
| `branch_permissions` | `id`, `branch_role_id`, `permission_code` | Maps branch roles to allowed actions |
| `branch_serviceability` | `id`, `branch_id`, `service_date`, `status`, `reason`, `created_at` | Branch serviceability must be explainable |
| `branch_notes` | `id`, `branch_id`, `note_type`, `note`, `created_by`, `created_at` | Notes are append-only |
| `approval_rules` | `id`, `rule_code`, `target_type`, `threshold_json`, `active`, `created_at` | Approval triggers must be explicit |
| `approvals` | `id`, `action`, `target_type`, `target_id`, `status`, `reason`, `requested_by`, `decided_by`, `created_at`, `decided_at` | Approval outcomes are auditable |
| `saved_addresses` | `id`, `customer_id`, `branch_id`, `label`, `address_line`, `delivery_zone`, `active` | Address records must remain branch-aware |
| `audit_events` | `id`, `actor_role`, `actor_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at` | All risky actions must leave a trail |

## API Routes

### Customer Hierarchy

- `GET /customers`
- `GET /customers/:id`
- `POST /customers`
- `PATCH /customers/:id`

### Branches

- `GET /customers/:id/branches`
- `POST /customers/:id/branches`
- `PATCH /branches/:branchId`
- `POST /branches/:branchId/pause`
- `POST /branches/:branchId/reopen`
- `POST /branches/:branchId/close`

### Customer Users

- `GET /customers/:id/users`
- `POST /customers/:id/users/invite`
- `POST /customer-users/:userId/accept`
- `PATCH /customer-users/:userId`
- `POST /customer-users/:userId/revoke`

### Branch Permissions and Approvals

- `GET /branch-roles`
- `GET /approval-rules`
- `POST /approval-rules`
- `POST /approvals`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`

### Branch Serviceability

- `GET /branches/:branchId/serviceability`
- `POST /branches/:branchId/serviceability/check`

### Branch Notes

- `GET /branches/:branchId/notes`
- `POST /branches/:branchId/notes`

## Build Batches

### Batch 6.1: Customer Hierarchy

Deliver:
- customer master view
- branch creation and editing
- branch list and branch detail
- account-to-branch relationship model

Exit criteria:
- one customer can have many branches
- every branch belongs to one customer
- branch status can be changed safely

### Batch 6.2: Customer Users And Permissions

Deliver:
- customer-side user invitation
- branch-scoped roles
- role/permission matrix
- invite accept and revoke flow

Exit criteria:
- users can be invited and assigned safely
- revoked users cannot continue acting
- branch scope is enforced

### Batch 6.3: Branch Serviceability

Deliver:
- serviceability checks
- branch notes
- delivery instructions
- branch status warnings

Exit criteria:
- branch ordering can be blocked when service is not available
- support and super-admin can see why
- serviceability is visible before order capture

### Batch 6.4: Customer Approval Matrix

Deliver:
- approval rules
- approval inbox
- request/approve/reject flow
- audit logging for all decisions

Exit criteria:
- risky customer-side actions are gated
- approvals are auditable
- rejected actions do not partially apply

## UI/UX Direction

Phase 6 should keep the same brown/gold bakery language already used across the product.

The screens should feel like:

- calm
- operational
- premium
- trustable
- clearly structured

Avoid:

- mockup-only visuals
- generic blue SaaS styling
- loose marketing language
- consumer-shopping patterns

## Acceptance Criteria

Phase 6 is complete only when all of these are true:

- customer accounts support multiple branches
- branches support multiple users
- roles are explicit and scoped
- branch-level serviceability works
- approvals are available for risky actions
- the build passes for all affected apps
- QC and Visual QA sign off

## Phase 6 Boundaries

Not in Phase 6:

- standing order recurrence logic
- substitutions
- credit scoring expansion
- WhatsApp and SMS delivery
- support ticketing redesign
- analytics expansion

Those are the next phases.
