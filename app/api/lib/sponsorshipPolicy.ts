/**
 * Fee sponsorship policy — decides whether the platform pays the fee for a
 * user's transaction via a fee-bump envelope.
 *
 * A request is sponsored only when:
 * - the inner transaction is sourced and signed by the requesting user,
 * - every operation is an allowed type (NFT mint, trustline, payment),
 * - the user cannot cover the fee from XLM above their minimum reserve,
 * - the user has not used up their monthly sponsorship budget.
 */

import * as StellarSdk from "@stellar/stellar-sdk";

import { prisma } from "@/app/lib/prisma";
import type { StellarNetwork } from "@/app/lib/networkConfig";
import {
  type AccountXlmStatus,
  canCoverFee,
  parseTransactionXdr,
  StellarTransactionError,
} from "@/app/lib/stellarTransaction";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Audit log action recorded for every sponsorship decision. */
export const SPONSORSHIP_AUDIT_ACTION = "sponsorship.fee_bump";

/** Sponsorships each user may receive per calendar month unless overridden. */
export const DEFAULT_MONTHLY_SPONSORSHIP_LIMIT = 10;

/** Operation categories the platform is willing to sponsor. */
export type SponsorableOperation = "mint" | "trustline" | "payment";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InnerTransactionValidation =
  | { ok: true; tx: StellarSdk.Transaction; operations: SponsorableOperation[] }
  | { ok: false; code: string; error: string };

export interface SponsorshipBudget {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Monthly per-user sponsorship budget, read from `SPONSORSHIP_MONTHLY_LIMIT`.
 *
 * @param env - Environment source (injectable for tests).
 */
export function getMonthlySponsorshipLimit(
  env: Record<string, string | undefined> = process.env
): number {
  const parsed = parseInt(env.SPONSORSHIP_MONTHLY_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MONTHLY_SPONSORSHIP_LIMIT;
}

/** First instant of the current calendar month in UTC. */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Operation allow-list ─────────────────────────────────────────────────────

/**
 * Map an operation to a sponsorable category, or null if it is not allowed.
 *
 * @param op - Decoded operation from the inner transaction.
 * @param nftContractId - The platform NFT contract; `mint` calls to any other contract are rejected.
 */
export function classifyOperation(
  op: StellarSdk.Operation,
  nftContractId?: string
): SponsorableOperation | null {
  switch (op.type) {
    case "changeTrust":
      return "trustline";
    case "payment":
      return "payment";
    case "invokeHostFunction": {
      if (!nftContractId) return null;
      const fn = op.func;
      if (fn.switch().value !== StellarSdk.xdr.HostFunctionType.hostFunctionTypeInvokeContract().value) {
        return null;
      }
      const invoke = fn.invokeContract();
      const contractId = StellarSdk.Address.fromScAddress(invoke.contractAddress()).toString();
      const functionName = invoke.functionName().toString();
      return contractId === nftContractId && functionName === "mint" ? "mint" : null;
    }
    default:
      return null;
  }
}

/**
 * Check that an inner transaction is safe to sponsor for `userPublicKey`.
 *
 * @param innerXdr - User-signed inner transaction envelope (base64).
 * @param userPublicKey - The requesting user's Stellar account.
 * @param network - Network the transaction targets.
 * @param nftContractId - Platform NFT contract allowed for `mint` calls.
 */
export function validateInnerTransaction(
  innerXdr: string,
  userPublicKey: string,
  network: StellarNetwork,
  nftContractId?: string
): InnerTransactionValidation {
  let tx: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;
  try {
    tx = parseTransactionXdr(innerXdr, network);
  } catch (err) {
    return {
      ok: false,
      code: "INVALID_XDR",
      error: err instanceof StellarTransactionError ? err.message : "Invalid transaction XDR",
    };
  }

  if (tx instanceof StellarSdk.FeeBumpTransaction) {
    return { ok: false, code: "ALREADY_FEE_BUMPED", error: "Transaction is already fee-bumped." };
  }

  if (tx.source !== userPublicKey) {
    return { ok: false, code: "SOURCE_MISMATCH", error: "Transaction source must be your own account." };
  }

  if (tx.operations.length === 0) {
    return { ok: false, code: "NO_OPERATIONS", error: "Transaction has no operations." };
  }

  if (tx.signatures.length === 0) {
    return {
      ok: false,
      code: "UNSIGNED",
      error: "Sign the transaction before requesting sponsorship.",
    };
  }

  const operations: SponsorableOperation[] = [];
  for (const op of tx.operations) {
    if (op.source && op.source !== userPublicKey) {
      return {
        ok: false,
        code: "SOURCE_MISMATCH",
        error: "Every operation must be sourced from your own account.",
      };
    }
    const category = classifyOperation(op, nftContractId);
    if (!category) {
      return {
        ok: false,
        code: "OPERATION_NOT_ALLOWED",
        error: `Operation "${op.type}" is not eligible for fee sponsorship.`,
      };
    }
    operations.push(category);
  }

  return { ok: true, tx, operations };
}

// ─── Eligibility & budget ─────────────────────────────────────────────────────

/**
 * A user is eligible when their XLM above the minimum reserve cannot pay the fee.
 *
 * @param status - The user's account balance status.
 * @param feeStroops - Fee of the inner transaction, in stroops.
 */
export function isEligibleForSponsorship(status: AccountXlmStatus, feeStroops: number): boolean {
  return !canCoverFee(status, feeStroops);
}

/**
 * Decide whether another sponsorship fits in the user's monthly budget.
 *
 * @param used - Sponsorships already granted this month.
 * @param limit - Monthly budget.
 */
export function evaluateSponsorshipBudget(used: number, limit: number): SponsorshipBudget {
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Count successful sponsorships granted to a user in the current month,
 * using the audit trail as the source of truth.
 *
 * @param userId - Authenticated user id.
 * @param now - Reference time (injectable for tests).
 */
export async function countSponsorshipsThisMonth(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      actorId: userId,
      action: SPONSORSHIP_AUDIT_ACTION,
      status: "success",
      timestamp: { gte: startOfMonthUtc(now) },
    },
  });
}
