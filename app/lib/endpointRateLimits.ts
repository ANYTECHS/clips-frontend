/**
 * app/lib/endpointRateLimits.ts
 *
 * Endpoint-specific rate limit configuration — Issue #892.
 *
 * Defines per-endpoint rate limits and provides a typed helper that reads
 * the right config for a given route pattern, so each endpoint carries its
 * own throttling policy rather than sharing a global default.
 *
 * Usage:
 *   import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
 *   import { applyRateLimit } from "@/app/lib/serverRateLimit";
 *
 *   export async function POST(req: NextRequest) {
 *     const cfg = getEndpointRateLimit("/api/upload");
 *     const limited = await applyRateLimit(req, cfg);
 *     if (limited) return limited;
 *     // ...
 *   }
 *
 * Documentation:
 *   All limits apply per unique client (IP or x-forwarded-for header).
 *   Limits reset at the end of each fixed window.
 *
 * ┌─────────────────────────────────────────┬────────┬──────────┐
 * │ Route                                   │ limit  │ window   │
 * ├─────────────────────────────────────────┼────────┼──────────┤
 * │ /api/upload           (POST)            │   20   │ 1 min    │
 * │ /api/jobs/[id]        (GET)             │  120   │ 1 min    │
 * │ /api/jobs/[id]        (POST restart)    │   10   │ 1 min    │
 * │ /api/jobs/[id]/stream (GET SSE)         │   30   │ 1 min    │
 * │ /api/jobs/[id]/callback (POST AI cb)    │   60   │ 1 min    │
 * │ /api/transform        (POST)            │   20   │ 1 min    │
 * │ /api/transform/[id]   (GET)             │   60   │ 1 min    │
 * │ /api/transform/batch  (POST)            │   10   │ 1 min    │
 * │ /api/dashboard        (GET)             │   60   │ 1 min    │
 * │ /api/earnings         (GET)             │   60   │ 1 min    │
 * │ /api/clips            (GET/DELETE)      │   60   │ 1 min    │
 * │ /api/search           (GET)             │   30   │ 1 min    │
 * │ /api/auth/passkey     (POST)            │   10   │ 1 min    │
 * │ /api/recovery         (POST)            │    5   │ 1 min    │
 * │ /api/nft/mint         (POST)            │   10   │ 1 min    │
 * │ /api/user/profile     (GET/PATCH)       │   30   │ 1 min    │
 * │ /api/billing          (POST/GET)        │   20   │ 1 min    │
 * │ /api/analytics        (POST)            │  100   │ 1 min    │
 * │ /api/csp-report       (POST)            │   10   │ 1 min    │
 * │ default (unregistered endpoints)        │   60   │ 1 min    │
 * └─────────────────────────────────────────┴────────┴──────────┘
 */

export interface EndpointRateLimit {
  /** Maximum requests per window per client. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /**
   * Optional human-readable description for docs / observability.
   * Not sent in responses.
   */
  description?: string;
}

/** Default limit applied to any endpoint not explicitly registered. */
export const DEFAULT_RATE_LIMIT: EndpointRateLimit = {
  limit: 60,
  windowMs: 60_000,
  description: "Default: 60 req/min",
};

/**
 * Registry of per-endpoint rate limits.
 * Keys are the canonical Next.js route path (with [id] placeholders).
 */
const ENDPOINT_LIMITS: Record<string, EndpointRateLimit> = {
  // ── Upload ─────────────────────────────────────────────────────────────────
  "/api/upload": {
    limit: 20,
    windowMs: 60_000,
    description: "20 uploads/min — prevents storage abuse",
  },

  // ── Jobs ───────────────────────────────────────────────────────────────────
  "/api/jobs/[id]": {
    limit: 120,
    windowMs: 60_000,
    description: "120 job polls/min — generous for SSE fallback polling",
  },
  "/api/jobs/[id]/restart": {
    limit: 10,
    windowMs: 60_000,
    description: "10 restarts/min — prevents runaway re-queue loops",
  },
  "/api/jobs/[id]/stream": {
    limit: 30,
    windowMs: 60_000,
    description: "30 SSE connections/min",
  },
  "/api/jobs/[id]/callback": {
    limit: 60,
    windowMs: 60_000,
    description: "60 AI callbacks/min — one per second headroom",
  },
  "/api/jobs/metrics": {
    limit: 30,
    windowMs: 60_000,
    description: "30 metric polls/min",
  },

  // ── Transform ──────────────────────────────────────────────────────────────
  "/api/transform": {
    limit: 20,
    windowMs: 60_000,
    description: "20 transforms/min — GPU-backed; expensive",
  },
  "/api/transform/[id]": {
    limit: 60,
    windowMs: 60_000,
    description: "60 transform status polls/min",
  },
  "/api/transform/batch": {
    limit: 10,
    windowMs: 60_000,
    description: "10 batch submissions/min",
  },
  "/api/transform/preview": {
    limit: 15,
    windowMs: 60_000,
    description: "15 preview requests/min",
  },

  // ── Dashboard / Earnings ───────────────────────────────────────────────────
  "/api/dashboard": {
    limit: 60,
    windowMs: 60_000,
    description: "60 dashboard loads/min",
  },
  "/api/dashboard/stream": {
    limit: 20,
    windowMs: 60_000,
    description: "20 dashboard SSE connections/min",
  },
  "/api/earnings": {
    limit: 60,
    windowMs: 60_000,
    description: "60 earnings loads/min",
  },
  "/api/earnings/transactions": {
    limit: 60,
    windowMs: 60_000,
    description: "60 transaction list loads/min",
  },

  // ── Clips ──────────────────────────────────────────────────────────────────
  "/api/clips": {
    limit: 60,
    windowMs: 60_000,
    description: "60 clip list loads/min",
  },
  "/api/clips/[id]": {
    limit: 60,
    windowMs: 60_000,
    description: "60 clip detail loads/min",
  },
  "/api/clips/post": {
    limit: 30,
    windowMs: 60_000,
    description: "30 social post submissions/min",
  },
  "/api/clips/mint": {
    limit: 10,
    windowMs: 60_000,
    description: "10 clip mints/min",
  },
  "/api/clips/archive": {
    limit: 30,
    windowMs: 60_000,
    description: "30 archive actions/min",
  },

  // ── Search / Explore ───────────────────────────────────────────────────────
  "/api/search": {
    limit: 30,
    windowMs: 60_000,
    description: "30 searches/min",
  },
  "/api/explore": {
    limit: 60,
    windowMs: 60_000,
    description: "60 explore loads/min",
  },
  "/api/explore/trending": {
    limit: 60,
    windowMs: 60_000,
    description: "60 trending loads/min",
  },

  // ── Auth / Recovery ────────────────────────────────────────────────────────
  "/api/auth/passkey": {
    limit: 10,
    windowMs: 60_000,
    description: "10 passkey ops/min — hardware-bound; low volume expected",
  },
  "/api/recovery": {
    limit: 5,
    windowMs: 60_000,
    description: "5 recovery attempts/min — brute-force protection",
  },
  "/api/recovery/initiate": {
    limit: 5,
    windowMs: 60_000,
    description: "5 recovery initiations/min",
  },
  "/api/recovery/approve": {
    limit: 10,
    windowMs: 60_000,
    description: "10 approvals/min",
  },

  // ── NFT ────────────────────────────────────────────────────────────────────
  "/api/nft/mint": {
    limit: 10,
    windowMs: 60_000,
    description: "10 mints/min — on-chain; expensive",
  },

  // ── User ───────────────────────────────────────────────────────────────────
  "/api/user/profile": {
    limit: 30,
    windowMs: 60_000,
    description: "30 profile reads or updates/min",
  },
  "/api/user/privacy": {
    limit: 20,
    windowMs: 60_000,
    description: "20 privacy setting changes/min",
  },
  "/api/user/passkey": {
    limit: 10,
    windowMs: 60_000,
    description: "10 passkey management ops/min",
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  "/api/billing": {
    limit: 20,
    windowMs: 60_000,
    description: "20 billing ops/min",
  },
  "/api/billing/plans": {
    limit: 60,
    windowMs: 60_000,
    description: "60 plan list loads/min",
  },
  "/api/billing/checkout": {
    limit: 10,
    windowMs: 60_000,
    description: "10 checkout initiations/min",
  },
  "/api/billing/webhook": {
    limit: 100,
    windowMs: 60_000,
    description: "100 webhook callbacks/min from payment processor",
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  "/api/analytics": {
    limit: 100,
    windowMs: 60_000,
    description: "100 analytics events/min — high-volume beacon traffic",
  },

  // ── Misc ───────────────────────────────────────────────────────────────────
  "/api/csp-report": {
    limit: 10,
    windowMs: 60_000,
    description: "10 CSP violation reports/min per client",
  },
  "/api/referral": {
    limit: 20,
    windowMs: 60_000,
    description: "20 referral loads/min",
  },
  "/api/insights": {
    limit: 30,
    windowMs: 60_000,
    description: "30 insight loads/min",
  },
  "/api/prices": {
    limit: 60,
    windowMs: 60_000,
    description: "60 price lookups/min",
  },
  "/api/prices/xlm": {
    limit: 60,
    windowMs: 60_000,
    description: "60 XLM price polls/min",
  },
  "/api/notifications": {
    limit: 60,
    windowMs: 60_000,
    description: "60 notification reads/min",
  },
  "/api/projects": {
    limit: 60,
    windowMs: 60_000,
    description: "60 project list loads/min",
  },
  "/api/sponsorship": {
    limit: 20,
    windowMs: 60_000,
    description: "20 sponsorship queries/min",
  },
  "/api/wallet/history": {
    limit: 30,
    windowMs: 60_000,
    description: "30 wallet history loads/min",
  },
  "/api/captions": {
    limit: 20,
    windowMs: 60_000,
    description: "20 caption generations/min",
  },
};

/**
 * Returns the rate limit config for the given route.
 *
 * Pass the canonical Next.js route path with bracket placeholders, e.g.
 * `/api/jobs/[id]`, and the function performs an exact lookup before falling
 * back to the default.
 *
 * @param route - Canonical route path (must begin with `/api/`).
 */
export function getEndpointRateLimit(route: string): EndpointRateLimit {
  return ENDPOINT_LIMITS[route] ?? DEFAULT_RATE_LIMIT;
}

/**
 * Returns every registered endpoint and its configured limit.
 * Useful for generating documentation or monitoring dashboards.
 */
export function getAllEndpointRateLimits(): Record<string, EndpointRateLimit> {
  return { ...ENDPOINT_LIMITS };
}
