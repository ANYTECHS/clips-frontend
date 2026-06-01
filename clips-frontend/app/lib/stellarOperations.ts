/**
 * stellarOperations.ts
 *
 * Typed operation descriptors and builder utilities for Stellar transaction
 * batching. Each descriptor maps 1-to-1 with a Stellar SDK operation so that
 * `buildBatchTransaction` (stellar.ts) can construct the real SDK operations,
 * and `buildTransactionEnvelope` (stellarTransaction.ts) can build mock
 * envelopes for testing.
 *
 * Usage
 * ─────
 * import { createPaymentOp, createChangeTrustOp } from "@/app/lib/stellarOperations";
 *
 * const ops = [
 *   createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G...", limit: "1000" }),
 *   createPaymentOp({ destination: "G...", amount: "10", assetCode: "USDC", assetIssuer: "G..." }),
 * ];
 *
 * // Pass to useStellarTransaction.executeBatchTransaction or buildBatchTransaction
 */

// ─── Operation type discriminated union ──────────────────────────────────────

/** Send a native XLM or asset payment */
export interface PaymentOperation {
  type: "payment";
  destination: string;
  /** Amount as a string (e.g. "10.5") */
  amount: string;
  /** Omit for native XLM */
  assetCode?: string;
  /** Required when assetCode is set */
  assetIssuer?: string;
  /** Optional source account override */
  source?: string;
}

/**
 * Add or modify a trustline for a non-native asset.
 * Set limit to "0" to remove the trustline.
 */
export interface ChangeTrustOperation {
  type: "change_trust";
  assetCode: string;
  assetIssuer: string;
  /** Maximum amount to hold. Defaults to max (922337203685.4775807). Set "0" to remove. */
  limit?: string;
  /** Optional source account override */
  source?: string;
}

/** Create or update a sell offer on the DEX */
export interface ManageSellOfferOperation {
  type: "manage_sell_offer";
  sellingAssetCode?: string;
  sellingAssetIssuer?: string;
  buyingAssetCode?: string;
  buyingAssetIssuer?: string;
  /** Amount of selling asset to sell */
  amount: string;
  /** Price as selling/buying ratio (e.g. "1.5") */
  price: string;
  /** 0 to create a new offer; non-zero to update/delete */
  offerId?: string;
  source?: string;
}

/** Create or update a buy offer on the DEX */
export interface ManageBuyOfferOperation {
  type: "manage_buy_offer";
  sellingAssetCode?: string;
  sellingAssetIssuer?: string;
  buyingAssetCode?: string;
  buyingAssetIssuer?: string;
  /** Amount of buying asset to buy */
  buyAmount: string;
  price: string;
  offerId?: string;
  source?: string;
}

/** Merge source account into destination, transferring all XLM */
export interface AccountMergeOperation {
  type: "account_merge";
  destination: string;
  source?: string;
}

/** Set account options (inflation destination, flags, signers, etc.) */
export interface SetOptionsOperation {
  type: "set_options";
  inflationDest?: string;
  clearFlags?: number;
  setFlags?: number;
  masterWeight?: number;
  lowThreshold?: number;
  medThreshold?: number;
  highThreshold?: number;
  homeDomain?: string;
  signer?: {
    ed25519PublicKey?: string;
    weight: number;
  };
  source?: string;
}

/** Begin sponsoring future reserves for another account */
export interface BeginSponsoringFutureReservesOperation {
  type: "begin_sponsoring_future_reserves";
  sponsoredId: string;
  source?: string;
}

/** End sponsoring future reserves */
export interface EndSponsoringFutureReservesOperation {
  type: "end_sponsoring_future_reserves";
  source?: string;
}

/** Invoke a Soroban smart contract */
export interface InvokeContractOperation {
  type: "invoke_contract";
  contractId: string;
  method: string;
  /** Serialised Soroban args (XDR or JSON-compatible values) */
  args?: unknown[];
  source?: string;
}

/** Soroban implementation plan: SOROBAN_SMART_WALLET_SPIKE.md */
export const INVOKE_CONTRACT_NOT_SUPPORTED_CODE = "INVOKE_CONTRACT_NOT_SUPPORTED" as const;

export const INVOKE_CONTRACT_USER_MESSAGE =
  "Smart contract interactions are not yet supported" as const;

export type InvokeContractBuildError = {
  code: typeof INVOKE_CONTRACT_NOT_SUPPORTED_CODE;
  message: typeof INVOKE_CONTRACT_USER_MESSAGE;
};

export function invokeContractBuildError(): InvokeContractBuildError {
  return {
    code: INVOKE_CONTRACT_NOT_SUPPORTED_CODE,
    message: INVOKE_CONTRACT_USER_MESSAGE,
  };
}

export function isInvokeContractBuildError(
  value: unknown
): value is InvokeContractBuildError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value as InvokeContractBuildError).code === INVOKE_CONTRACT_NOT_SUPPORTED_CODE
  );
}

/** Union of all supported operation descriptors */
export type StellarOperation =
  | PaymentOperation
  | ChangeTrustOperation
  | ManageSellOfferOperation
  | ManageBuyOfferOperation
  | AccountMergeOperation
  | SetOptionsOperation
  | BeginSponsoringFutureReservesOperation
  | EndSponsoringFutureReservesOperation
  | InvokeContractOperation;

// ─── Builder helpers ──────────────────────────────────────────────────────────
// These are thin constructors that add the `type` discriminant so callers
// don't have to type it manually and get full TypeScript inference.

export function createPaymentOp(
  params: Omit<PaymentOperation, "type">
): PaymentOperation {
  return { type: "payment", ...params };
}

export function createChangeTrustOp(
  params: Omit<ChangeTrustOperation, "type">
): ChangeTrustOperation {
  return { type: "change_trust", ...params };
}

export function createManageSellOfferOp(
  params: Omit<ManageSellOfferOperation, "type">
): ManageSellOfferOperation {
  return { type: "manage_sell_offer", ...params };
}

export function createManageBuyOfferOp(
  params: Omit<ManageBuyOfferOperation, "type">
): ManageBuyOfferOperation {
  return { type: "manage_buy_offer", ...params };
}

export function createAccountMergeOp(
  params: Omit<AccountMergeOperation, "type">
): AccountMergeOperation {
  return { type: "account_merge", ...params };
}

export function createSetOptionsOp(
  params: Omit<SetOptionsOperation, "type">
): SetOptionsOperation {
  return { type: "set_options", ...params };
}

export function createBeginSponsoringFutureReservesOp(
  params: Omit<BeginSponsoringFutureReservesOperation, "type">
): BeginSponsoringFutureReservesOperation {
  return { type: "begin_sponsoring_future_reserves", ...params };
}

export function createEndSponsoringFutureReservesOp(
  params: Omit<EndSponsoringFutureReservesOperation, "type"> = {}
): EndSponsoringFutureReservesOperation {
  return { type: "end_sponsoring_future_reserves", ...params };
}

export function createInvokeContractOp(
  params: Omit<InvokeContractOperation, "type">
): InvokeContractOperation {
  return { type: "invoke_contract", ...params };
}

// ─── Common batch presets ─────────────────────────────────────────────────────

/**
 * Returns the two operations needed to establish a trustline and immediately
 * receive a payment in that asset — the most common batch pattern.
 *
 * @example
 * const ops = trustlineAndPayment({
 *   assetCode: "USDC",
 *   assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
 *   destination: userPublicKey,
 *   amount: "100",
 * });
 */
export function trustlineAndPayment(params: {
  assetCode: string;
  assetIssuer: string;
  destination: string;
  amount: string;
  trustLimit?: string;
}): [ChangeTrustOperation, PaymentOperation] {
  return [
    createChangeTrustOp({
      assetCode: params.assetCode,
      assetIssuer: params.assetIssuer,
      limit: params.trustLimit,
    }),
    createPaymentOp({
      destination: params.destination,
      amount: params.amount,
      assetCode: params.assetCode,
      assetIssuer: params.assetIssuer,
    }),
  ];
}

/**
 * Returns the operations needed to place a DEX sell offer after establishing
 * a trustline for the buying asset.
 */
export function trustlineAndSellOffer(params: {
  buyingAssetCode: string;
  buyingAssetIssuer: string;
  sellingAssetCode?: string;
  sellingAssetIssuer?: string;
  amount: string;
  price: string;
  trustLimit?: string;
}): [ChangeTrustOperation, ManageSellOfferOperation] {
  return [
    createChangeTrustOp({
      assetCode: params.buyingAssetCode,
      assetIssuer: params.buyingAssetIssuer,
      limit: params.trustLimit,
    }),
    createManageSellOfferOp({
      sellingAssetCode: params.sellingAssetCode,
      sellingAssetIssuer: params.sellingAssetIssuer,
      buyingAssetCode: params.buyingAssetCode,
      buyingAssetIssuer: params.buyingAssetIssuer,
      amount: params.amount,
      price: params.price,
    }),
  ];
}

/**
 * Wraps a set of operations in sponsorship.
 * The sponsor will pay the reserve requirements for any entries created
 * (e.g. trustlines, offers, data entries) within the wrapped operations.
 *
 * @example
 * const ops = sponsoredOperations(sponsorPublicKey, sponsoredPublicKey, [
 *   createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G..." })
 * ]);
 */
export function sponsoredOperations(
  sponsorId: string,
  sponsoredId: string,
  operations: StellarOperation[]
): StellarOperation[] {
  return [
    createBeginSponsoringFutureReservesOp({ sponsoredId, source: sponsorId }),
    ...operations,
    createEndSponsoringFutureReservesOp({ source: sponsoredId }),
  ];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export class BatchValidationError extends Error {
  constructor(
    public readonly operationIndex: number,
    message: string
  ) {
    super(`Operation[${operationIndex}]: ${message}`);
    this.name = "BatchValidationError";
  }
}

/**
 * Validate a list of operations before building a transaction.
 * Throws `BatchValidationError` on the first invalid operation found.
 */
export function validateOperations(operations: StellarOperation[]): void {
  if (operations.length === 0) {
    throw new Error("Batch must contain at least one operation.");
  }

  // Stellar allows a maximum of 100 operations per transaction
  if (operations.length > 100) {
    throw new Error(
      `Batch contains ${operations.length} operations. Stellar allows a maximum of 100 per transaction.`
    );
  }

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    switch (op.type) {
      case "payment":
        if (!op.destination) {
          throw new BatchValidationError(i, "payment requires a destination address.");
        }
        if (!op.amount || isNaN(Number(op.amount)) || Number(op.amount) <= 0) {
          throw new BatchValidationError(i, "payment requires a positive numeric amount.");
        }
        if (op.assetCode && !op.assetIssuer) {
          throw new BatchValidationError(
            i,
            "payment with a non-native asset requires assetIssuer."
          );
        }
        break;

      case "change_trust":
        if (!op.assetCode) {
          throw new BatchValidationError(i, "change_trust requires assetCode.");
        }
        if (!op.assetIssuer) {
          throw new BatchValidationError(i, "change_trust requires assetIssuer.");
        }
        break;

      case "manage_sell_offer":
      case "manage_buy_offer":
        if (!op.price || isNaN(Number(op.price)) || Number(op.price) <= 0) {
          throw new BatchValidationError(i, `${op.type} requires a positive numeric price.`);
        }
        break;

      case "account_merge":
        if (!op.destination) {
          throw new BatchValidationError(i, "account_merge requires a destination address.");
        }
        break;

      case "invoke_contract":
        if (!op.contractId) {
          throw new BatchValidationError(i, "invoke_contract requires a contractId.");
        }
        if (!op.method) {
          throw new BatchValidationError(i, "invoke_contract requires a method name.");
        }
        break;

      case "set_options":
        // set_options has no required fields — all are optional
        break;

      case "begin_sponsoring_future_reserves":
        if (!op.sponsoredId) {
          throw new BatchValidationError(i, "begin_sponsoring_future_reserves requires a sponsoredId.");
        }
        break;

      case "end_sponsoring_future_reserves":
        // end_sponsoring_future_reserves has no required fields
        break;

      default: {
        // Exhaustiveness check
        const _exhaustive: never = op;
        throw new Error(`Unknown operation type: ${(_exhaustive as StellarOperation).type}`);
      }
    }
  }
}
