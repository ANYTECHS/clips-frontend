/**
 * In-memory transform quota store.
 *
 * Follows the same no-database pattern used by platformConnections.ts and
 * the job store in app/api/jobs/[id]/route.ts.
 *
 * Plan limits (transforms per calendar month, UTC):
 *   free       →  3
 *   pro        → 50
 *   enterprise → Infinity (unlimited)
 *
 * Quotas reset on the 1st of each month at 00:00 UTC.
 */

export type Plan = "free" | "pro" | "enterprise";

/** Monthly limit per plan. */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 50,
  enterprise: Infinity,
};

interface QuotaRecord {
  userId: string;
  plan: Plan;
  /** Number of transforms consumed in the current billing period. */
  used: number;
  /**
   * ISO-8601 timestamp of the next reset (1st of the following month, 00:00 UTC).
   * Stored so we can return it to callers without recomputing every request.
   */
  resetAt: string;
}

/** Keyed by userId for O(1) look-up. */
const store = new Map<string, QuotaRecord>();

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

/** Returns an ISO-8601 string for 00:00 UTC on the 1st of next month. */
export function nextResetDate(from: Date = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );
  return d.toISOString();
}

/**
 * Returns true when the stored resetAt timestamp has passed, meaning the
 * current billing period has expired and the quota should be cleared.
 */
function isExpired(record: QuotaRecord): boolean {
  return Date.now() >= new Date(record.resetAt).getTime();
}

/* ─── Public API ─────────────────────────────────────────────────────────────── */

/**
 * Fetch (or lazily create) the quota record for a user.
 * Automatically resets `used` to 0 when the billing period has rolled over.
 */
export function getQuota(userId: string, plan: Plan): QuotaRecord {
  let record = store.get(userId);

  if (!record) {
    record = {
      userId,
      plan,
      used: 0,
      resetAt: nextResetDate(),
    };
    store.set(userId, record);
    return record;
  }

  // Always keep the plan in sync (user may have upgraded/downgraded).
  record.plan = plan;

  // Roll over if the billing period has expired.
  if (isExpired(record)) {
    record.used = 0;
    record.resetAt = nextResetDate();
  }

  return record;
}

/**
 * Returns the number of transforms remaining for this billing period.
 * `Infinity` for enterprise users.
 */
export function getRemainingQuota(userId: string, plan: Plan): number {
  const record = getQuota(userId, plan);
  const limit = PLAN_LIMITS[plan];
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - record.used);
}

/**
 * Attempts to consume one transform credit.
 *
 * @returns `{ allowed: true, remaining: number }` when quota is available.
 * @returns `{ allowed: false, remaining: 0, resetAt: string }` when exhausted.
 */
export function consumeQuota(
  userId: string,
  plan: Plan
): { allowed: true; remaining: number } | { allowed: false; remaining: 0; resetAt: string } {
  const record = getQuota(userId, plan);
  const limit = PLAN_LIMITS[plan];

  // Enterprise = unlimited.
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }

  if (record.used >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.used += 1;
  return { allowed: true, remaining: limit - record.used };
}

/**
 * Forcibly set the used count for a user — useful for seeding test data
 * or admin overrides.
 */
export function setUsed(userId: string, plan: Plan, used: number): void {
  const record = getQuota(userId, plan);
  record.used = Math.max(0, used);
}
