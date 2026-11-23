# ADR-0002: HTTP-only JWT cookie sessions with double-submit CSRF tokens

- **Status:** Accepted
- **Date:** 2026-11-23 (recorded retroactively)
- **Deciders:** ClipCash maintainers

## Context

Storing access tokens in `localStorage` exposes them to any XSS. Cookies are
not readable by scripts when `HttpOnly`, but the browser attaches them
automatically — which makes cookie-authenticated, state-changing requests
vulnerable to cross-site request forgery.

## Decision

- The backend issues a short-lived JWT access token (`JWT_EXPIRES`, default
  1 h) and a refresh token as **HTTP-only cookies** (`access_token`,
  `refresh_token` scoped to `/auth/refresh`). Bearer tokens remain supported
  for API clients.
- On login, OAuth callback and refresh the backend also issues a random
  **CSRF token** in a readable `_csrf` cookie (`SameSite=Strict`), and
  `GET /auth/csrf` re-issues one for an existing session.
- A global `CsrfGuard` requires `X-CSRF-Token` (or a `_csrf` body field) to
  match the cookie on every `POST`/`PUT`/`PATCH`/`DELETE`, and returns `403`
  otherwise. Pre-session auth routes and API-key / Bearer requests are
  exempt because browsers never attach those credentials automatically.
- The frontend Axios client copies the `_csrf` cookie into the header on
  every unsafe request.
- JWTs are signed with `JWT_SECRET`; `JWT_SECRET_PREVIOUS` is accepted during
  key rotation (see [SESSION_SECURITY.md](../SESSION_SECURITY.md)).

## Consequences

- Tokens are out of reach of injected scripts.
- Every new state-changing route is CSRF-protected by default; exemptions
  must be added explicitly to `CSRF_EXEMPT_PATHS`.
- Clients that use cookies must read `_csrf` and send it back.

## Alternatives considered

- **Tokens in `localStorage` + Bearer header** — XSS-exposed.
- **`SameSite` cookies alone** — not sufficient for older browsers and
  same-site subdomains.

## References

- `clips-backend/src/auth/cookie.service.ts`
- `clips-backend/src/csrf/`
- `clips-backend/src/auth/jwt-keys.ts`
- [docs/SESSION_SECURITY.md](../SESSION_SECURITY.md)
