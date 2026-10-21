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

import * as StellarSdk from "@stellar/stellar-sdk";

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
  /** Number of subentries (trustlines, offers, signers, data) — drives the minimum reserve. */
  subentry_count?: number;
  /** Number of reserves this account is sponsoring for others. */
  num_sponsoring?: number;
  /** Number of this account's reserves paid for by a sponsor. */
  num_sponsored?: number;
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

// ─── Fee bumping (gasless transactions) ──────────────────────────────────────

/** Stellar base reserve per ledger entry, in XLM. */
export const BASE_RESERVE_XLM = 0.5;

const STROOPS_PER_XLM = 10_000_000;

/** Options controlling how a fee-bump envelope is built. */
export interface FeeBumpOptions {
  /** Fee per operation the sponsor is willing to pay, in stroops (defaults to the inner tx rate or the network minimum). */
  baseFee?: number;
  /** Network whose passphrase the envelope is signed for (default: testnet). */
  network?: StellarNetwork;
}

/**
 * Parse a base64 XDR envelope into a Transaction or FeeBumpTransaction.
 *
 * @param xdr - Base64-encoded transaction envelope.
 * @param network - Network whose passphrase the envelope was built for.
 * @throws {StellarTransactionError} When the XDR cannot be decoded.
 */
export function parseTransactionXdr(
  xdr: string,
  network: StellarNetwork
): StellarSdk.Transaction | StellarSdk.FeeBumpTransaction {
  try {
    return StellarSdk.TransactionBuilder.fromXDR(xdr, STELLAR_NETWORKS[network].networkPassphrase);
  } catch (err) {
    throw new StellarTransactionError(
      "unknown",
      `Invalid transaction XDR: ${err instanceof Error ? err.message : String(err)}`,
      false
    );
  }
}

/** Per-operation inclusion fee of an inner transaction, excluding any Soroban resource fee. */
function innerInclusionFeeRate(innerTx: StellarSdk.Transaction): number {
  const ops = Math.max(1, innerTx.operations.length);
  let resourceFee = 0;
  try {
    const ext = innerTx.toEnvelope().v1().tx().ext();
    if (ext.switch() === 1) {
      resourceFee = Number(ext.sorobanData().resourceFee().toString());
    }
  } catch {
    // Classic transaction — no Soroban resource fee
  }
  return Math.ceil((Number(innerTx.fee) - resourceFee) / ops);
}

/**
 * Wrap an inner transaction in a fee-bump envelope paid for by the sponsor
 * account, and sign the envelope with the sponsor's keypair.
 *
 * The inner transaction's signatures are part of the fee-bump payload, so the
 * user must sign the inner transaction *before* it is wrapped. Server-side
 * only — the sponsor keypair carries the sponsor's secret key.
 *
 * @param innerTx - The user-signed inner transaction (object or base64 XDR).
 * @param sponsorKeypair - Keypair of the account paying the fee.
 * @param options - Fee and network overrides.
 * @returns The sponsor-signed fee-bump transaction.
 * @throws {StellarTransactionError} When the inner transaction is invalid or already fee-bumped.
 */
export function buildFeeBumpedTx(
  innerTx: StellarSdk.Transaction | string,
  sponsorKeypair: StellarSdk.Keypair,
  options: FeeBumpOptions = {}
): StellarSdk.FeeBumpTransaction {
  const network = options.network ?? "testnet";
  const { networkPassphrase } = STELLAR_NETWORKS[network];

  const parsed = typeof innerTx === "string" ? parseTransactionXdr(innerTx, network) : innerTx;
  if (parsed instanceof StellarSdk.FeeBumpTransaction) {
    throw new StellarTransactionError("unknown", "Transaction is already fee-bumped.", false);
  }

  const baseFee = Math.max(
    Number(StellarSdk.BASE_FEE),
    options.baseFee ?? 0,
    innerInclusionFeeRate(parsed)
  );

  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    sponsorKeypair,
    baseFee.toString(),
    parsed,
    networkPassphrase
  );
  feeBumpTx.sign(sponsorKeypair);
  return feeBumpTx;
}

// ─── Account fee coverage ────────────────────────────────────────────────────

/** Native balance and minimum reserve of an account, in XLM. */
export interface AccountXlmStatus {
  /** False when the account has not been created on-chain yet. */
  exists: boolean;
  balance: number;
  minReserve: number;
  /** XLM above the minimum reserve, i.e. what the account can spend on fees. */
  spendable: number;
}

/**
 * Minimum XLM balance an account must hold: (2 + subentries + sponsoring - sponsored) × base reserve.
 */
export function computeMinReserve(
  account: Pick<HorizonAccountResponse, "subentry_count" | "num_sponsoring" | "num_sponsored">
): number {
  const entries =
    2 + (account.subentry_count ?? 0) + (account.num_sponsoring ?? 0) - (account.num_sponsored ?? 0);
  return Math.max(0, entries) * BASE_RESERVE_XLM;
}

/**
 * Fetch an account's native balance and minimum reserve from Horizon.
 *
 * @param publicKey - Account to inspect.
 * @param network - Active network target.
 * @returns Balance status; `exists: false` for unfunded accounts.
 * @throws {StellarTransactionError} On Horizon connectivity failures.
 */
export async function fetchAccountXlmStatus(
  publicKey: string,
  network: StellarNetwork
): Promise<AccountXlmStatus> {
  const { horizonUrl } = STELLAR_NETWORKS[network];
  const res = await fetch(`${horizonUrl}/accounts/${encodeURIComponent(publicKey)}`);

  if (res.status === 404) {
    return { exists: false, balance: 0, minReserve: 0, spendable: 0 };
  }

  if (!res.ok) {
    throw new StellarTransactionError(
      "network_error",
      `Failed to fetch account balance: HTTP ${res.status}`,
      true
    );
  }

  const data: HorizonAccountResponse = await res.json();
  const balance = parseFloat(data.balances.find((b) => b.asset_type === "native")?.balance ?? "0");
  const minReserve = computeMinReserve(data);

  return { exists: true, balance, minReserve, spendable: Math.max(0, balance - minReserve) };
}

/**
 * Whether an account can pay a transaction fee from its spendable XLM.
 *
 * @param status - Result of `fetchAccountXlmStatus`.
 * @param feeStroops - Transaction fee in stroops.
 */
export function canCoverFee(status: AccountXlmStatus, feeStroops: number): boolean {
  return status.exists && status.spendable * STROOPS_PER_XLM >= feeStroops;
}

// ─── Trustline transactions ──────────────────────────────────────────────────

/** Parameters describing a trustline change. */
export interface ChangeTrustParams {
  sourcePublicKey: string;
  assetCode: string;
  assetIssuer: string;
  /** "add" creates/updates the trustline, "remove" sets its limit to 0. */
  action: "add" | "remove";
  /** Optional trust limit (only used for "add"). */
  limit?: string;
  network: StellarNetwork;
}

/**
 * Build an unsigned change-trust transaction for the user to sign.
 *
 * @param params - Trustline change description.
 * @returns Base64-encoded unsigned transaction envelope.
 * @throws {StellarTransactionError} When the source account cannot be loaded.
 */
export async function buildChangeTrustTx(params: ChangeTrustParams): Promise<string> {
  const { sourcePublicKey, assetCode, assetIssuer, action, limit, network } = params;
  const { horizonUrl, networkPassphrase } = STELLAR_NETWORKS[network];
  const server = new StellarSdk.Horizon.Server(horizonUrl);

  let account: StellarSdk.Horizon.AccountResponse;
  try {
    account = await server.loadAccount(sourcePublicKey);
  } catch (err) {
    if ((err as { response?: { status?: number } }).response?.status === 404) {
      throw new StellarTransactionError(
        "tx_no_account",
        `Account ${sourcePublicKey} does not exist on ${network}. Fund it first.`,
        false
      );
    }
    throw new StellarTransactionError("network_error", "Failed to load account from Horizon.", true);
  }

  let fee = Number(StellarSdk.BASE_FEE);
  try {
    fee = await server.fetchBaseFee();
  } catch {
    // Fall back to the network minimum
  }

  // Stellar memo text is limited to 28 bytes
  const memo = (action === "add" ? `Add ${assetCode}` : `Remove ${assetCode}`).slice(0, 28);
  const trustLimit = action === "remove" ? "0" : limit;

  const tx = new StellarSdk.TransactionBuilder(account, { fee: fee.toString(), networkPassphrase })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(assetCode, assetIssuer),
        ...(trustLimit !== undefined ? { limit: trustLimit } : {}),
      })
    )
    .addMemo(StellarSdk.Memo.text(memo))
    .setTimeout(180)
    .build();

  return tx.toEnvelope().toXDR("base64");
}

/**
 * Verify that a signed XDR is exactly the change-trust transaction described
 * by `expected`, so a client cannot smuggle other operations through the
 * trustline endpoint.
 *
 * @throws {StellarTransactionError} When the transaction does not match.
 */
export function assertChangeTrustTx(
  signedXdr: string,
  expected: Omit<ChangeTrustParams, "limit">
): StellarSdk.Transaction {
  const tx = parseTransactionXdr(signedXdr, expected.network);
  const mismatch = (reason: string) =>
    new StellarTransactionError("tx_failed", `Trustline transaction mismatch: ${reason}`, false);

  if (tx instanceof StellarSdk.FeeBumpTransaction) throw mismatch("fee-bump envelopes are not accepted");
  if (tx.source !== expected.sourcePublicKey) throw mismatch("unexpected source account");
  if (tx.operations.length !== 1) throw mismatch("expected exactly one operation");

  const op = tx.operations[0];
  if (op.type !== "changeTrust" || !(op.line instanceof StellarSdk.Asset)) {
    throw mismatch("expected a changeTrust operation");
  }
  if (op.source && op.source !== expected.sourcePublicKey) throw mismatch("unexpected operation source");
  if (op.line.getCode() !== expected.assetCode || op.line.getIssuer() !== expected.assetIssuer) {
    throw mismatch("unexpected asset");
  }
  const isRemoval = parseFloat(op.limit) === 0;
  if ((expected.action === "remove") !== isRemoval) throw mismatch("unexpected trust limit");

  return tx;
}
