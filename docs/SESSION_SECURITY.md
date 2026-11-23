# Session Security

How ClipCash sessions are issued, protected and rotated. Background and
rationale: [ADR-0002](adr/0002-httponly-cookie-sessions-with-csrf.md).

## Tokens and cookies

| Cookie / header | Set by | Purpose |
|-----------------|--------|---------|
| `access_token` (HTTP-only) | `/auth/login`, `/auth/refresh`, OAuth callback | Short-lived JWT (`JWT_EXPIRES`, default 3600 s) |
| `refresh_token` (HTTP-only, path `/auth/refresh`) | same | Long-lived refresh token (`JWT_REFRESH_EXPIRES_DAYS`, default 14) |
| `_csrf` (readable, `SameSite=Strict`) | login, refresh, OAuth callback, `GET /auth/csrf` | Double-submit CSRF token |
| `X-CSRF-Token` header | the client | Must equal the `_csrf` cookie on every `POST`/`PUT`/`PATCH`/`DELETE` |

Access tokens are signed with **`JWT_SECRET`**. Signature checks accept
`JWT_SECRET` and, during a rotation, **`JWT_SECRET_PREVIOUS`**
(`clips-backend/src/auth/jwt-keys.ts`).

## CSRF protection

- The global `CsrfGuard` (`clips-backend/src/csrf/csrf.guard.ts`) rejects
  any unsafe request whose `X-CSRF-Token` header (or `_csrf` body field) is
  missing or doesn't match the `_csrf` cookie with **403 Invalid CSRF token**.
- Exempt: `GET`/`HEAD`/`OPTIONS`; the pre-session auth routes in
  `CSRF_EXEMPT_PATHS` (signup, login, magic link, email verification,
  forgot/reset password, refresh, Google OAuth, API docs); and requests
  authenticated with `X-API-Key` or `Authorization: Bearer`, which browsers
  never send automatically.
- Exempt paths match on whole segments — `/api` covers `/api/docs` but not
  `/api-keys`.
- The frontend (`lib/apiClient.ts`) copies `_csrf` into `X-CSRF-Token` on
  every unsafe request. If the cookie is missing (for example it expired
  before the session), call `GET /auth/csrf` to get a new one.

## Password reset limits

`POST /auth/forgot-password` is limited to **3 requests per hour per email
and per IP** (`PasswordResetRateLimiterService`). The response body is the
same whether or not the email has an account, and the request is counted
before the user lookup so the limit can't be used to enumerate accounts.
Exceeding the limit returns `429` with a `Retry-After` header.

## Rotating the JWT signing key

Rotate on a schedule (recommended: every 90 days) and **immediately** if the
key may have leaked. Rotation uses an overlap window so existing sessions
keep working while new tokens are signed with the new key.

### Scheduled rotation

1. **Generate a new key** (at least 32 random bytes):
   ```bash
   openssl rand -base64 48
   ```
2. **Start the overlap window.** In the backend environment, set both
   variables and deploy all instances:
   ```bash
   JWT_SECRET_PREVIOUS=<current JWT_SECRET value>
   JWT_SECRET=<new key>
   ```
   New tokens are signed with the new key. Tokens signed with the old key
   still validate.
3. **Wait out the overlap** — at least the access-token lifetime
   (`JWT_EXPIRES`, default 1 hour) after the last instance picked up the new
   key. Refresh tokens are opaque database records, so refreshing during the
   window issues a new-key access token without logging the user out.
4. **End the overlap.** Remove `JWT_SECRET_PREVIOUS` and deploy again. Any
   remaining old-key tokens are now rejected.
5. **Record** the rotation date and operator in the ops log, and destroy all
   copies of the old key.

### Emergency rotation (leaked key)

A leaked key lets an attacker mint valid tokens, so **skip the overlap**:

1. Set `JWT_SECRET` to a freshly generated key and **do not** set
   `JWT_SECRET_PREVIOUS`. Deploy all instances immediately.
2. Every existing access token is now invalid. Clients with a valid refresh
   token are re-issued an access token transparently on their next request;
   revoke refresh tokens as well if they may also be compromised.
3. Investigate how the key leaked and audit actions taken with suspicious
   tokens.

### Verification

- `clips-backend/src/auth/jwt-keys.spec.ts` checks that tokens signed with the
  old key validate during the overlap and are rejected after it ends.
- After step 2, an existing session should keep working; after step 4, a
  token captured before the rotation should get `401`.
