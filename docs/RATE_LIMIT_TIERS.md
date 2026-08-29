# API Rate Limit Tiers

Every API route has a base rate limit registered in
[`app/lib/endpointRateLimits.ts`](../app/lib/endpointRateLimits.ts) (see that
file for the full per-endpoint table). On top of that base limit, requests
from authenticated users are scaled by their plan, and can be overridden
individually. Resolution order, highest precedence first:

1. **Per-user override** — an absolute limit or multiplier set for a
   specific user id.
2. **Plan multiplier** — applied to the endpoint's base limit.
3. **Base limit** — used as-is for unauthenticated requests or users with no
   plan on file.

## Plan multipliers

| Plan         | Multiplier | Example: `/api/search` (base 30/min) |
| ------------ | ---------- | ------------------------------------- |
| `free`       | 1x         | 30/min                                |
| `pro`        | 3x         | 90/min                                |
| `enterprise` | 10x        | 300/min                               |

Defined in [`app/lib/rateLimitTiers.ts`](../app/lib/rateLimitTiers.ts) as
`PLAN_RATE_LIMIT_MULTIPLIERS`. The plan is read from `User.plan` in the
database (`free` | `pro` | `enterprise`).

## Per-user overrides

`app/lib/rateLimitTiers.ts` exposes:

- `setUserRateLimitOverride(userId, { limit?, multiplier?, reason? })`
- `removeUserRateLimitOverride(userId)`
- `getUserRateLimitOverride(userId)`
- `getAllUserRateLimitOverrides()`

An override's `limit` (an absolute request count) takes precedence over
`multiplier`, which takes precedence over the user's plan. Overrides live
in-memory for the life of the process — the same tradeoff as the existing
in-memory rate limit store (see `serverRateLimit.ts`); back them with a
database table if they need to survive a restart or be managed outside a
deploy.

## Applying customization in a route

Replace `applyRateLimit(request, getEndpointRateLimit(route))` with:

```ts
import { applyCustomRateLimit } from "@/app/lib/customRateLimit";

export async function POST(request: NextRequest) {
  const limited = await applyCustomRateLimit(request, "/api/upload");
  if (limited) return limited;
  // ...
}
```

This resolves the caller's session/plan, computes the effective limit,
buckets authenticated users by user id (rather than IP, so the limit follows
the user across shared/NAT'd networks), and records the decision for
monitoring.

## Monitoring

Every call to `applyCustomRateLimit` is recorded via
[`app/lib/rateLimitMonitoring.ts`](../app/lib/rateLimitMonitoring.ts).
Aggregated counts (by route and by plan tier) are available at
`GET /api/analytics/rate-limits` (requires an authenticated session) and
rendered in the Analytics dashboard's "Rate Limit Monitoring" panel.
