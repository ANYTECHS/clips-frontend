# ADR-0003: Redis for shared state, with graceful fallback when it is down

- **Status:** Accepted
- **Date:** 2026-11-23 (recorded retroactively)
- **Deciders:** ClipCash maintainers

## Context

Redis backs BullMQ job queues, the throttler storage, brute-force counters,
caching and other short-lived shared state. A Redis outage should not turn
every authenticated request into a `500`.

## Decision

All simple Redis commands go through the safe wrappers in
`clips-backend/src/redis/redis.service.ts` (`safeExecute`, `get`, `incr`,
`ttl`, …). They return a typed fallback instead of throwing when Redis is
unavailable, and `isAvailable()` provides a cheap health check.

Each caller chooses the fallback that matches its risk:

- **Fail open** where blocking users would be worse than the risk — e.g.
  login brute-force counters and caches.
- **Fall back to in-process state** where failing open would enable abuse —
  e.g. the password-reset rate limiter keeps per-instance counters while
  Redis is down.

## Consequences

- The API stays up during Redis incidents, with degraded (per-instance)
  rate limiting and no caching.
- Every new Redis consumer must decide and document its fallback behaviour.
- In-process fallbacks are not shared across instances, so limits are
  approximate during an outage.

## Alternatives considered

- **Let Redis errors propagate** — a cache/limiter outage becomes a full
  outage.
- **Fail open everywhere** — makes email and SMS endpoints spammable during
  an outage.

## References

- `clips-backend/src/redis/redis.service.ts`
- `clips-backend/src/auth/brute-force-protection.service.ts`
- `clips-backend/src/auth/password-reset-rate-limiter.service.ts`
