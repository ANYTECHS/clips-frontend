# ADR-0001: Single Next.js app with a same-origin API proxy

- **Status:** Accepted
- **Date:** 2026-11-23 (recorded retroactively)
- **Deciders:** ClipCash maintainers

## Context

The UI talks to a separate NestJS backend (`clips-backend/`) hosted on
Render. Calling that backend directly from the browser would require:

- exposing the backend URL in the client bundle,
- configuring CORS for every deployment origin (previews, localhost, IPs),
- cross-site cookies (`SameSite=None`) for the HTTP-only session cookies.

The Render free tier also sleeps the backend, so the first request after a
period of inactivity fails with `ECONNRESET`.

## Decision

We ship the frontend as a **single Next.js (App Router) application**. All
browser traffic to the backend goes through the same-origin route handler
`app/api/proxy/[...path]/route.ts` (and `app/api/sse/[...path]` for event
streams). Client code always uses `/api/proxy` as its base URL
(`lib/apiClient.ts`); only the server reads `API_URL`.

The proxy forwards cookies and headers, rewrites `Set-Cookie` for the
frontend origin, streams SSE responses, and turns backend wake-up errors
into a friendly `503`.

## Consequences

- The backend URL never reaches the browser; `NEXT_PUBLIC_*` must not point
  at it.
- Session cookies are first-party, so they can stay `SameSite=Lax/Strict`.
- No CORS configuration is needed for browser traffic.
- Every request takes an extra hop through the Next.js server, and large
  uploads must avoid the proxy (see [ADR-0005](0005-hybrid-cloudinary-r2-upload-storage.md)).
- The proxy is a single point where headers (e.g. `X-CSRF-Token`) must be
  preserved.

## Alternatives considered

- **Direct browser → backend calls with CORS** — leaks the backend URL and
  needs cross-site cookies.
- **Separate BFF service** — more infrastructure for the same result.

## References

- `app/api/proxy/[...path]/route.ts`
- `lib/apiClient.ts`
- README "Architecture → Proxy Route"
