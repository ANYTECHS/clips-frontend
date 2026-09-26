/**
 * earningsStore — per-user transaction storage adapter.
 *
 * Mirrors the jobStore pattern: a thin interface backed today by an in-process
 * Map (fine for single-instance / dev). Swap to a Redis or database adapter
 * without touching any route code.
 *
 * In production this store would be populated by a payment webhook handler
 * (e.g. POST /api/earnings/webhook from the payout service). For now it seeds
 * demo transactions the first time a user's data is requested, giving every
 * real authenticated user a stable, reproducible ledger.
 */

import {
  EARNINGS_AMOUNT_RNG_INCREMENT,
  EARNINGS_AMOUNT_RNG_MODULUS,
  EARNINGS_AMOUNT_RNG_MULTIPLIER,
  EARNINGS_AMOUNT_SPREAD_USD,
  EARNINGS_CRYPTO_AMOUNT_DECIMALS,
  EARNINGS_CRYPTO_AMOUNT_JITTER,
  EARNINGS_DATE_RNG_INCREMENT,
  EARNINGS_DATE_RNG_MODULUS,
  EARNINGS_DATE_RNG_MULTIPLIER,
  EARNINGS_FAILED_EVERY_NTH_TRANSACTION,
  EARNINGS_HISTORY_SPREAD_DAYS,
  EARNINGS_MIN_AMOUNT_USD,
  EARNINGS_PENDING_EVERY_NTH_TRANSACTION,
  EARNINGS_SEED_TRANSACTION_COUNT,
  EARNINGS_TX_ID_USER_PREFIX_LENGTH,
  EARNINGS_USD_PER_CRYPTO_UNIT,
  MS_PER_DAY,
} from "@/app/lib/constants";

import type { EarningTransaction } from "./types";

// ─── Store interface ──────────────────────────────────────────────────────────

export interface EarningsStore {
  getTransactions(userId: string): EarningTransaction[];
  addTransaction(userId: string, tx: EarningTransaction): void;
  setTransactions(userId: string, txs: EarningTransaction[]): void;
  hasUser(userId: string): boolean;
}

// ─── In-memory implementation ─────────────────────────────────────────────────

class MapEarningsStore implements EarningsStore {
  private readonly map = new Map<string, EarningTransaction[]>();

  getTransactions(userId: string): EarningTransaction[] {
    if (!this.map.has(userId)) {
      this.map.set(userId, seedTransactions(userId));
    }
    return this.map.get(userId)!;
  }

  addTransaction(userId: string, tx: EarningTransaction): void {
    const existing = this.getTransactions(userId);
    this.map.set(userId, [tx, ...existing]);
  }

  setTransactions(userId: string, txs: EarningTransaction[]): void {
    this.map.set(userId, txs);
  }

  hasUser(userId: string): boolean {
    return this.map.has(userId);
  }
}

export const earningsStore: EarningsStore = new MapEarningsStore();

// ─── Seed helper ──────────────────────────────────────────────────────────────

/**
 * Generates a stable, deterministic set of historical transactions for a user.
 * Uses the userId as a seed so each user gets the same data across server
 * restarts (within a single process lifetime) but different data from other
 * users.
 *
 * Replace this with a real DB query in production.
 */
function seedTransactions(userId: string): EarningTransaction[] {
  // Simple deterministic hash from the userId so different users get
  // slightly different amounts but the same user always sees the same data.
  const seed = userId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const platforms = ["YouTube", "TikTok", "Instagram", "Twitch"] as const;
  const types = ["payout", "royalty", "mint", "referral"] as const;
  const cryptoCurrencies = ["ETH", "SOL", "USDC"] as const;

  const transactions: EarningTransaction[] = [];
  const now = Date.now();

  for (let i = 0; i < EARNINGS_SEED_TRANSACTION_COUNT; i++) {
    const deterministicRand =
      ((seed * (i + 1) * EARNINGS_AMOUNT_RNG_MULTIPLIER + EARNINGS_AMOUNT_RNG_INCREMENT) %
        EARNINGS_AMOUNT_RNG_MODULUS) /
      EARNINGS_AMOUNT_RNG_MODULUS;
    const deterministicRand2 =
      ((seed * (i + 7) * EARNINGS_DATE_RNG_MULTIPLIER + EARNINGS_DATE_RNG_INCREMENT) %
        EARNINGS_DATE_RNG_MODULUS) /
      EARNINGS_DATE_RNG_MODULUS;

    const platform = platforms[i % platforms.length];
    const type = types[i % types.length];
    // ~10% pending, ~6% failed, rest completed — gives realistic tax-ready data
    const status =
      i % EARNINGS_PENDING_EVERY_NTH_TRANSACTION === 0
        ? "pending"
        : i % EARNINGS_FAILED_EVERY_NTH_TRANSACTION === 0
          ? "failed"
          : "completed";
    const amount = parseFloat(
      (EARNINGS_MIN_AMOUNT_USD + deterministicRand * EARNINGS_AMOUNT_SPREAD_USD).toFixed(2)
    );
    // Spread across the last 13 months so trend calculation has two full periods
    const daysAgo = Math.floor(deterministicRand2 * EARNINGS_HISTORY_SPREAD_DAYS);
    const date = new Date(now - daysAgo * MS_PER_DAY).toISOString().split("T")[0];
    const hasCrypto = type === "mint" || type === "royalty";

    transactions.push({
      id: `TX-${userId.slice(0, EARNINGS_TX_ID_USER_PREFIX_LENGTH).toUpperCase()}-${String(i + 1).padStart(5, "0")}`,
      date,
      description: `${platform} ${type} #${i + 1}`,
      amount,
      ...(hasCrypto && {
        cryptoAmount: parseFloat(
          (
            amount / EARNINGS_USD_PER_CRYPTO_UNIT +
            deterministicRand * EARNINGS_CRYPTO_AMOUNT_JITTER
          ).toFixed(EARNINGS_CRYPTO_AMOUNT_DECIMALS)
        ),
        cryptoCurrency: cryptoCurrencies[i % cryptoCurrencies.length],
      }),
      platform,
      type,
      status,
      taxId: `TAX-${String(i + 1).padStart(3, "0")}`,
    });
  }

  // Sort descending by date (newest first)
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
