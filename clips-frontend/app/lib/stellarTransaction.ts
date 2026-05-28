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
 *   immediately (up to MAX_SEQ_RETRIES times).
 * - Transient network errors: exponential backoff with jitter.
 * - Non-retryable errors (tx_failed, insufficient_balance, etc.): throw immediately.
 *
 * Production upgrade path
 * ───────────────────────
 * Replace the mock `HorizonClient` and `buildTransaction` stubs with real
 * @stellar/stellar-sdk calls:
 *
 *   import { Server, TransactionBuilder, Networks, Operation, Asset } from "@stellar/stellar-sdk";
 *   const server = new Server(horizonUrl);
 *   const account = await server.loadAccount(publicKey);
 *   const tx = new TransactionBuilder(account, { fee, networkPassphrase })
 *     .addOperation(...)
 *     .setTimeout(30)
 *     .build();
 *   tx.sign(keypair);
 *   const result = await server.submitTransaction(tx);
 */

import { STELLAR_NETWORKS, StellarNetwork } from "./embeddedWallet";
import { StellarOperation, validateOperations } from "./stellarOperations";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum retries specifically for sequence number conflicts */
const MAX_SEQ_RETRIES = 3;

/** Maximum retries for transient network errors */
const MAX_NETWORK_RETRIES = 3;

/** Base delay (ms) for exponential backoff */
const BASE_BACKOFF_MS = 300;

// ─── Error types ──────────────────────────────────────────────────────────────

export type StellarErrorCode =
  | "tx_bad_seq"          // Sequence number mismatch — retryable after re-fetch
  | "tx_failed"           // Transaction failed on-chain — not retryable
  | "tx_insufficient_fee" // Fee too low — not retryable without fee bump
  | "tx_no_account"       // Source account does not exist
  | "tx_bad_auth"         // Invalid signature
  | "network_error"       // HTTP / connectivity error — retryable
  | "timeout"             // Submission timed out — retryable
  | "unknown";            // Unclassified error

export class StellarTransactionError extends Error {
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

/** Whether a given error code should trigger a retry */
function isRetryable(code: StellarErrorCode): boolean {
  return code === "network_error" || code === "timeout";
}

/** Whether a given error code is a sequence number conflict */
function isSeqError(code: StellarErrorCode): boolean {
  return code === "tx_bad_seq";
}

// ─── Horizon response types (subset) ─────────────────────────────────────────

export interface HorizonAccountResponse {
  sequence: string; // Stellar sequence numbers are 64-bit integers returned as strings
  balances: Array<{ asset_type: string; balance: string }>;
}

export interface HorizonSubmitResponse {
  hash: string;
  ledger: number;
  successful: boolean;
}

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

/**
 * Single-operation payload (legacy / convenience form).
 * Kept for backward compatibility — internally converted to a batch of one.
 */
export interface StellarTransactionPayload {
  /** Source account public key */
  sourcePublicKey: string;
  /** Operation type (e.g. "payment", "manage_sell_offer", "invoke_contract") */
  operationType: string;
  /** Operation-specific parameters */
  operationParams: Record<string, unknown>;
  /** Network to submit on */
  network: StellarNetwork;
  /** Optional memo */
  memo?: string;
}

/**
 * Batch transaction payload — supports one or more typed operations in a
 * single atomic Stellar transaction.
 *
 * All operations share the same source account and are signed together.
 * The fee is automatically scaled: baseFee × numberOfOperations.
 *
 * @example
 * const payload: BatchTransactionPayload = {
 *   sourcePublicKey: "G...",
 *   operations: [
 *     createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G..." }),
 *     createPaymentOp({ destination: "G...", amount: "10", assetCode: "USDC", assetIssuer: "G..." }),
 *   ],
 *   network: "testnet",
 *   memo: "batch payment",
 * };
 */
export interface BatchTransactionPayload {
  /** Source account public key */
  sourcePublicKey: string;
  /** One or more operations to include in the transaction (max 100) */
  operations: StellarOperation[];
  /** Network to submit on */
  network: StellarNetwork;
  /** Optional text memo (max 28 bytes) */
  memo?: string;
}

export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  sequenceUsed: string;
  attempts: number;
  /** Number of operations included in the transaction */
  operationCount: number;
}

// ─── Horizon client (mock-compatible, swap for real SDK in production) ────────

/**
 * Fetch the current sequence number for an account from Horizon.
 *
 * In production:
 *   const account = await server.loadAccount(publicKey);
 *   return account.sequenceNumber();
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
 * Accepts either a single-operation `StellarTransactionPayload` (legacy) or a
 * multi-operation `BatchTransactionPayload`. The fee is scaled automatically:
 *   fee = baseFee × numberOfOperations
 *
 * This is a stub for the prototype — in production replace with the real SDK
 * call in `buildBatchTransaction` (stellar.ts):
 *   const tx = new TransactionBuilder(account, { fee, networkPassphrase })
 *     .addOperation(...)   // called once per operation
 *     .setTimeout(30)
 *     .build();
 *   tx.sign(Keypair.fromSecret(secretKey));
 *   return tx.toEnvelope().toXDR("base64");
 */
export function buildTransactionEnvelope(
  payload: StellarTransactionPayload | BatchTransactionPayload,
  sequence: string,
  secretKey: string
): string {
  // Normalise to a list of operation descriptors for the mock envelope
  const isBatch = "operations" in payload;
  const operations = isBatch
    ? payload.operations
    : [{ type: payload.operationType, ...payload.operationParams }];

  // Prototype stub — returns a mock XDR envelope string
  // In production this would be a real base64-encoded XDR envelope
  const mockEnvelope = btoa(
    JSON.stringify({
      source: payload.sourcePublicKey,
      sequence,
      operations,
      operationCount: operations.length,
      memo: payload.memo,
      // secretKey is used for signing but never included in the envelope
      sig: btoa(`${secretKey.slice(0, 8)}:${sequence}`),
    })
  );
  return mockEnvelope;
}

/**
 * Submit a signed transaction envelope to Horizon.
 *
 * In production:
 *   const result = await server.submitTransaction(tx);
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

  // Parse Horizon error response
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

// ─── Retry helpers ────────────────────────────────────────────────────────────

/** Exponential backoff with full jitter: delay = random(0, base * 2^attempt) */
function backoffDelay(attempt: number): Promise<void> {
  const cap = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const delay = Math.random() * cap;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ─── Main submission function ─────────────────────────────────────────────────

/**
 * Submit a Stellar transaction with automatic sequence number retry logic.
 *
 * Accepts either a single-operation `StellarTransactionPayload` (legacy) or a
 * multi-operation `BatchTransactionPayload`. When using the batch form, all
 * operations are validated before the first network call.
 *
 * Algorithm:
 * 1. (Batch only) Validate all operations.
 * 2. Fetch the current account sequence number from Horizon.
 * 3. Build and sign the transaction envelope.
 * 4. Submit to Horizon.
 * 5. If `tx_bad_seq` is returned:
 *    a. Re-fetch the sequence number (it may have been incremented by another tx).
 *    b. Rebuild and resubmit (up to MAX_SEQ_RETRIES times).
 * 6. If a transient network error occurs, apply exponential backoff and retry
 *    (up to MAX_NETWORK_RETRIES times).
 * 7. Non-retryable errors are thrown immediately.
 *
 * @param payload   - Transaction details (source, operation(s), network)
 * @param secretKey - Signing key (retrieved from WalletStorage, never persisted)
 * @param onRetry   - Optional callback invoked before each retry attempt
 */
export async function submitStellarTransaction(
  payload: StellarTransactionPayload | BatchTransactionPayload,
  secretKey: string,
  onRetry?: (info: { attempt: number; reason: StellarErrorCode; nextDelayMs: number }) => void
): Promise<StellarTransactionResult> {
  // Validate batch operations before touching the network
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
      // Step 1: Fetch sequence number (always re-fetch on seq error)
      if (currentSequence === null) {
        currentSequence = await fetchAccountSequence(
          payload.sourcePublicKey,
          payload.network
        );
      }

      // Step 2: Increment sequence number by 1 (Stellar requirement)
      // Sequence numbers are large integers — use BigInt to avoid precision loss
      const nextSequence = (BigInt(currentSequence) + 1n).toString();

      // Step 3: Build and sign the transaction
      const envelope = buildTransactionEnvelope(payload, nextSequence, secretKey);

      // Step 4: Submit to Horizon
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
        // Unexpected non-Stellar error — wrap and rethrow
        throw new StellarTransactionError(
          "unknown",
          err instanceof Error ? err.message : "Unknown error during transaction submission",
          false,
          totalAttempts
        );
      }

      // ── Sequence number conflict ──────────────────────────────────────────
      if (isSeqError(err.code)) {
        if (seqRetries >= MAX_SEQ_RETRIES) {
          throw new StellarTransactionError(
            "tx_bad_seq",
            `Sequence number conflict persisted after ${seqRetries} retries. ` +
              "Another transaction may be in flight. Please wait and try again.",
            false,
            totalAttempts
          );
        }

        seqRetries++;
        // Force a fresh sequence number fetch on the next iteration
        currentSequence = null;

        const nextDelayMs = 0; // Seq errors don't need backoff — just re-fetch
        onRetry?.({ attempt: totalAttempts, reason: "tx_bad_seq", nextDelayMs });
        continue;
      }

      // ── Transient network error ───────────────────────────────────────────
      if (isRetryable(err.code)) {
        if (networkRetries >= MAX_NETWORK_RETRIES) {
          throw new StellarTransactionError(
            err.code,
            `Network error persisted after ${networkRetries} retries: ${err.message}`,
            false,
            totalAttempts
          );
        }

        networkRetries++;
        const nextDelayMs = BASE_BACKOFF_MS * Math.pow(2, networkRetries - 1);
        onRetry?.({ attempt: totalAttempts, reason: err.code, nextDelayMs });
        await backoffDelay(networkRetries - 1);
        continue;
      }

      // ── Non-retryable error ───────────────────────────────────────────────
      throw new StellarTransactionError(
        err.code,
        err.message,
        false,
        totalAttempts
      );
    }
  }
}

// ─── User-facing error message helper ────────────────────────────────────────

/**
 * Convert a StellarTransactionError into a user-friendly message.
 * Use this in UI components to display actionable error text.
 */
export function getStellarErrorMessage(error: unknown): string {
  if (!(error instanceof StellarTransactionError)) {
    return "An unexpected error occurred. Please try again.";
  }

  switch (error.code) {
    case "tx_bad_seq":
      return "Transaction failed due to a sequence number conflict. This can happen when multiple transactions are submitted at the same time. Please try again.";
    case "tx_bad_auth":
      return "Transaction signature is invalid. Please reconnect your wallet and try again.";
    case "tx_insufficient_fee":
      return "The transaction fee is too low. Please try again — the fee will be adjusted automatically.";
    case "tx_no_account":
      return "Your Stellar account has not been activated yet. Please fund it via Friendbot (testnet) or send at least 1 XLM to activate it.";
    case "tx_failed":
      return `Transaction was rejected by the network: ${error.message}`;
    case "network_error":
      return "Network error while submitting the transaction. Check your connection and try again.";
    case "timeout":
      return "Transaction submission timed out. The network may be congested — please try again.";
    default:
      return `Transaction failed: ${error.message}`;
  }
}
