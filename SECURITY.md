# Security Model

## Social wallet recovery

Social recovery protects a Stellar wallet backup using:

1. **Password-based encryption (client-side)** — The mnemonic or secret key is encrypted with AES-GCM (PBKDF2-derived key) before any sharing. The recovery password is never sent to the server.

2. **Shamir secret sharing (t-of-n)** — The encrypted backup is split into `n` shares with threshold `t`. Each guardian receives one share by email invitation. No single guardian or the server stores the full encrypted backup.

3. **Guardian approval** — Recovery sessions require at least `t` guardians to approve before shares are combined. The combined ciphertext is returned only when the threshold is met.

4. **Final decryption** — The account owner supplies the recovery password locally to decrypt the restored ciphertext.

### Mock vs production

| Component | Current (mock API) | Production requirement |
| --- | --- | --- |
| Share storage | In-memory `guardianShares` map | Encrypted at rest; guardian-authenticated retrieval |
| Email invitations | `console.info` via `sendGuardianInvitation` | Transactional email (SES, SendGrid, etc.) with signed approval links |
| Guardian approval | Simulated in UI | Authenticated guardian endpoints + audit log |

## Error monitoring (Sentry)

Wallet and Stellar errors sent to Sentry use `beforeSend` and `beforeBreadcrumb` hooks with shared redaction in `app/lib/sentry-redaction.ts`. Secret keys, mnemonics, and similar fields are never included in events or breadcrumbs.

## Soroban smart contracts

`invoke_contract` operations are not supported in the Horizon batch builder. See `SOROBAN_SMART_WALLET_SPIKE.md` for the planned Soroban RPC integration.

## CSRF protection

### What is protected

NextAuth handles CSRF for its own `/api/auth/*` routes automatically via a double-submit cookie. Custom state-mutating routes are not covered by NextAuth and require their own protection:

| Route | Method | Protected |
|---|---|---|
| `/api/jobs/[id]` | POST (restart) | ✅ `checkCsrf` |
| `/api/upload` | POST | ✅ `checkCsrf` |

Read-only `GET` routes and the NextAuth routes are not in scope.

### Approach: Origin / Referer header validation

The helper lives in `app/lib/csrf.ts` and is called at the top of every mutating handler, before authentication:

```ts
const csrfError = checkCsrf(request);
if (csrfError) return csrfError; // 403 Forbidden
```

**How it works:**

1. The `Origin` header is read first. Browsers always include it on cross-origin requests (and on same-origin POST requests in all modern browsers).
2. If `Origin` is absent, the `Referer` header is used as a fallback — some corporate proxies strip `Origin` but preserve `Referer`.
3. The extracted origin is compared against the origin component of `NEXTAUTH_URL` (e.g. `https://app.clipcash.ai`). Only an exact match passes — subdomains, different ports, and `http` vs `https` are all rejected.
4. Requests with neither header are rejected by default. Routes that must accept server-to-server calls without browser headers can opt in with `checkCsrf(request, { allowMissingOrigin: true })`.
5. If `NEXTAUTH_URL` is not set, the check is skipped with a `console.warn`. `validateEnv` will have already warned at startup.

**Why not a token?** Double-submit cookies require client-side coordination (reading a cookie, adding a header or body field). Origin/Referer checking provides equivalent protection for this application's threat model with zero client overhead. This approach is used by Django, Rails, and other frameworks as a primary CSRF mitigation.

### Adding CSRF protection to new routes

Apply `checkCsrf` to any new `POST`, `PATCH`, or `DELETE` handler:

```ts
import { checkCsrf } from "@/app/lib/csrf";

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  // ... rest of handler
}
```

Integration tests should cover both the same-origin (pass) and cross-origin (403) cases. See `__tests__/api/jobs.csrf.test.ts` and `__tests__/api/upload.csrf.test.ts` for examples.
