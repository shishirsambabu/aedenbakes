# Phase 5 Deployment Checklist

Use this checklist to wire the deployment stack without guessing.

## Accounts To Create

Create these accounts in this order:

1. Neon
2. Render
3. Vercel
4. Cloudflare

## What Each Service Is For

- Neon: remote Postgres for the API
- Render: API hosting
- Vercel: super-admin portal
- Cloudflare: DNS and later R2

## What To Paste In Each Place

### 1) `services/api/.env`

Paste this for local development:

```env
PORT=4000
DATABASE_URL=./data/aeden-bakes.sqlite
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=replace-with-a-long-random-secret
SESSION_SECRET=replace-with-a-different-long-random-secret
ENABLE_DEMO_ACCOUNTS=true
EXPOSE_OTP_DEBUG_CODE=true
VASY_API_BASE_URL=
VASY_API_KEY=
VASY_WEBHOOK_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

When you move the API to production, replace `DATABASE_URL` with the Neon connection string.

### 2) `apps/web/super-admin/.env.local`

Paste this for local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_APP_NAME=Aeden Bakes
```

For production, change the API base URL to the deployed API URL.

### 3) Flutter build time

Use this for each mobile app when you build for a real environment:

```text
--dart-define=API_BASE_URL=https://api.your-domain.com
```

## What Can Stay Blank For Now

These can stay blank until the later integration batch:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `VASY_API_BASE_URL`
- `VASY_API_KEY`
- `VASY_WEBHOOK_SECRET`
- `ENABLE_DEMO_ACCOUNTS`
- `EXPOSE_OTP_DEBUG_CODE`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

## Batch 5.1 Exit Check

Before we call Batch 5.1 done:

- the Render blueprint is committed
- the Flutter apps accept a deployment API URL
- the web portal accepts a deployment API URL
- the release check script runs cleanly
- the checklist is complete enough to hand to the client or operator
