# Aeden Bakes

Bakery operations platform in progress.

## Current shape

- Root prototype: concept/demo UI that is still preserved as reference material
- Phase 1 workspace: defined in [WORKSPACE_PLAN.md](/D:/Aeden%20Bakes/WORKSPACE_PLAN.md)
- Phase 1 execution note: [PHASE1_EXECUTION.md](/D:/Aeden%20Bakes/PHASE1_EXECUTION.md)
- Product blueprint: [docs/phase-1-product-blueprint.md](/D:/Aeden%20Bakes/docs/phase-1-product-blueprint.md)
- Phase 2 blueprint: [docs/phase-2-product-blueprint.md](/D:/Aeden%20Bakes/docs/phase-2-product-blueprint.md)
- Phase 3 blueprint: [docs/phase-3-product-blueprint.md](/D:/Aeden%20Bakes/docs/phase-3-product-blueprint.md)
- Risk register: [docs/phase-1-risk-register.md](/D:/Aeden%20Bakes/docs/phase-1-risk-register.md)
- Flutter mobile shells: `apps/mobile/customer`, `apps/mobile/production`, `apps/mobile/delivery`
- Web super-admin shell: `apps/web/super-admin`
- API skeleton: `services/api`
- Shared domain package: `packages/shared`

## Planned surfaces

- Flutter customer app
- Flutter production app
- Flutter delivery app
- Next.js super-admin portal
- API and worker services

## Phase 1 focus

- capacity-aware ordering
- production sheet generation
- delivery execution
- admin overrides with audit trail
- ERP sync foundation

## Verification

- Flutter toolchain installed and verified
- Android SDK installed and verified
- Flutter mobile shells build for web
- Super-admin web shell builds successfully
- API health and catalog endpoints respond locally

## Local Run

Use separate terminals for each surface.

1. Start the API:

```powershell
Set-Location 'D:\Aeden Bakes\services\api'
npm run dev
```

2. Start the customer app:

```powershell
Set-Location 'D:\Aeden Bakes\apps\mobile\customer'
C:\src\flutter\flutter\bin\flutter.bat run -d chrome
```

3. Start the production app:

```powershell
Set-Location 'D:\Aeden Bakes\apps\mobile\production'
C:\src\flutter\flutter\bin\flutter.bat run -d chrome
```

4. Start the delivery app:

```powershell
Set-Location 'D:\Aeden Bakes\apps\mobile\delivery'
C:\src\flutter\flutter\bin\flutter.bat run -d chrome
```

5. Start the super-admin portal:

```powershell
Set-Location 'D:\Aeden Bakes\apps\web\super-admin'
npm run dev
```

Notes:
- The API listens on `http://127.0.0.1:4000`.
- The Flutter apps are wired to the local API by default.
- If you change the API host, rebuild or run the Flutter apps with `API_BASE_URL` set appropriately.
