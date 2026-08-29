# app/lib

Shared utilities and framework-agnostic logic used across the app (routes, hooks, stores, components). Anything here should be importable from both server and client code unless noted otherwise.

| Utility | Purpose | When to use |
|---|---|---|
| `aiBackend.ts` | Thin client for dispatching video processing jobs to the AI backend service. | Submitting a video for transformation / polling the AI backend directly. |
| `analytics.ts` | Unified analytics tracking (GA4, Plausible, custom) with consent gating and PII redaction. | Tracking page views or product events (signup, upload, mint, wallet actions). |
| `apiClient.ts` | Fetch wrapper for the dashboard summary endpoint. | Loading dashboard stats/revenue/history from the client. |
| `api/ApiClient.ts` | Generic typed fetch client used as the base for feature-specific API clients. | Building a new client for a backend resource. |
| `auth.ts` | Auth.js v5 (`NextAuthConfig`) setup — providers, session/jwt callbacks. | Configuring or reading NextAuth session behavior. |
| `authCallbacks.ts` | JWT/session callback logic invoked by `auth.ts` during sign-in. | Modifying what's stored on the token/session. |
| `authRedirect.ts` | Determines whether a path is in the protected-route list. | Middleware/redirect logic for auth-gated pages. |
| `authUser.ts` | Maps a NextAuth `Session` to the app's `User` type. | Converting session data for UI/store consumption. |
| `cloudStorage.ts` | S3-compatible storage abstraction (AWS S3, GCS, R2) driven by env vars. | Uploading/reading files from cloud storage. |
| `sync/backgroundSync.ts` | Shared background sync API with deduplication, retry, fallback handling, and structured errors. | Refreshing dashboard/earnings/project data in the background without duplicate requests. |
| `sync/conflictResolution.ts` | Merge strategy for local vs remote writes when streaming or polling updates. | Resolving racing writes while preserving the newest `updatedAt`. |
| `constants.ts` | Cross-cutting numeric/string constants (upload limits, PBKDF2 iterations, refresh intervals). | Any code needing a shared limit or interval instead of a magic number. |
| `cryptoUtils.ts` | Web Crypto–based password encryption/decryption helpers. | Encrypting secrets client-side (e.g. wallet keys) with a user password. |
| `csrf.ts` | CSRF token validation for custom API routes (NextAuth routes are covered automatically). | Any state-mutating custom route (POST/PATCH/DELETE) outside `/api/auth/*`. |
| `embeddedWallet.ts` | Automatic embedded-wallet creation on email signup ("Web2" flow). | Creating/managing a custodial wallet tied to an email account. |
| `formatAmount.ts` | Locale-aware formatting for XLM and fiat amounts. | Displaying currency/crypto amounts in the UI. |
| `i18n/` | `I18nProvider`, translations, and locale types. | Adding translated strings or wiring a new locale. |
| `logger.ts` | Console-backed logger (`debug`/`warn`/`error`) used instead of raw `console.*`. | Any logging inside app code. |
| `mintUtils.ts` | Stellar NFT minting helpers and cost constants. | Formatting XLM for mint flows / reading mint cost constants. |
| `multiWalletStorage.ts` | Storage layer for managing multiple external wallets per user. | Persisting/reading non-embedded (external) wallet connections. |
| `networkConfig.ts` | Single source of truth for Stellar network (testnet/mainnet) config and Horizon URLs. | Anything that needs the active network or its Horizon endpoint. |
| `notifications.ts` | Browser push notification permission handling with localStorage persistence. | Requesting/checking notification permission state. |
| `prisma.ts` | Shared Prisma client singleton. | Any server code querying the database. |
| `rateLimiter.ts` | Client-side call-rate limiter (sliding window) that dispatches a DOM event when exceeded. | Throttling repeated client-side calls (e.g. wallet RPCs). |
| `retryUtils.ts` | Generic retry/backoff helper for transient async failures. | Wrapping flaky network calls (wallet creation, etc.) with retries. |
| `sanitize.ts` | DOMPurify-based string sanitizer to prevent XSS. | **Required** for any user-controlled string rendered in the UI (see `AGENTS.md`). |
| `secureStorage.ts` | Encrypted localStorage wrapper plus pending-warning retrieval for decryption failures. | Storing/reading sensitive client-side data (private keys, tokens). |
| `sentry.ts` | Sentry error monitoring configuration/init. | Wiring up error/perf monitoring; not usually called directly elsewhere. |
| `sentryRedaction.ts` | Redacts wallet addresses/emails before they reach Sentry. | Sanitizing identifiers in error reports or breadcrumbs. |
| `serverRateLimit.ts` | Server-side in-memory token-bucket rate limiter keyed by IP/user. | Rate-limiting a Next.js API route (`applyRateLimit(request, opts)`). |
| `shamirRecovery.ts` | Shamir's Secret Sharing helpers for social account recovery. | Splitting/combining guardian shares during recovery flows. |
| `stellar.ts` | Core Stellar SDK helpers (transaction building, submission). | Building/submitting Stellar transactions. |
| `stellarOperations.ts` | Typed operation descriptors for batching Stellar transactions. | Constructing multi-operation Stellar transactions. |
| `stellarTransaction.ts` | Transaction submission with sequence-number retry handling. | Submitting a signed transaction that may hit `tx_bad_seq`. |
| `types.ts` | Shared app-wide types (`User`, `OnboardingData`, etc.). | Typing user/onboarding data across modules. |
| `userApi.ts` | Server-side client for user-related backend endpoints (used from NextAuth callbacks). | Calling the backend user service from Node.js runtime code. |
| `userPreferences.ts` | Non-sensitive user preference storage (localStorage, unencrypted). | Persisting UI/display preferences that aren't secrets. |
| `validateEnv.ts` | Validates required environment variables at startup. | Adding a new required env var (register it here). |
| `virusScan.ts` | Virus scanning integration for uploads (ClamAV, VirusTotal, etc.). | Scanning uploaded files before storage/processing. |
| `walletErrorTracking.ts` | Wallet-specific error tracking, integrates with Sentry with console fallback. | Logging/tracking wallet operation errors. |
| `walletRepository.ts` | Facade over `walletStorage.ts` and `multiWalletStorage.ts` by wallet type. | Reading/writing wallet data without caring if it's embedded or external. |
| `walletStorage.ts` | Storage for embedded wallet credentials (obfuscated localStorage). | Persisting/reading the embedded (custodial) wallet. |
