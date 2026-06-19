# Phase 5 Deployment Stack

This is the production-oriented stack for Batch 5.1.

The goal is to keep the rollout cheap to start, easy to expand, and honest about what is live versus what is still demo-only.

## Recommended Stack

| Surface | Recommended Host | Why |
| --- | --- | --- |
| Customer web/mobile API | Render Web Service | Simple Node hosting, env vars, logs, rollback, and custom domains |
| Super-admin web portal | Vercel | Best fit for Next.js, env var support, preview deploys |
| Primary database | Neon Postgres | Free start, branchable, easy to grow into production |
| File/object storage | Cloudflare R2 | S3-style object storage for documents and exports |
| Monitoring/alerts | Host dashboards first, then external alerts later | Start with what the hosts already expose |
| DNS and domain control | Cloudflare | Easy DNS, SSL, and later edge routing |

## Why This Stack

- It lets us start on low-friction plans.
- It cleanly separates the web portal, API, database, and file storage.
- It avoids locking the whole app into one vendor on day one.
- It keeps the API deployable even if the web portal changes later.

## Surface-by-Surface Environment Variables

### 1) API: `services/api`

Put these in the production environment for the Node API host:

```env
PORT=4000
DATABASE_URL=postgres://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
SESSION_SECRET=replace-with-a-different-long-random-secret
ENABLE_DEMO_ACCOUNTS=true
EXPOSE_OTP_DEBUG_CODE=true
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VASY_API_BASE_URL=
VASY_API_KEY=
VASY_WEBHOOK_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Local development can keep using the existing SQLite fallback:

```env
DATABASE_URL=./data/aeden-bakes.sqlite
```

### 2) Super-admin portal: `apps/web/super-admin`

Put these in Vercel project settings or in the local `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_NAME=Aeden Bakes
```

### 3) Flutter apps

The Flutter apps should receive the API URL at build time:

```text
--dart-define=API_BASE_URL=https://api.your-domain.com
```

Use the same API URL for:

- `apps/mobile/customer`
- `apps/mobile/production`
- `apps/mobile/delivery`

If the flag is omitted, the apps can keep using localhost for local development.

## Exact Account Checklist

Create accounts in this order:

1. Neon for the database
2. Render for the API host
3. Vercel for the super-admin portal
4. Cloudflare for DNS and R2

## What Goes Where

### Render

Use Render for the Node API because it can run the current Express service with env vars and logs.

### Vercel

Use Vercel for the super-admin portal because it is the cleanest fit for Next.js.

### Neon

Use Neon as the first remote Postgres target when we move off local SQLite.

### Cloudflare

Use Cloudflare for DNS first, then R2 when you are ready to activate live document storage.

## Rollout Rule

Phase 5 should not require R2 or Vasy to be live on day one.

If either integration is missing:

- the app must stay honest
- the UI must say it is in demo mode or pending integration
- no fake success should be shown as production success
