# Phase 5 Deployment Checklist

Use this as the single deployment handoff note.

## Free Accounts To Create

Create these accounts in this order:

1. Supabase
2. Vercel
3. Resend
4. Firebase
5. Meta for Developers
6. Cloudflare

## What Each Service Is For

- Supabase: database and auth if you want a hosted backend later
- Vercel: super-admin portal hosting
- Resend: transactional email
- Firebase: optional push/Google infrastructure on the free Spark plan
- Meta for Developers: WhatsApp Cloud API setup and business messaging
- Cloudflare: DNS now, R2 later when the client card is available

## What To Paste In Each Place Now

### 1) `services/api/.env`

Paste this for local development:

```env
PORT=4000
DATABASE_URL=./data/aeden-bakes.sqlite
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=generate-a-long-random-string
SESSION_SECRET=generate-a-different-long-random-string
ENABLE_DEMO_ACCOUNTS=true
EXPOSE_OTP_DEBUG_CODE=true
VASY_API_BASE_URL=
VASY_API_KEY=
VASY_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
MSG91_WIDGET_ID=
MSG91_AUTH_TOKEN=
MSG91_AUTHKEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

What to do with the secrets:

- `JWT_SECRET` and `SESSION_SECRET` are not values you “find”. You generate them.
- Use any strong random string generator or a local secret generator.
- Keep the two values different.

What can stay blank for now:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `VASY_API_BASE_URL`
- `VASY_API_KEY`
- `VASY_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- all `R2_*` values

For real OTP sign-in, do not skip the MSG91 values:

- `MSG91_WIDGET_ID`
- `MSG91_AUTH_TOKEN`
- `MSG91_AUTHKEY`

## OTP Wiring

Use MSG91 for SMS OTP. The project already has an OTP request and verify flow in the API, so the cleanest setup is:

1. Copy the widget ID from the MSG91 widget list.
2. Create or enable an auth token from the MSG91 `Tokens` section.
3. Paste `MSG91_WIDGET_ID`, `MSG91_AUTH_TOKEN`, and `MSG91_AUTHKEY` into `services/api/.env`.
4. Keep the customer app calling our API at `/auth/otp/request` and `/auth/otp/verify`.
5. Let the API talk to MSG91 on the server side.

If you want to use the Flutter SDK later instead, MSG91 says the SDK also needs the widget ID and auth token, and Mobile Integration must be enabled while configuring the widget.

### 2) `apps/web/super-admin/.env.local`

Paste this for local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_APP_NAME=Aeden Bakes
```

For production, change `NEXT_PUBLIC_API_BASE_URL` to the deployed API URL.

### 3) Flutter build time

Use this for each mobile app when you build for a real environment:

```text
--dart-define=API_BASE_URL=https://api.your-domain.com
```

## Free-Tier Setup Notes

- Supabase Free is enough to start if you want a hosted Postgres later. The repo still works locally with SQLite right now.
- Vercel Hobby is free for the web portal.
- Resend Free is enough for a demo email flow.
- Firebase Spark is the no-cost plan.
- Meta WhatsApp Cloud API can be set up for testing, but message sending will follow Meta’s pricing rules later.
- Cloudflare R2 can be added later. The docs say R2 is free to get started, but the subscription setup may still ask for billing details.

## What To Skip For Now

Leave these for the later phase or client handoff:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `VASY_API_BASE_URL`
- `VASY_API_KEY`
- `VASY_WEBHOOK_SECRET`
- all `R2_*` values

If you are using the real OTP widget, also paste:

- `MSG91_WIDGET_ID`
- `MSG91_AUTH_TOKEN`
- `MSG91_AUTHKEY`

## Build Order From Here

1. Keep local SQLite for the demo.
2. Use Vercel Hobby for the web portal.
3. Add Supabase only when we want hosted Postgres.
4. Add Resend and Firebase after the notification batch.
5. Add Meta WhatsApp Cloud API when messaging is in scope.
6. Add R2 after the client supplies a card.

## Batch 5.1 Exit Check

Before we call this checklist complete:

- the API can boot locally with the env file above
- the super-admin portal can boot locally with the env file above

## Flutter Build Flags

For the customer app, pass these when you want the real MSG91 widget:

```text
--dart-define=API_BASE_URL=http://127.0.0.1:4000
--dart-define=MSG91_WIDGET_ID=your_widget_id
--dart-define=MSG91_AUTH_TOKEN=your_auth_token
```

The API also needs `MSG91_AUTHKEY` in `services/api/.env` so the server can verify the access token before onboarding completes.
- the Flutter apps can build with `API_BASE_URL`
- the checklist is detailed enough to hand to the client or operator
