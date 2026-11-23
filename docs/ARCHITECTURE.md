# Architecture

ClipCash is made of two deployables that live in this repository:

| Part | Location | Stack |
|------|----------|-------|
| Frontend | repository root (`app/`, `components/`, `lib/`) | Next.js 15 App Router, TanStack Query, Axios |
| Backend API | `clips-backend/` | NestJS, Prisma/PostgreSQL, BullMQ/Redis, Stellar Soroban |

```
Browser ──► Next.js app ──► /api/proxy/[...path] ──► NestJS API ──► Postgres / Redis / Stellar
   │                                                     │
   └──► Cloudinary (< 95 MB) / Cloudflare R2 (≥ 95 MB) ◄─┘ (pre-signed URLs)
```

## Key flows

- **API access** — the browser only calls same-origin routes; the Next.js
  proxy forwards requests and cookies to the backend
  ([ADR-0001](adr/0001-single-nextjs-app-with-api-proxy.md)).
- **Sessions** — HTTP-only JWT cookies plus a double-submit CSRF token on
  every state-changing request
  ([ADR-0002](adr/0002-httponly-cookie-sessions-with-csrf.md),
  [SESSION_SECURITY.md](SESSION_SECURITY.md)).
- **Shared state** — Redis backs queues, rate limits and caches, with
  per-feature fallbacks when it is unavailable
  ([ADR-0003](adr/0003-redis-with-graceful-fallback.md)).
- **Uploads** — content is validated before it is stored
  ([ADR-0004](adr/0004-quarantine-uploads-until-validated.md)) and routed
  to Cloudinary or R2 by size
  ([ADR-0005](adr/0005-hybrid-cloudinary-r2-upload-storage.md)).

## Architecture Decision Records

Design decisions are recorded as ADRs in [`docs/adr/`](adr/README.md).
See the **[ADR index](adr/README.md)** for the full list and for how to
propose a new one (start from [`adr/template.md`](adr/template.md)).

## Further reading

- [README.md](../README.md) — setup, routes and feature status
- [docs/api-versioning.md](api-versioning.md)
- [clips-backend/README.md](../clips-backend/README.md) — backend architecture and services
