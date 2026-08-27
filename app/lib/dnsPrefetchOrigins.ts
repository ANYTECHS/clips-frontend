/**
 * Browser DNS-prefetch targets for the landing critical path (#918).
 *
 * Preconnect for Dicebear is owned by #920 (PR #997, ResourceHints).
 * This module covers DNS resolution only via `<link rel="dns-prefetch">`.
 */

/** Dicebear API — above-the-fold landing and onboarding avatars. */
export const DICEBEAR_ORIGIN = "https://api.dicebear.com";

/**
 * Origins emitted as eager DNS-prefetch hints from the root layout.
 * Limited to browser-relevant hosts needed during initial landing render.
 */
export const DNS_PREFETCH_ORIGINS = [DICEBEAR_ORIGIN] as const;

/** Must not appear as eager DNS-prefetch (server-only, consent-gated, or deferred). */
export const EXCLUDED_DNS_PREFETCH_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://plausible.io",
  "https://api.coingecko.com",
  "https://horizon.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://soroban.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://www.googleapis.com",
  "https://www.tiktok.com",
  "https://open.tiktokapis.com",
] as const;
