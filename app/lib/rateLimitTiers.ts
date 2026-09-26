/**
 * Rate limit customization — per-user and per-plan multipliers layered on
 * top of the base per-endpoint limits in app/lib/endpointRateLimits.ts.
 *
 * Resolution order (highest precedence first):
 *   1. A per-user override (support/ops granted a one-off higher ceiling).
 *   2. The requesting user's plan multiplier.
 *   3. The endpoint's base limit (unauthenticated / no plan on file).
 *
 * See docs/RATE_LIMIT_TIERS.md for the documented tiers and how to grant
 * an override.
 */

import type { EndpointRateLimit } from "@/app/lib/endpointRateLimits";

export type PlanTier = "free" | "pro" | "enterprise";

/** Multiplier applied to an endpoint's base limit for each plan. */
export const PLAN_RATE_LIMIT_MULTIPLIERS: Record<PlanTier, number> = {
  free: 1,
  pro: 3,
  enterprise: 10,
};

export interface UserRateLimitOverride {
  /** Absolute request limit, replacing the plan-derived limit entirely. */
  limit?: number;
  /** Multiplier applied to the endpoint's base limit instead of the plan's. */
  multiplier?: number;
  /** Human-readable justification, surfaced in the monitoring dashboard. */
  reason?: string;
}

/**
 * In-memory override registry, keyed by user id. Mirrors the
 * serverRateLimit/earningsStore pattern — swap for a database table if
 * overrides need to survive a restart or be managed outside a deploy.
 */
const userOverrides = new Map<string, UserRateLimitOverride>();

export function setUserRateLimitOverride(userId: string, override: UserRateLimitOverride): void {
  userOverrides.set(userId, override);
}

export function removeUserRateLimitOverride(userId: string): void {
  userOverrides.delete(userId);
}

export function getUserRateLimitOverride(userId: string): UserRateLimitOverride | undefined {
  return userOverrides.get(userId);
}

export function getAllUserRateLimitOverrides(): Record<string, UserRateLimitOverride> {
  return Object.fromEntries(userOverrides);
}

function resolvePlanMultiplier(plan?: string): number {
  if (plan && plan in PLAN_RATE_LIMIT_MULTIPLIERS) {
    return PLAN_RATE_LIMIT_MULTIPLIERS[plan as PlanTier];
  }
  return 1;
}

/**
 * Computes the effective rate limit for a request given the endpoint's base
 * config and the requesting user's id/plan (both optional — unauthenticated
 * requests get the base limit unmodified).
 */
export function getEffectiveRateLimit(
  base: EndpointRateLimit,
  userId?: string,
  plan?: string
): EndpointRateLimit {
  const override = userId ? userOverrides.get(userId) : undefined;

  if (override?.limit !== undefined) {
    return { ...base, limit: override.limit };
  }
  if (override?.multiplier !== undefined) {
    return { ...base, limit: Math.round(base.limit * override.multiplier) };
  }

  const multiplier = resolvePlanMultiplier(plan);
  return { ...base, limit: Math.round(base.limit * multiplier) };
}
