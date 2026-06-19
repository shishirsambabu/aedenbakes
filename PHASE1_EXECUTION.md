# Phase 1 Execution Plan

This repo is moving from a demo into a bakery operations platform.

## Non-negotiable shape

- Flutter for customer, production, and delivery mobile apps
- Next.js web portal for super admin
- Backend as the source of truth for orders, production, delivery, ledger, and ERP sync
- Vasy ERP integration designed in from day one

## Phase 1 goal

Ship the operational core:

- customer ordering against capacity
- production planning and locking
- delivery execution and proof of delivery
- admin overrides with audit trail
- basic ERP sync contract

## First batch

- Lock roles and permissions
- Lock order and production state machines
- Define core entities
- Define cutoffs and capacity rules
- Define Vasy sync objects and failure handling

## Phase 1 modules

- Customer ordering
- Production board
- Delivery manifest
- Super admin control panel
- Audit log
- Sync queue

## Weird situations to design for

- post-cutoff edits
- partial fulfillment
- shortages and waste
- returns and credit notes
- duplicate sync attempts
- offline delivery updates
- admin overrides

## Build rule

Do not treat this like a storefront app. The core object is the production batch, not the product catalog.
