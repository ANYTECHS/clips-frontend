/**
 * feeSponsorship.ts
 *
 * Implements Stellar transaction fee sponsorship (CAP-33) using
 * @stellar/stellar-sdk. This allows the platform to sponsor (pay) transaction
 * fees and account reserves on behalf of users, enabling a gasless
 * onboarding experience.
 *
 * Architecture
 * ────────────
 * The platform maintains a "sponsor account" (a Stellar keypair with sufficient
 * XLM balance). When a user needs to perform a transaction:
 *
 * 1. Platform builds a transaction containing:
 *    a. beginSponsoringFutureReserves (sponsor → user)
 *    b. The actual operation(s) the user wants to perform
 *    c. endSponsoringFutureReserves (user)
 * 2. The sponsor account signs the transaction FIRST (as the sponsoring account)
 * 3. The user signs the transaction SECOND (for the sponsored operations)
 * 4. The transaction is submitted to the network
 *
 * On testnet, sponsorship allows creating accounts and paying fees without
 * the user needing XLM. On mainnet, the sponsor account needs real XLM.
 *
 * References
 * ──────────
 * - CAP-33: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0033.md
 * - Stellar SDK: https://github.com/stellar/js-stellar-sdk
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, getHorizonUrl, getNetworkPassphrase } from "./networkConfig";
import type { StellarNetwork } from "./networkConfig";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SponsorshipConfig {
  /** Sponsor account public key (platform-controlled) */
  sponsorPublicKey: string;
  /** Sponsor account secret key — stored securely, never exposed to client */
  sponsorSecretKey?: string;
  /** Network to use */
  network: StellarNetwork;
}

export interface SponsoredTransactionResult {
  /** Transaction hash on success */
  hash: string;
  /** Whether fee was sponsored */
  feeSponsored: boolean;
  /** Sponsor public key */
  sponsorKey: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_FEE_STROOPS = 100;
const SPONSORED_FEE_MULTIPLIER = 1; // No extra multiplier for sponsored txns

// ─── Sponsor account management ─────────────────────────────────────────────────

/**
 * Get the Stellar server instance for the configured network.
 */
function getServer(network: StellarNetwork) {
  return new StellarSdk.Horizon.Server(getHorizonUrl(network));
}

/**
 * Check if a sponsor account has sufficient balance to cover fees.
 * The minimum recommended balance is 5 XLM to cover multiple sponsored txns.
 *
 * @param sponsorPublicKey - Sponsor account public key
 * @param network - Stellar network
 * @returns Sponsor account balance in XLM
 */
export async function getSponsorBalance(
  sponsorPublicKey: string,
  network: StellarNetwork = getStellarNetwork()
): Promise<string> {
  const server = getServer(network);
  try {
    const account = await server.loadAccount(sponsorPublicKey);
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === "native"
    );
    return nativeBalance?.balance ?? "0";
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return "0";
    }
    throw error;
  }
}

/**
 * Check whether the sponsor account has enough XLM to sponsor a transaction.
 * Each sponsored transaction costs at minimum the base fee + 1 XLM reserve
 * for new accounts.
 *
 * @param sponsorPublicKey - Sponsor account public key
 * @param network - Stellar network
 * @param minRequired - Minimum XLM required (default: 5)
 */
export async function hasSufficientSponsorBalance(
  sponsorPublicKey: string,
  network: StellarNetwork = getStellarNetwork(),
  minRequired: number = 5
): Promise<boolean> {
  try {
    const balance = await getSponsorBalance(sponsorPublicKey, network);
    return parseFloat(balance) >= minRequired;
  } catch {
    return false;
  }
}

// ─── Fee sponsorship transaction builder ──────────────────────────────────────

/**
 * Build a sponsored Stellar transaction.
 *
 * This constructs a transaction that:
 * 1. Begins sponsoring future reserves (source = sponsor, sponsored = user)
 * 2. Includes the user's requested operations
 * 3. Ends sponsoring future reserves (source = user)
 *
 * The transaction must be signed by BOTH the sponsor AND the user before
 * submission.
 *
 * @param sponsorKeypair - The sponsor account's Keypair
 * @param userPublicKey  - The user's Stellar public key
 * @param operations     - The operations the user wants to perform
 * @param options        - Optional memo and timeout
 *
 * @returns The unsigned transaction XDR (base64) ready for the user to sign
 */
export async function buildSponsoredTransaction(
  sponsorKeypair: StellarSdk.Keypair,
  userPublicKey: string,
  operations: StellarSdk.xdr.Operation[],
  options: {
    memo?: string;
    timeoutSeconds?: number;
  } = {}
): Promise<{ xdr: string; sponsorSignature: string }> {
  const { memo, timeoutSeconds = 30 } = options;
  const network = getStellarNetwork();
  const server = getServer(network);
  const networkPassphrase = getNetworkPassphrase(network);
  const sponsorPublicKey = sponsorKeypair.publicKey();

  // Load sponsor account to get sequence number
  let sponsorAccount: StellarSdk.AccountResponse;
  try {
    sponsorAccount = await server.loadAccount(sponsorPublicKey);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      throw new Error(
        "Sponsor account does not exist on the network. Fund it first."
      );
    }
    throw error;
  }

  // Fetch base fee
  let baseFee = BASE_FEE_STROOPS;
  try {
    baseFee = await server.fetchBaseFee();
  } catch {
    console.warn("Failed to fetch base fee, using default");
  }

  // Build the transaction
  const builder = new StellarSdk.TransactionBuilder(sponsorAccount, {
    fee: (baseFee * (operations.length + 2)).toString(), // +2 for begin/end ops
    networkPassphrase,
  });

  // 1. Begin sponsoring future reserves (sponsor pays for user's reserves)
  builder.addOperation(
    StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: userPublicKey,
    })
  );

  // 2. Add the requested operations (these run under the sponsorship)
  for (const op of operations) {
    builder.addOperation(op);
  }

  // 3. End sponsoring future reserves (user signals sponsorship end)
  builder.addOperation(
    StellarSdk.Operation.endSponsoringFutureReserves({
      source: userPublicKey,
    })
  );

  // Optional memo
  if (memo) {
    builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = builder.setTimeout(timeoutSeconds).build();

  // Sponsor signs first (as the source account)
  transaction.sign(sponsorKeypair);

  return {
    xdr: transaction.toEnvelope().toXDR("base64"),
    sponsorSignature: "", // Signature is embedded in the XDR
  };
}

// ─── Submit a sponsored transaction ───────────────────────────────────────────

/**
 * Complete a sponsored transaction by having the user sign it and submitting
 * to the network.
 *
 * @param signedByUserXdr - The XDR that the user has co-signed
 * @param network         - Stellar network
 *
 * @returns Transaction result with hash
 */
export async function submitSponsoredTransaction(
  signedByUserXdr: string,
  network: StellarNetwork = getStellarNetwork()
): Promise<SponsoredTransactionResult> {
  const server = getServer(network);
  const networkPassphrase = getNetworkPassphrase(network);

  // Parse the signed transaction from XDR
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedByUserXdr,
    networkPassphrase
  );

  // Extract the sponsor source from the first operation
  const firstOp = transaction.operations[0];
  const sponsorKey =
    firstOp?.source()?.accountId()?.ed25519()?.toString() ?? "unknown";

  try {
    const result = await server.submitTransaction(transaction);
    return {
      hash: result.hash,
      feeSponsored: true,
      sponsorKey,
    };
  } catch (error: any) {
    const errorResult =
      error?.response?.data?.extras?.result_codes?.transaction;
    const details = errorResult
      ? JSON.stringify(errorResult)
      : error.message || "Unknown error";
    throw new Error(`Sponsored transaction failed: ${details}`);
  }
}

// ─── Helper: Create a sponsored "create account + payment" batch ─────────────

/**
 * Build the operations needed for a sponsored account creation with an
 * initial payment. The sponsor pays the 1 XLM reserve + transaction fee.
 *
 * @param userPublicKey - The new user's Stellar public key
 * @param initialAmount - Amount of XLM to send to the new account (optional)
 */
export function createSponsoredAccountOps(
  userPublicKey: string,
  initialAmount?: string
): StellarSdk.xdr.Operation[] {
  const ops: StellarSdk.xdr.Operation[] = [];

  // Create the account with the minimum 1 XLM balance (paid by sponsor)
  ops.push(
    StellarSdk.Operation.createAccount({
      destination: userPublicKey,
      startingBalance: initialAmount ?? "1",
    })
  );

  return ops;
}

// ─── Helper: Wrap existing operations with sponsorship ──────────────────────

/**
 * Given a set of operations, wrap them with begin/end sponsorship operations.
 *
 * For client-side use where the sponsor keypair is not available, the XDR
 * can be passed to a backend API for sponsor signing, or the user can
 * sign first and send to the platform for sponsor co-signing.
 *
 * @param userPublicKey - Public key of the user whose fees will be sponsored
 * @param operations    - User's operations (without sponsorship wrappers)
 * @returns             - Full operation list with sponsorship wrappers
 */
export function wrapWithSponsorship(
  userPublicKey: string,
  operations: StellarSdk.xdr.Operation[]
): StellarSdk.xdr.Operation[] {
  return [
    StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: userPublicKey,
    }),
    ...operations,
    StellarSdk.Operation.endSponsoringFutureReserves({
      source: userPublicKey,
    }),
  ];
}

// ─── Revoke sponsorship ───────────────────────────────────────────────────────

/**
 * Build a transaction to revoke an existing sponsorship.
 * This is used to clean up when a sponsorship is no longer needed.
 *
 * @param sponsorKeypair  - Sponsor account keypair
 * @param sponsoredId     - The sponsored account's public key
 * @param entriesToRevoke - Ledger entries to revoke sponsorship on
 */
export async function buildRevokeSponsorshipTransaction(
  sponsorKeypair: StellarSdk.Keypair,
  sponsoredId: string,
  entriesToRevoke: StellarSdk.xdr.LedgerKey[]
): Promise<string> {
  const network = getStellarNetwork();
  const server = getServer(network);
  const networkPassphrase = getNetworkPassphrase(network);
  const sponsorPublicKey = sponsorKeypair.publicKey();

  const sponsorAccount = await server.loadAccount(sponsorPublicKey);

  let baseFee = BASE_FEE_STROOPS;
  try {
    baseFee = await server.fetchBaseFee();
  } catch {
    console.warn("Failed to fetch base fee, using default");
  }

  const builder = new StellarSdk.TransactionBuilder(sponsorAccount, {
    fee: (baseFee * entriesToRevoke.length).toString(),
    networkPassphrase,
  });

  for (const ledgerKey of entriesToRevoke) {
    builder.addOperation(
      StellarSdk.Operation.revokeSponsorship({
        ledgerKey,
      })
    );
  }

  const transaction = builder.setTimeout(30).build();
  transaction.sign(sponsorKeypair);

  return transaction.toEnvelope().toXDR("base64");
}

// ─── Utility: Estimate sponsored fee ──────────────────────────────────────────

/**
 * Estimate the fee for a sponsored transaction.
 *
 * @param operationCount - Number of user operations (excluding begin/end)
 */
export function estimateSponsoredFee(operationCount: number): {
  totalOps: number;
  baseFeeStroops: number;
  totalFeeStroops: number;
  totalFeeXLM: string;
} {
  const totalOps = operationCount + 2; // +2 for begin/end sponsorship ops
  const baseFeeStroops = BASE_FEE_STROOPS;
  const totalFeeStroops = baseFeeStroops * totalOps;
  const totalFeeXLM = (totalFeeStroops / 10_000_000).toFixed(7);

  return {
    totalOps,
    baseFeeStroops,
    totalFeeStroops,
    totalFeeXLM,
  };
}
