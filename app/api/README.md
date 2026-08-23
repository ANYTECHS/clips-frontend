# app/api

Next.js App Router API routes. Auth column values:
- **Session** — requires a signed-in NextAuth session (`auth()` / `getServerSession`); returns 401 if missing.
- **Job owner** — session required, and the session's user must own the job (`requireJobOwner`); 401/403/404.
- **Shared secret** — Bearer token compared against a server-only env secret (not a user session).
- **Shared-secret token (email link)** — a random session/approval token from an emailed link acts as the credential; no login required.
- **None** — publicly accessible (may still be IP rate-limited).

| Route | Methods | Auth | Notes |
|---|---|---|---|
| `auth/[...nextauth]` | GET/POST | None (NextAuth's own flow) | OAuth sign-in/callback handlers. |
| `auth/passkey/register` | GET, POST | Session | WebAuthn passkey registration options + verification. |
| `auth/passkey/authenticate` | GET, POST | Session | WebAuthn passkey authentication options + verification. |
| `csp-report` | POST | None (rate-limited) | Browser CSP violation reports (`report-uri`); logs to structured logger. |
| `dashboard` | GET | Session | Dashboard summary stats/revenue/recent projects. |
| `earnings` | GET | Session | Earnings totals/breakdown. |
| `earnings/transactions` | GET | Session | Paginated earnings transaction list. |
| `jobs/[id]` | GET, POST | Job owner | GET reads job status; POST restarts a job (CSRF-checked, rate-limited). |
| `jobs/[id]/stream` | GET | Job owner | Server-Sent Events stream of live job progress. |
| `jobs/[id]/callback` | POST | Shared secret (`AI_BACKEND_CALLBACK_SECRET`) | Sole writer of job status; called by the AI backend, not the browser. See replay-protection notes in the route file. |
| `jobs/metrics` | GET | Session | Aggregate job metrics for the signed-in user. |
| `prices/xlm` | GET | None | Cached XLM/USD price (CoinGecko), with fallback on rate-limit. |
| `prices/assets` | GET | None | Cached USD prices for a set of asset codes (CoinGecko). |
| `recovery/initiate` | POST | None (rate-limited: 5/10min/IP) | Starts a social-recovery session and emails guardians. |
| `recovery/approve` | POST | Shared-secret token (email link) (rate-limited: 20/min/IP) | Records a guardian's approval. |
| `recovery/check` | GET | Shared-secret token (`sessionId`) (rate-limited: 30/min/IP) | Polls recovery status; returns reconstructed backup once threshold is met. |
| `sponsorship` | GET | None | Fee-sponsorship availability/estimate for a public key. |
| `transform` | POST | Session | Starts a single-clip style transform job. |
| `transform/batch` | POST | Session | Starts a batch style transform job across multiple clips. |
| `transform/styles` | GET | None | Static catalogue of available transform styles. |
| `upload` | POST | Session | Video upload endpoint (feeds the transform pipeline). |
| `user/onboarding` | POST | Session | Persists onboarding responses for the signed-in user. |
| `user/passkey` | GET, POST | Session | Lists / registers passkey credentials for the signed-in user. |
| `user/profile` | GET, PATCH | Session | Reads/updates the signed-in user's profile. |
| `wallet/history` | GET | None | Public Horizon-derived balance history for a given public key. |

## Shared helpers (`app/api/jobs/shared/`, `app/api/lib/`)
- `authGuard.ts` — `requireAuth()` / `requireJobOwner(jobId)` session + ownership checks used by the job routes.
- `jsonBody.ts` — `parseJsonRequest()` validates `Content-Type` and safely parses the JSON body.
- `jobStore.ts` / `jobRepository.ts` — Redis-backed (falls back to in-memory) job persistence.
- `feeSponsorship.ts` — sponsor balance/fee estimation logic used by `sponsorship/route.ts`.
