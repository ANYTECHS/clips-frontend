/**
 * Resource hint targets for the landing critical path (#920).
 *
 * Preconnect is limited to origins required during initial landing render.
 * Analytics, Stellar, and other deferred origins are intentionally excluded.
 */

/** Dicebear API - serves above-the-fold landing hero avatar SVGs. */
export const DICEBEAR_ORIGIN = "https://api.dicebear.com";

/** Leftmost landing hero avatar; preloaded via next/image `priority`. */
export const LANDING_HERO_PRIMARY_AVATAR_SRC =
  `${DICEBEAR_ORIGIN}/7.x/avataaars/svg?seed=Felix`;

export const LANDING_HERO_AVATAR_SEEDS = ["Felix", "Aneka", "Jocelyn"] as const;

export function landingHeroAvatarSrc(seed: (typeof LANDING_HERO_AVATAR_SEEDS)[number]) {
  return `${DICEBEAR_ORIGIN}/7.x/avataaars/svg?seed=${seed}`;
}

/** Must not appear as eager preconnect (consent-gated or not on landing critical path). */
export const DEFERRED_PRECONNECT_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://plausible.io",
  "https://horizon.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://soroban.stellar.org",
  "https://soroban-testnet.stellar.org",
] as const;
