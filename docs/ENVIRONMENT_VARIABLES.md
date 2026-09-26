# Environment Variables

This is the reference for every environment variable the ClipCash frontend reads. The runnable template is [`.env.example`](../.env.example):

```bash
cp .env.example .env.local   # .env.local is git-ignored
```

## How to read this page

**Required** column:

| Value           | Meaning                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Always**      | Checked by `validateRequiredEnv()` in [`app/lib/validateEnv.ts`](../app/lib/validateEnv.ts). If it is missing, dev logs a warning and CI/production **fail to start**. |
| **Prod**        | Checked the same way, but only when `NODE_ENV=production` or `CI=true`.                                                                                                |
| **Conditional** | Required only when the feature described is turned on.                                                                                                                 |
| **Optional**    | Has a safe default, or the feature degrades gracefully without it.                                                                                                     |

**Exposure** column:

| Value         | Meaning                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌐 **Public** | Starts with `NEXT_PUBLIC_`. Next.js **inlines it into the browser bundle at build time**. Anyone can read it. Changing it requires a rebuild. |
| 🔒 **Server** | Only available to server code (API routes, middleware, server components). Never sent to the browser.                                         |

> ⚠️ **Never put a secret in a `NEXT_PUBLIC_` variable.** It will ship in the JavaScript bundle to every visitor.

---

## Authentication (NextAuth)

| Variable                                          | Required    | Exposure | Default          | Example                               | Description                                                                                                      |
| ------------------------------------------------- | ----------- | -------- | ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`                                 | Always      | 🔒       | —                | output of `openssl rand -base64 32`   | Signs and encrypts session JWTs and CSRF tokens.                                                                 |
| `NEXTAUTH_URL`                                    | Always      | 🔒       | —                | `http://localhost:3000`               | Canonical app origin. Used for OAuth callback URLs, Stripe redirect URLs and absolute links.                     |
| `GOOGLE_CLIENT_ID`                                | Always      | 🔒       | —                | `1234-abc.apps.googleusercontent.com` | Google OAuth client ID.                                                                                          |
| `GOOGLE_CLIENT_SECRET`                            | Always      | 🔒       | —                | `GOCSPX-…`                            | Google OAuth client secret.                                                                                      |
| `APPLE_ID`                                        | Always      | 🔒       | —                | `com.clipcash.web`                    | Apple Sign In Services ID.                                                                                       |
| `APPLE_TEAM_ID`                                   | Always      | 🔒       | —                | `ABCDE12345`                          | Apple developer team ID.                                                                                         |
| `APPLE_KEY_ID`                                    | Always      | 🔒       | —                | `XYZ987WVU6`                          | ID of the Sign in with Apple private key.                                                                        |
| `APPLE_PRIVATE_KEY`                               | Always      | 🔒       | —                | `-----BEGIN PRIVATE KEY-----\n…`      | PEM private key. Escape newlines as `\n` when it is on one line.                                                 |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`     | Conditional | 🔒       | —                | —                                     | Needed to link X/Twitter accounts (OAuth 2.0).                                                                   |
| `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` | Conditional | 🔒       | —                | —                                     | Needed to link Instagram accounts.                                                                               |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`      | Conditional | 🔒       | —                | —                                     | Needed to link TikTok accounts.                                                                                  |
| `WEBAUTHN_RP_ID`                                  | Optional    | 🔒       | request hostname | `clipcash.ai`                         | WebAuthn relying-party ID for passkeys. Set it to the registrable domain when the app is served from subdomains. |

**Security:**

- If `NEXTAUTH_SECRET` leaks, anyone can forge a session. Rotating it signs every user out.
- OAuth client secrets and `APPLE_PRIVATE_KEY` allow impersonating the app to the provider. Store them in the host's secret manager, never in the repo.
- Changing `WEBAUTHN_RP_ID` invalidates every passkey already registered.

## Core services and URLs

| Variable                  | Required | Exposure | Default                 | Example                 | Description                                                                        |
| ------------------------- | -------- | -------- | ----------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | Prod     | 🌐       | —                       | `http://localhost:4000` | Base URL of the main backend API. Must be `http(s)://` in prod/CI.                 |
| `NEXT_PUBLIC_BASE_URL`    | Optional | 🌐       | `http://localhost:3000` | `https://clipcash.ai`   | Public origin used to build share and referral links.                              |
| `NEXT_PUBLIC_ENVIRONMENT` | Optional | 🌐       | —                       | `staging`               | When set to `staging`, the CSP is sent as `Report-Only` instead of being enforced. |
| `API_TIMEOUT_MS`          | Optional | 🔒       | `10000`                 | `15000`                 | Default timeout for routes wrapped in `withApiMiddleware()`.                       |
| `COMPRESSION_ENABLED`     | Optional | 🔒       | `true`                  | `false`                 | Set to `false` to turn off gzip/brotli for API responses.                          |
| `COMPRESSION_MIN_BYTES`   | Optional | 🔒       | `1024`                  | `2048`                  | Responses smaller than this are not compressed.                                    |

**Security:** a staging CSP in `Report-Only` mode does not block attacks. Never set `NEXT_PUBLIC_ENVIRONMENT=staging` in production.

## AI processing backend

| Variable                     | Required    | Exposure | Default | Example                 | Description                                                                                                                    |
| ---------------------------- | ----------- | -------- | ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_AI_API_URL`     | Prod        | 🌐       | —       | `http://localhost:5000` | AI service base URL. The upload route POSTs jobs to `<url>/jobs`.                                                              |
| `AI_BACKEND_SECRET`          | Conditional | 🔒       | —       | `openssl rand -hex 32`  | Bearer token sent on outbound requests to the AI backend and its health check. Required whenever the AI backend enforces auth. |
| `AI_BACKEND_CALLBACK_SECRET` | Prod        | 🔒       | —       | `openssl rand -hex 32`  | The AI backend must present this on `POST /api/jobs/[id]/callback`, along with a timestamp and nonce.                          |

**Security:** anyone with `AI_BACKEND_CALLBACK_SECRET` can mark jobs complete or inject results. Use a different random value per environment and rotate both services together.

## Cloud storage (uploads)

| Variable                     | Required    | Exposure | Default           | Example                                   | Description                                                      |
| ---------------------------- | ----------- | -------- | ----------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `CLOUD_STORAGE_PROVIDER`     | Prod        | 🔒       | `s3`              | `s3` \| `r2` \| `gcs`                     | Storage backend. All three use the S3 API.                       |
| `CLOUD_STORAGE_BUCKET`       | Prod        | 🔒       | —                 | `clips-uploads`                           | Bucket name.                                                     |
| `CLOUD_STORAGE_REGION`       | Prod        | 🔒       | `us-east-1`       | `auto` (R2)                               | Bucket region.                                                   |
| `CLOUD_STORAGE_ENDPOINT`     | Conditional | 🔒       | — (AWS)           | `https://<acct>.r2.cloudflarestorage.com` | Required for R2 and GCS interop. Leave empty for AWS.            |
| `CLOUD_STORAGE_KEY_PREFIX`   | Optional    | 🔒       | `uploads/`        | `uploads/`                                | Prefix for promoted (clean) objects.                             |
| `CLOUD_STORAGE_CHUNK_PREFIX` | Optional    | 🔒       | `uploads/chunks/` | `uploads/chunks/`                         | Prefix for chunked-upload parts.                                 |
| `AWS_ACCESS_KEY_ID`          | Prod        | 🔒       | —                 | `AKIA…`                                   | Storage access key. For R2 and GCS, use their S3-compatible key. |
| `AWS_SECRET_ACCESS_KEY`      | Prod        | 🔒       | —                 | —                                         | Storage secret key.                                              |

**Security:** scope the key to this one bucket, with only `PutObject`, `GetObject`, `CopyObject` and `DeleteObject`. Keep the bucket private. Uploads are served through signed URLs.

## Virus scanning

| Variable                       | Required    | Exposure | Default                                 | Example                                                  | Description                                                           |
| ------------------------------ | ----------- | -------- | --------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| `VIRUS_SCAN_ENABLED`           | Optional    | 🔒       | `true` in production, `false` otherwise | `true`                                                   | Turns upload scanning on or off.                                      |
| `VIRUS_SCAN_PROVIDER`          | Optional    | 🔒       | `clamav`                                | `clamav` \| `virustotal` \| `cloudmersive` \| `disabled` | Scanner backend. Any other value throws `CONFIG_ERROR`.               |
| `VIRUS_SCAN_TIMEOUT`           | Optional    | 🔒       | `30000`                                 | `30000`                                                  | Scan timeout in ms. Must be a positive integer.                       |
| `VIRUS_SCAN_QUARANTINE_PREFIX` | Optional    | 🔒       | `uploads/quarantine/`                   | `uploads/quarantine/`                                    | Where files wait until they are scanned.                              |
| `VIRUS_SCAN_ALLOW_ON_FAILURE`  | Optional    | 🔒       | `false`                                 | `true`                                                   | If the scanner itself errors, let the file through marked `degraded`. |
| `CLAMAV_API_URL`               | Conditional | 🔒       | —                                       | `http://localhost:8080`                                  | Required when the provider is `clamav`.                               |
| `VIRUSTOTAL_API_KEY`           | Conditional | 🔒       | —                                       | —                                                        | Required when the provider is `virustotal`.                           |
| `VIRUSTOTAL_POLL_INTERVAL_MS`  | Optional    | 🔒       | `5000`                                  | `5000`                                                   | Base interval for polling VirusTotal analysis results.                |
| `CLOUDMERSIVE_API_KEY`         | Conditional | 🔒       | —                                       | —                                                        | Required when the provider is `cloudmersive`.                         |

**Security:** `VIRUS_SCAN_ENABLED=false`, `VIRUS_SCAN_PROVIDER=disabled` and `VIRUS_SCAN_ALLOW_ON_FAILURE=true` all let unscanned files reach storage. Do not use any of them in production unless you accept that risk.

## Redis

| Variable                       | Required | Exposure | Default                 | Example                                   | Description                                                                                                                                       |
| ------------------------------ | -------- | -------- | ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`                    | Prod     | 🔒       | — (in-memory job store) | `redis://:pass@host:6379` or `rediss://…` | Job store, rate limits and shared sessions. Must use the `redis://` or `rediss://` scheme. Without it, job state is not shared between instances. |
| `REDIS_MAX_RETRIES`            | Optional | 🔒       | `3`                     | —                                         | Retries per command.                                                                                                                              |
| `REDIS_RETRY_DELAY`            | Optional | 🔒       | `1000`                  | —                                         | Base reconnect backoff in ms, capped at 10 s.                                                                                                     |
| `REDIS_CONNECT_TIMEOUT`        | Optional | 🔒       | `10000`                 | —                                         | Connection timeout in ms.                                                                                                                         |
| `REDIS_COMMAND_TIMEOUT`        | Optional | 🔒       | `5000`                  | —                                         | Per-command timeout in ms.                                                                                                                        |
| `REDIS_KEEP_ALIVE`             | Optional | 🔒       | `30000`                 | —                                         | TCP keep-alive in ms.                                                                                                                             |
| `REDIS_MAX_RECONNECT_ATTEMPTS` | Optional | 🔒       | `10`                    | —                                         | Stop reconnecting after this many attempts.                                                                                                       |
| `REDIS_HEALTH_CHECK_INTERVAL`  | Optional | 🔒       | `30000`                 | —                                         | Interval in ms between health-check pings.                                                                                                        |

**Security:** use `rediss://` (TLS) whenever Redis is not on a private network. The URL contains the password.

## Database (PostgreSQL / Prisma)

| Variable                        | Required    | Exposure | Default | Example                                                           | Description                                                                            |
| ------------------------------- | ----------- | -------- | ------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Conditional | 🔒       | —       | `postgresql://user:pass@localhost:5432/clips?connection_limit=10` | Needed by any feature backed by Prisma (users, notifications) and by `prisma migrate`. |
| `DATABASE_POOL_SIZE`            | Optional    | 🔒       | `10`    | —                                                                 | Connection pool size.                                                                  |
| `DATABASE_CONNECTION_TIMEOUT`   | Optional    | 🔒       | `10000` | —                                                                 | Connection and query timeout in ms.                                                    |
| `DATABASE_POOL_IDLE_TIMEOUT`    | Optional    | 🔒       | `30000` | —                                                                 | Idle connection timeout in ms.                                                         |
| `DATABASE_LOG_POOL_METRICS`     | Optional    | 🔒       | `false` | `true`                                                            | Log pool usage metrics.                                                                |
| `DATABASE_SLOW_QUERY_THRESHOLD` | Optional    | 🔒       | `1000`  | —                                                                 | Queries slower than this many ms are logged.                                           |

**Security:** the URL contains the DB password. Use a least-privilege role, and require `sslmode=require` outside local development.

## Operations: cron, metrics, logging

| Variable                   | Required    | Exposure | Default              | Example                           | Description                                                                                                                             |
| -------------------------- | ----------- | -------- | -------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CRON_SECRET`              | Conditional | 🔒       | —                    | `openssl rand -hex 32`            | Bearer token for `/api/cron/*`. In production, every cron request is **rejected** while it is unset.                                    |
| `STALLED_JOB_THRESHOLD_MS` | Optional    | 🔒       | `600000` (10 min)    | —                                 | Jobs with no update for this long are requeued.                                                                                         |
| `REQUEUE_MAX_JOBS`         | Optional    | 🔒       | `20`                 | —                                 | Maximum jobs requeued per cron run.                                                                                                     |
| `CLEANUP_JOB_AGE_MS`       | Optional    | 🔒       | `604800000` (7 days) | —                                 | Terminal jobs older than this are deleted.                                                                                              |
| `CLEANUP_MAX_JOBS`         | Optional    | 🔒       | `500`                | —                                 | Maximum jobs deleted per cron run.                                                                                                      |
| `METRICS_TOKEN`            | Conditional | 🔒       | —                    | `openssl rand -hex 32`            | Bearer token for `/api/metrics`. In production, every request is **denied** while it is unset. In dev, requests are allowed without it. |
| `LOG_DRAIN_URL`            | Optional    | 🔒       | —                    | `https://logs.example.com/ingest` | HTTP endpoint that receives structured logs.                                                                                            |

## Monitoring (Sentry)

| Variable                         | Required | Exposure | Default                                     | Example                             | Description                                                                  |
| -------------------------------- | -------- | -------- | ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`         | Always   | 🌐       | —                                           | `https://abc@o0.ingest.sentry.io/0` | Sentry project DSN. It is public by design: it only allows _sending_ events. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional | 🌐       | `NODE_ENV`                                  | `staging`                           | Environment tag on events.                                                   |
| `NEXT_PUBLIC_SENTRY_RELEASE`     | Optional | 🌐       | `VERCEL_GIT_COMMIT_SHA`, else `development` | `1.4.2`                             | Release tag on events.                                                       |
| `VERCEL_GIT_COMMIT_SHA`          | Optional | 🔒       | set by Vercel                               | —                                   | Fallback release identifier. Do not set it by hand on Vercel.                |

## Stellar / wallet

| Variable                                      | Required    | Exposure | Default                                                                | Example   | Description                                                 |
| --------------------------------------------- | ----------- | -------- | ---------------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`                 | Optional    | 🌐       | `testnet`                                                              | `mainnet` | Any value other than `mainnet` selects testnet.             |
| `NEXT_PUBLIC_STELLAR_RPC`                     | Optional    | 🌐       | `https://soroban-testnet.stellar.org` or `https://soroban.stellar.org` | —         | Overrides the Soroban RPC endpoint.                         |
| `NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID`         | Conditional | 🌐       | —                                                                      | `C…`      | NFT contract on testnet. Minting is unavailable without it. |
| `NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID_MAINNET` | Conditional | 🌐       | —                                                                      | `C…`      | NFT contract on mainnet.                                    |
| `NEXT_PUBLIC_SPONSOR_PUBLIC_KEY`              | Optional    | 🌐       | — (sponsorship off)                                                    | `G…`      | Public key of the fee-sponsor account.                      |
| `NEXT_PUBLIC_XLM_FALLBACK_PRICE_USD`          | Optional    | 🌐       | `0.12`                                                                 | `0.11`    | XLM/USD price shown when the price API is unreachable.      |

**Security:** only **public** keys belong here. The sponsor account's _secret_ key must never be set in a `NEXT_PUBLIC_` variable. Test on `testnet` before you switch `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`: mainnet transactions spend real funds.

## Billing (Stripe)

| Variable                     | Required    | Exposure | Default                   | Example     | Description                            |
| ---------------------------- | ----------- | -------- | ------------------------- | ----------- | -------------------------------------- |
| `STRIPE_SECRET_KEY`          | Conditional | 🔒       | — (checkout is simulated) | `sk_test_…` | Enables real Stripe Checkout sessions. |
| `STRIPE_PRO_PRICE_ID`        | Conditional | 🔒       | —                         | `price_…`   | Stripe price for the Pro plan.         |
| `STRIPE_ENTERPRISE_PRICE_ID` | Conditional | 🔒       | —                         | `price_…`   | Stripe price for the Enterprise plan.  |

**Security:** use `sk_test_…` keys everywhere except production. A live secret key can issue refunds and read customer data. If the key is missing or a Stripe call fails, `/api/billing/checkout` returns a _simulated_ success (`simulated: true`), so make sure it is set in production.

## Social recovery email

| Variable         | Required    | Exposure | Default               | Example | Description                                                                                        |
| ---------------- | ----------- | -------- | --------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `EMAIL_FROM`     | Optional    | 🔒       | `noreply@clipcash.ai` | —       | Sender for guardian-approval emails.                                                               |
| `RESEND_API_KEY` | Conditional | 🔒       | —                     | `re_…`  | Resend API key. Only used once the Resend block in `app/api/recovery/shared/mailer.ts` is enabled. |

## Analytics

| Variable                                | Required    | Exposure | Default                             | Example                                    | Description                                                                                                            |
| --------------------------------------- | ----------- | -------- | ----------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`        | Optional    | 🌐       | `none`                              | `ga4` \| `plausible` \| `custom` \| `none` | Analytics backend. Events are only sent after cookie consent. It also controls which analytics origins the CSP allows. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`         | Conditional | 🌐       | —                                   | `G-XXXXXXXXXX`                             | Required when the provider is `ga4`.                                                                                   |
| `NEXT_PUBLIC_GA4_SCRIPT_SRI_HASH`       | Optional    | 🌐       | —                                   | `sha384-…`                                 | Subresource-integrity hash for the GA4 script.                                                                         |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`          | Conditional | 🌐       | —                                   | `clipcash.ai`                              | Required when the provider is `plausible`.                                                                             |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL`      | Optional    | 🌐       | `https://plausible.io/js/script.js` | —                                          | For self-hosted Plausible.                                                                                             |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH` | Optional    | 🌐       | —                                   | `sha384-…`                                 | SRI hash for the Plausible script. Check it with `scripts/verify-script-sri.js`.                                       |
| `NEXT_PUBLIC_ANALYTICS_ENDPOINT`        | Conditional | 🌐       | —                                   | `https://analytics.example.com/events`     | Required when the provider is `custom`.                                                                                |

**Security:** set the SRI hashes so a compromised third-party script is refused by the browser. Update them whenever the vendor script changes.

## AI video transformation

| Variable                       | Required | Exposure | Default                                                 | Example           | Description                                                                                                |
| ------------------------------ | -------- | -------- | ------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TRANSFORM_STYLES` | Optional | 🌐       | `anime,cinematic,sketch,watercolor,retro-vhs,neon-noir` | `anime,cinematic` | Allow-list of styles accepted by `/api/transform/batch`. The list is comma-separated and case-insensitive. |

## CDN

| Variable              | Required | Exposure | Default                           | Example                    | Description                                          |
| --------------------- | -------- | -------- | --------------------------------- | -------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_CDN_URL` | Optional | 🌐       | — (app origin)                    | `https://cdn.clipcash.dev` | `assetPrefix` for `/_next/static` and public assets. |
| `CDN_PURGE_API_URL`   | Optional | 🔒       | `<NEXT_PUBLIC_CDN_URL>/api/purge` | —                          | Endpoint for cache purges.                           |
| `CDN_PURGE_SECRET`    | Optional | 🔒       | — (purge is a no-op)              | —                          | Bearer token for the purge endpoint.                 |

## Client data layer

All of these are 🌐 public tuning knobs for `app/lib/data-layer`. Invalid or negative numbers fall back to the default.

| Variable                                   | Default  | Description                                              |
| ------------------------------------------ | -------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_DATA_CACHE_TTL_MS`            | `60000`  | How long a cached GET counts as fresh.                   |
| `NEXT_PUBLIC_DATA_STALE_TTL_MS`            | `300000` | Extra time stale data may be served, e.g. while offline. |
| `NEXT_PUBLIC_DATA_DEDUPE_WINDOW_MS`        | `0`      | Reuse a settled request's result for this long.          |
| `NEXT_PUBLIC_DATA_SYNC_MAX_RETRIES`        | `3`      | Maximum replay attempts per queued offline mutation.     |
| `NEXT_PUBLIC_DATA_SYNC_INITIAL_DELAY_MS`   | `1000`   | First retry delay.                                       |
| `NEXT_PUBLIC_DATA_SYNC_BACKOFF_MULTIPLIER` | `2`      | Exponential backoff factor.                              |
| `NEXT_PUBLIC_DATA_SYNC_MAX_DELAY_MS`       | `10000`  | Retry delay cap.                                         |
| `NEXT_PUBLIC_DATA_PERSIST_CACHE`           | `true`   | Persist the GET cache to `localStorage`.                 |
| `NEXT_PUBLIC_DATA_PERSIST_QUEUE`           | `true`   | Persist the offline mutation queue to `localStorage`.    |

**Security:** persisted data sits in the user's browser storage. `/auth` requests are never cached. Turn persistence off if you add endpoints that return sensitive data.

## Build, test and tooling

| Variable              | Required | Exposure | Default        | Description                                                                                                                    |
| --------------------- | -------- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`            | Optional | 🔒       | set by Next.js | `production` turns on prod-only checks, including strict env validation, virus scanning and the metrics/cron auth rules.       |
| `CI`                  | Optional | 🔒       | `false`        | Set to `true` by CI runners. Makes env validation strict and silences the Sentry build plugin output.                          |
| `ANALYZE`             | Optional | 🔒       | —              | `ANALYZE=true next build` opens the bundle analyzer (`npm run analyze`).                                                       |
| `E2E_SKIP_MIDDLEWARE` | Optional | 🔒       | —              | `true` bypasses auth middleware for Playwright runs. **Never set it in a deployed environment.** It disables route protection. |

---

## Per-environment setup

- **Local development:** only the **Always** variables are needed to boot. Missing ones log a warning. Leave `REDIS_URL` empty to use the in-memory job store. Scanning is off by default.
- **CI:** set `CI=true` along with the **Always** and **Prod** variables. Dummy values are fine for anything that isn't called in tests.
- **Production:** set the **Always**, **Prod** and relevant **Conditional** variables in the host's secret store (Vercel project settings, `fly secrets set`, or the K8s secret in `deploy/k8s/secret.yaml`). Also set `CRON_SECRET` and `METRICS_TOKEN`.

## Adding a new variable

1. Read it via `process.env.NAME` with an explicit default where one makes sense.
2. If the app cannot run without it, add it to `REQUIRED_ENV_VARS` or `REQUIRED_PROD_ENV_VARS` in `app/lib/validateEnv.ts`.
3. Add it to `.env.example` with a comment, then run `node scripts/validate-env-example.js`.
4. Add a row to the right table on this page, including any security implications.
5. Use the `NEXT_PUBLIC_` prefix **only** for values that are safe to publish.
