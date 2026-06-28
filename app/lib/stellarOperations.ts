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
 * createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G...", limit: "1000" }),
 * createPaymentOp({ destination: "G...", amount: "10", assetCode: "USDC", assetIssuer: "G..." }),
 * ];
 *
 * // Pass to useStellarTransaction.executeBatchTransaction or buildBatchTransaction
 */

// ─── Operation type discriminated union ──────────────────────────────────────

/** Send a native XLM or asset payment */
export interface PaymentOperation {
  type: "payment";
  /** The target public key address receiving the payment. */
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
  /** Alphanumeric identifier of the target asset. */
  assetCode: string;
  /** Public address of the entity issuing the asset. */
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
  /** The target master address receiving the remaining native balances. */
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
  /** Account coordinate targeted to receive state sponsorship structures. */
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

/**
 * Instantiates an error representation template for unmapped Soroban invocations.
 * @returns Pre-formatted system error object.
 */
export function invokeContractBuildError(): InvokeContractBuildError {
  return {
    code: INVOKE_CONTRACT_NOT_SUPPORTED_CODE,
    message: INVOKE_CONTRACT_USER_MESSAGE,
  };
}

/**
 * Type-guard validating if an execution outcome block represents a contract compatibility blocker.
 * @param value - Dynamic type check target.
 * @returns True if payload signature explicitly matches target error codes.
 */
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

export function createAddSignerOp(params: {
  ed25519PublicKey: string;
  weight: number;
  source?: string;
}): SetOptionsOperation {
  return createSetOptionsOp({
    signer: {
      ed25519PublicKey: params.ed25519PublicKey,
      weight: params.weight,
    },
    source: params.source,
  });
}

export function createMultisigThresholdsOp(params: {
  lowThreshold: number;
  medThreshold: number;
  highThreshold: number;
  masterWeight?: number;
  source?: string;
}): SetOptionsOperation {
  return createSetOptionsOp({
    lowThreshold: params.lowThreshold,
    medThreshold: params.medThreshold,
    highThreshold: params.highThreshold,
    masterWeight: params.masterWeight,
    source: params.source,
  });
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
 * @param params - Setup criteria configuration.
 * @returns Ordered composite tuple holding the setup trustline operation followed by the payout operation.
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
 *
 * @param params - Market exchange placement metrics.
 * @returns Paired operations ensuring trust allocations match placement.
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
 * Wraps a set of operations in sponsorship boundaries to offload baseline reserve fees.
 *
 * @param sponsorId - The public key funding transaction storage deposits.
 * @param sponsoredId - Account receiving balance-free state changes.
 * @param operations - The child execution block to wrap.
 * @returns Unified array bounded by start and stop sponsorship instructions.
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

/**
 * Specific validation tracking structure highlighting parsing failure coordinates in a transaction collection.
 */
export class BatchValidationError extends Error {
  /**
   * Constructs an instance of BatchValidationError.
   * @param operationIndex - Array position location where schema rules failed evaluation.
   * @param message - Rule conflict description details.
   */
  constructor(
    public readonly operationIndex: number,
    public override readonly message: string
  ) {
    super(`Operation[${operationIndex}]: ${message}`);
    this.name = "BatchValidationError";
  }
}

/**
 * Validate a list of operations before building a transaction.
 * Throws `BatchValidationError` on the first invalid operation found.
 *
 * @param operations - Array collection of transaction structures slated for packaging.
 * @throws {Error} Thrown if block counts violate maximum boundaries or are empty.
 * @throws {BatchValidationError} Thrown if single operation parameter states are malformed.
 */
export function validateOperations(operations: StellarOperation[]): void {
  if (operations.length === 0) {
    throw new Error("Batch must contain at least one operation.");
  }

  if (operations.length > 100) {
    throw new Error
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
        break;

      case "begin_sponsoring_future_reserves":
        if (!op.sponsoredId) {
          throw new BatchValidationError(i, "begin_sponsoring_future_reserves requires a sponsoredId.");
        }
        break;

      case "end_sponsoring_future_reserves":
        break;

      default: {
        const _exhaustive: never = op;
        throw new Error(`Unknown operation type: ${(_exhaustive as StellarOperation).type}`);
      }
    }
  }
}
