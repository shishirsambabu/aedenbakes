# Aeden Bakes Workspace Plan

Phase 1 is about setting the repo shape so each product surface can move forward without colliding with the current prototype assets.

## What stays as-is

- The existing prototype files in the repo root remain untouched.
- The current demo artifacts can continue to serve as reference material while the new workspace is assembled.

## Planned workspace layout

```text
/
├─ apps/
│  ├─ mobile/
│  │  ├─ customer/
│  │  ├─ production/
│  │  └─ delivery/
│  └─ web/
│     └─ super-admin/
├─ services/
│  ├─ api/
│  └─ worker/
└─ packages/
   └─ shared/
```

## Phase 1 intent

- `apps/mobile/customer`: customer-facing Flutter app.
- `apps/mobile/production`: kitchen and production workflow app.
- `apps/mobile/delivery`: delivery handoff and route workflow app.
- `apps/web/super-admin`: Next.js portal for administration and oversight.
- `services/api`: backend entrypoint for product data and workflow APIs.
- `services/worker`: background jobs, notifications, and async processing.
- `packages/shared`: shared types, helpers, and cross-app utilities.

## Handoff notes

- Flutter is installed and the three mobile app shells are now scaffolded under `apps/mobile/`.
- Android SDK support is present in the workspace, so mobile builds can be verified locally.
- A lightweight API skeleton now exists under `services/api`.
- Shared domain types now live under `packages/shared`.
- The root prototype files, including `Aeden_Bakes_App_Demo.html`, `Aeden_Bakes_App_Demo_v2.html`, and `Aeden_Bakes_App_Demo_v3.html`, can be used as visual/product references during migration.
- The skeleton is intentionally minimal so other workers can add implementation details without stepping on each other.
