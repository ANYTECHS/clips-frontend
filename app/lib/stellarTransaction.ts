/**
 * stellarTransaction.ts
 *
 * Handles Stellar transaction submission with proper sequence number management
 * and retry logic for sequence number conflicts (tx_bad_seq errors).
 *
 * Background
 * ──────────
 * Stellar accounts have a sequence number that must be incremented by exactly 1
 * for each transaction. If two transactions are submitted concurrently, or if a
 * cached sequence number is stale (e.g. after a page refresh), the network
 * returns a `tx_bad_seq` error. The correct fix is to re-fetch the account's
 * current sequence number from Horizon and rebuild + resubmit the transaction.
 *
 * Retry strategy
 * ──────────────
 * - Sequence number errors (tx_bad_seq): re-fetch sequence number and retry
 * immediately (up to MAX_SEQ_RETRIES times).
 * - Transient network errors: exponential backoff with jitter.
 * - Non-retryable errors (tx_failed, insufficient_balance, etc.): throw immediately.
 *
 * Production upgrade path
 * ───────────────────────
 * Replace the mock `HorizonClient` and `buildTransaction` stubs with real
 * @stellar/stellar-sdk calls:
 *
 * import { Server, TransactionBuilder, Networks, Operation, Asset } from "@stellar/stellar-sdk";
 * const server = new Server(horizonUrl);
 * const account = await server.loadAccount(publicKey);
 * const tx = new TransactionBuilder(account, { fee, networkPassphrase })
 * .addOperation(...)
 * .setTimeout(30)
 * .build();
 * tx.sign(keypair);
 * const result = await server.submitTransaction(tx);
 */

import { STELLAR_NETWORKS, StellarNetwork } from "./embeddedWallet";
import { StellarOperation, validateOperations } from "./stellarOperations";
import { BASE_BACKOFF_MS } from "@/app/lib/constants";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum retries specifically for sequence number conflicts */
const MAX_SEQ_RETRIES = 3;

/** Maximum retries for transient network errors */
const MAX_NETWORK_RETRIES = 3;

// ─── Error types ──────────────────────────────────────────────────────────────

/** Unique identification string organizing transaction sub-errors */
export type StellarErrorCode =
  | "tx_bad_seq"          // Sequence number mismatch — retryable after re-fetch
  | "tx_failed"           // Transaction failed on-chain — not retryable
  | "tx_insufficient_fee" // Fee too low — not retryable without fee bump
  | "tx_no_account"       // Source account does not exist
  | "tx_bad_auth"         // Invalid signature
  | "network_error"       // HTTP / connectivity error — retryable
  | "timeout"             // Submission timed out — retryable
  | "unknown";            // Unclassified error

/**
 * Standardized application error exception tracking failures occurring during transaction pipelines.
 */
export class StellarTransactionError extends Error {
  /**
   * Constructs an instance of StellarTransactionError.
   * @param code - Taxonomy tag matching the targeted ledger execution failure reason.
   * @param message - Structural descriptive text details.
   * @param retryable - Boolean indicator guiding auto-recovery loop paths.
   * @param attempt - Step increment tracker logging transaction iteration levels.
   */
  constructor(
    public readonly code: StellarErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly attempt?: number
  ) {
    super(message);
    this.name = "StellarTransactionError";
  }
}

/**
 * Evaluates whether a generic error code warrants a retry.
 * @param code - The error categorization code.
 * @returns True if retry rules apply to the category.
 */
function isRetryable(code: StellarErrorCode): boolean {
  return code === "network_error" || code === "timeout";
}

/**
 * Identifies if an error is a sequence number conflict.
 * @param code - The error categorization code.
 * @returns True if error implies sequence divergence.
 */
function isSeqError(code: StellarErrorCode): boolean {
  return code === "tx_bad_seq";
}

// ─── Horizon response types (subset) ─────────────────────────────────────────

/** Subset layout mapping standard account details from Horizon endpoints. */
export interface HorizonAccountResponse {
  /** 64-bit sequence identifier string. */
  sequence: string;
  balances: Array<{ asset_type: string; balance: string }>;
}

/** Packaging containing confirmation markers from Horizon upon transaction processing. */
export interface HorizonSubmitResponse {
  hash: string;
  ledger: number;
  successful: boolean;
}

/** Structural diagnostic descriptor container holding ledger failure parameters. */
export interface HorizonErrorResponse {
  status: number;
  extras?: {
    result_codes?: {
      transaction?: string;
      operations?: string[];
    };
  };
}

// ─── Transaction payload ──────────────────────────────────────────────────────

/** Single-operation payload structural mapping wrapper. */
export interface StellarTransactionPayload {
  sourcePublicKey: string;
  operationType: string;
  operationParams: Record<string, unknown>;
  network: StellarNetwork;
  memo?: string;
}

/**
 * Multi-operation container payload enabling atomic transaction batches.
 */
export interface BatchTransactionPayload {
  /** Source coordinate executing and authorizing the transaction block. */
  sourcePublicKey: string;
  /** Ordered multi-operation array collection (maximum of 100). */
  operations: StellarOperation[];
  /** Target ledger layout identifier context. */
  network: StellarNetwork;
  /** Optional transaction memo text string (maximum of 28 bytes). */
  memo?: string;
}

/** Contextual summary log object mapping transaction finalization metrics. */
export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  sequenceUsed: string;
  attempts: number;
  operationCount: number;
}

// ─── Horizon client ──────────────────────────────────────────────────────────

/**
 * Fetch the current sequence number for an account from Horizon.
 *
 * @param publicKey - Target address query endpoint.
 * @param network - Active network target.
 * @returns Resolves with the string representation of the current sequence index.
 * @throws {StellarTransactionError} Thrown if account is absent (404) or connection fails.
 */
export async function fetchAccountSequence(
  publicKey: string,
  network: StellarNetwork
): Promise<string> {
  const { horizonUrl } = STELLAR_NETWORKS[network];
  const url = `${horizonUrl}/accounts/${encodeURIComponent(publicKey)}`;

  const res = await fetch(url);

  if (res.status === 404) {
    throw new StellarTransactionError(
      "tx_no_account",
      `Account ${publicKey} does not exist on ${network}. Fund it via Friendbot first.`,
      false
    );
  }

  if (!res.ok) {
    throw new StellarTransactionError(
      "network_error",
      `Failed to fetch account sequence: HTTP ${res.status}`,
      true
    );
  }

  const data: HorizonAccountResponse = await res.json();
  return data.sequence;
}

/**
 * Build and sign a Stellar transaction envelope (XDR).
 *
 * @param payload - Target action collection mapping criteria.
 * @param sequence - The exact sequence identifier string targeted for calculation.
 * @param secretKey - Secure local execution identity key used for generation.
 * @returns Base64-encoded mock transaction envelope.
 */
export function buildTransactionEnvelope(
  payload: StellarTransactionPayload | BatchTransactionPayload,
  sequence: string,
  secretKey: string
): string {
  const isBatch = "operations" in payload;
  const operations = isBatch
    ? payload.operations
    : [{ type: payload.operationType, ...payload.operationParams }];

  const mockEnvelope = btoa(
    JSON.stringify({
      source: payload.sourcePublicKey,
      sequence,
      operations,
      operationCount: operations.length,
      memo: payload.memo,
      sig: btoa(`${secretKey.slice(0, 8)}:${sequence}`),
    })
  );
  return mockEnvelope;
}

/**
 * Submit a signed transaction envelope to Horizon.
 *
 * @param envelope - Base64 encoded operational payload stream.
 * @param network - Target network target.
 * @returns Resolves with the receipt details.
 * @throws {StellarTransactionError} Mapping specific ledger rejection exceptions.
 */
export async function submitEnvelope(
  envelope: string,
  network: StellarNetwork
): Promise<HorizonSubmitResponse> {
  const { horizonUrl } = STELLAR_NETWORKS[network];

  const res = await fetch(`${horizonUrl}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `tx=${encodeURIComponent(envelope)}`,
  });

  if (res.ok) {
    const data = await res.json();
    return data as HorizonSubmitResponse;
  }

  let errorBody: HorizonErrorResponse = { status: res.status };
  try {
    errorBody = await res.json();
  } catch {
    // ignore parse errors
  }

  const txCode = errorBody.extras?.result_codes?.transaction ?? "";

  if (txCode === "tx_bad_seq") {
    throw new StellarTransactionError(
      "tx_bad_seq",
      "Sequence number mismatch. The account sequence has changed since the transaction was built.",
      true
    );
  }

  if (txCode === "tx_bad_auth") {
    throw new StellarTransactionError(
      "tx_bad_auth",
      "Transaction signature is invalid. Check that the correct secret key was used.",
      false
    );
  }

  if (txCode === "tx_insufficient_fee") {
    throw new StellarTransactionError(
      "tx_insufficient_fee",
      "Transaction fee is too low. Increase the base fee and retry.",
      false
    );
  }

  if (txCode === "tx_no_account") {
    throw new StellarTransactionError(
      "tx_no_account",
      "Source account does not exist on the network.",
      false
    );
  }

  if (txCode === "tx_failed") {
    const opCodes = errorBody.extras?.result_codes?.operations?.join(", ") ?? "unknown";
    throw new StellarTransactionError(
      "tx_failed",
      `Transaction failed on-chain. Operation result codes: ${opCodes}`,
      false
    );
  }

  if (res.status >= 500 || res.status === 429) {
    throw new StellarTransactionError(
      "network_error",
      `Horizon returned HTTP ${res.status}. This is likely a transient error.`,
      true
    );
  }

  throw new StellarTransactionError(
    "unknown",
    `Unexpected Horizon error: HTTP ${res.status}, tx_code: ${txCode || "none"}`,
    false
  );
}

/** Calculates structural wait delays using full randomized jitter constraints. */
function backoffDelay(attempt: number): Promise<void> {
  const cap = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const delay = Math.random() * cap;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ─── Main submission function ─────────────────────────────────────────────────

/**
 * Submit a Stellar transaction with automatic sequence number retry logic.
 *
 * @param payload - Transaction details mapping operations and source criteria.
 * @param secretKey - Signing credentials seed.
 * @param onRetry - Optional status callback invoked before execution loop retries.
 * @returns Resolves with tracking metadata summarizing successful submission.
 * @throws {StellarTransactionError} For persistent loop failures or unhandled conditions.
 */
export async function submitStellarTransaction(
  payload: StellarTransactionPayload | BatchTransactionPayload,
  secretKey: string,
  onRetry?: (info: { attempt: number; reason: StellarErrorCode; nextDelayMs: number }) => void
): Promise<StellarTransactionResult> {
  if ("operations" in payload) {
    validateOperations(payload.operations);
  }

  const operationCount =
    "operations" in payload ? payload.operations.length : 1;

  let seqRetries = 0;
  let networkRetries = 0;
  let totalAttempts = 0;
  let currentSequence: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    totalAttempts++;

    try {
      if (currentSequence === null) {
        currentSequence = await fetchAccountSequence(
          payload.sourcePublicKey,
          payload.network
        );
      }

      const nextSequence = (BigInt(currentSequence) + 1n).toString();
      const envelope = buildTransactionEnvelope(payload, nextSequence, secretKey);
      const result = await submitEnvelope(envelope, payload.network);

      return {
        hash: result.hash,
        ledger: result.ledger,
        sequenceUsed: nextSequence,
        attempts: totalAttempts,
        operationCount,
      };
    } catch (err) {
      if (!(err instanceof StellarTransactionError)) {
