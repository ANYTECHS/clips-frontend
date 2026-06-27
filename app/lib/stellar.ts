import * as Sentry from "@sentry/nextjs";
import { logger } from "@/app/lib/logger";
import * as StellarSdk from "@stellar/stellar-sdk";
import * as bip39 from "bip39";
import {
  getStellarNetwork as _getStellarNetwork,
  getHorizonUrl,
  getNetworkPassphrase,
  getFriendbotUrl,
  getRpcUrl,
} from "./networkConfig";
import type { StellarOperation } from "./stellarOperations";
import {
  validateOperations,
  invokeContractBuildError,
  isInvokeContractBuildError,
  type InvokeContractBuildError,
} from "./stellarOperations";

// Expose a runtime getter for the active Stellar network so callers can
// evaluate the current override on demand.
export function getStellarNetwork(): ReturnType<typeof _getStellarNetwork> {
  return _getStellarNetwork();
}

export const getStellarServer = () => {
  const horizon = getHorizonUrl();
  return new StellarSdk.Horizon.Server(horizon);
};

export const BIP39_WORDLIST = bip39.wordlists.english;

export const deriveSeedFromMnemonic = async (
  mnemonic: string,
  passphrase = ""
): Promise<Uint8Array> => {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  if (!bip39.validateMnemonic(normalized, BIP39_WORDLIST)) {
    throw new Error("Invalid BIP39 mnemonic phrase");
  }
  const seed = await bip39.mnemonicToSeed(normalized, passphrase);
  return seed.subarray(0, 32);
};

export const generateMnemonic = (strength = 128): string => {
  return bip39.generateMnemonic(strength, undefined, BIP39_WORDLIST);
};

export interface StellarWalletData {
  publicKey: string;
  secretKey: string;
  mnemonic: string;
}

export const createRandomWallet = async (): Promise<StellarWalletData> => {
  const mnemonic = generateMnemonic();
  const seed = await deriveSeedFromMnemonic(mnemonic);
  const keypair = StellarSdk.Keypair.fromRawEd25519Seed(seed);
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    mnemonic,
  };
};

export const restoreWalletFromMnemonic = async (mnemonic: string): Promise<StellarWalletData> => {
  const seed = await deriveSeedFromMnemonic(mnemonic);
  const keypair = StellarSdk.Keypair.fromRawEd25519Seed(seed);
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    mnemonic: mnemonic.trim(),
  };
};

export const getBalance = async (publicKey: string): Promise<string> => {
  const server = getStellarServer();
  try {
    const accountInfo = await server.loadAccount(publicKey);
    const nativeAsset = accountInfo.balances.find((b) => b.asset_type === "native");
    return nativeAsset?.balance || "0.00";
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      // Account is not funded/created on ledger yet
      return "0.00";
    }
    throw error;
  }
};

export const fundWithFriendbot = async (publicKey: string): Promise<boolean> => {
  // getFriendbotUrl() throws a descriptive error when called on mainnet,
  // preventing accidental Friendbot calls in production.
  const friendbotUrl = getFriendbotUrl();
  try {
    const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
    if (!response.ok) {
      throw new Error(`Friendbot request failed: ${response.statusText}`);
    }
    return true;
  } catch (error) {
    logger.error("Friendbot funding error:", error);
    throw error;
  }
};

export const buildPaymentTransaction = async (
  senderPublicKey: string,
  destinationPublicKey: string,
  amount: string
) => {
  const server = getStellarServer();
  // 1. Fetch sequence number and verify sender account exists
  let sourceAccount;
  try {
    sourceAccount = await server.loadAccount(senderPublicKey);
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      throw new Error("Sender account is not funded. Please fund it first.");
    }
    throw error;
  }

  // 2. Fetch base fee dynamically
  let fee = 100;
  try {
    fee = await server.fetchBaseFee();
  } catch (e) {
      logger.warn("Failed to fetch base fee, using default 100 stroops", e);
    }

  // 3. Build the transaction
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: fee.toString(),
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amount,
      })
    )
    .setTimeout(30)
    .build();

  return {
    transaction,
    fee: (fee / 10000000).toString(), // convert stroops to XLM
  };
};

export const submitTransaction = async (signedTx: StellarSdk.Transaction) => {
  const server = getStellarServer();
  try {
    const result = await server.submitTransaction(signedTx);
    return {
      success: true,
      hash: result.hash,
      ledger: result.ledger,
    };
  } catch (error: any) {
    logger.error("Horizon submission error details:", error?.response?.data?.extras?.result_codes || error);
    const errorResult = error?.response?.data?.extras?.result_codes;
    const details = errorResult ? JSON.stringify(errorResult) : error.message || "Unknown error";
    throw new Error(`Horizon Submission Failed: ${details}`);
  }
};

// ─── Batch transaction builder ────────────────────────────────────────────────

/**
 * Convert a typed `StellarOperation` descriptor into a real Stellar SDK
 * `xdr.Operation` object.
 */
function toSdkOperation(
  op: StellarOperation
): StellarSdk.xdr.Operation | InvokeContractBuildError {
  switch (op.type) {
    case "payment": {
      const asset =
        op.assetCode && op.assetIssuer
          ? new StellarSdk.Asset(op.assetCode, op.assetIssuer)
          : StellarSdk.Asset.native();
      return StellarSdk.Operation.payment({
        destination: op.destination,
        asset,
        amount: op.amount,
        ...(op.source ? { source: op.source } : {}),
      });
    }

    case "change_trust": {
      const asset = new StellarSdk.Asset(op.assetCode, op.assetIssuer);
      return StellarSdk.Operation.changeTrust({
        asset,
        ...(op.limit !== undefined ? { limit: op.limit } : {}),
        ...(op.source ? { source: op.source } : {}),
      });
    }

    case "manage_sell_offer": {
      const selling =
        op.sellingAssetCode && op.sellingAssetIssuer
          ? new StellarSdk.Asset(op.sellingAssetCode, op.sellingAssetIssuer)
          : StellarSdk.Asset.native();
      const buying =
        op.buyingAssetCode && op.buyingAssetIssuer
          ? new StellarSdk.Asset(op.buyingAssetCode, op.buyingAssetIssuer)
          : StellarSdk.Asset.native();
      return StellarSdk.Operation.manageSellOffer({
        selling,
        buying,
        amount: op.amount,
        price: op.price,
        offerId: op.offerId ?? "0",
        ...(op.source ? { source: op.source } : {}),
      });
    }

    case "manage_buy_offer": {
      const selling =
        op.sellingAssetCode && op.sellingAssetIssuer
          ? new StellarSdk.Asset(op.sellingAssetCode, op.sellingAssetIssuer)
          : StellarSdk.Asset.native();
      const buying =
        op.buyingAssetCode && op.buyingAssetIssuer
          ? new StellarSdk.Asset(op.buyingAssetCode, op.buyingAssetIssuer)
          : StellarSdk.Asset.native();
      return StellarSdk.Operation.manageBuyOffer({
        selling,
        buying,
        buyAmount: op.buyAmount,
        price: op.price,
        offerId: op.offerId ?? "0",
        ...(op.source ? { source: op.source } : {}),
      });
    }

    case "account_merge":
      return StellarSdk.Operation.accountMerge({
        destination: op.destination,
        ...(op.source ? { source: op.source } : {}),
      });

    case "set_options": {
      const opts: StellarSdk.Operation.SetOptionsOptions = {};
      if (op.inflationDest !== undefined) opts.inflationDest = op.inflationDest;
      if (op.clearFlags !== undefined) opts.clearFlags = op.clearFlags;
      if (op.setFlags !== undefined) opts.setFlags = op.setFlags;
      if (op.masterWeight !== undefined) opts.masterWeight = op.masterWeight;
      if (op.lowThreshold !== undefined) opts.lowThreshold = op.lowThreshold;
      if (op.medThreshold !== undefined) opts.medThreshold = op.medThreshold;
      if (op.highThreshold !== undefined) opts.highThreshold = op.highThreshold;
      if (op.homeDomain !== undefined) opts.homeDomain = op.homeDomain;
      if (op.signer?.ed25519PublicKey !== undefined) {
        opts.signer = {
          ed25519PublicKey: op.signer.ed25519PublicKey,
          weight: op.signer.weight,
        };
      }
      if (op.source) opts.source = op.source;
      return StellarSdk.Operation.setOptions(opts);
    }

    case "begin_sponsoring_future_reserves":
      return StellarSdk.Operation.beginSponsoringFutureReserves({
        sponsoredId: op.sponsoredId,
        ...(op.source ? { source: op.source } : {}),
      });

    case "end_sponsoring_future_reserves":
      return StellarSdk.Operation.endSponsoringFutureReserves({
        ...(op.source ? { source: op.source } : {}),
      });

    case "invoke_contract":
      return invokeContractBuildError();

    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown operation type: ${(_exhaustive as StellarOperation).type}`);
    }
  }
}

export interface BatchTransactionResult {
  /** Unsigned transaction XDR ready for Freighter to sign */
  xdr: string;
  /** Total fee in stroops (baseFee × operationCount) */
  feeStroops: number;
  /** Number of operations in the transaction */
  operationCount: number;
}

export type BuildBatchTransactionResult =
  | ({ ok: true } & BatchTransactionResult)
  | { ok: false; error: InvokeContractBuildError; operationIndex: number };

export { isInvokeContractBuildError, type InvokeContractBuildError };

/**
 * Build a multi-operation Stellar transaction and return the unsigned XDR.
 *
 * The XDR is intended to be passed to Freighter (or another wallet) for
 * signing, then submitted via `submitTransaction`.
 *
 * Fee is automatically scaled: baseFee × numberOfOperations.
 *
 * @example
 * const { xdr } = await buildBatchTransaction(senderPublicKey, [
 *   createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G..." }),
 *   createPaymentOp({ destination: recipientKey, amount: "10", assetCode: "USDC", assetIssuer: "G..." }),
 * ]);
 *
 * // Sign with Freighter
 * const signedXdr = await freighter.signTransaction(xdr, { network: "TESTNET", accountToSign: senderPublicKey });
 * await submitTransaction(StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE));
 */
export const buildBatchTransaction = async (
  senderPublicKey: string,
  operations: StellarOperation[],
  options: {
    memo?: string;
    timeoutSeconds?: number;
  } = {}
): Promise<BuildBatchTransactionResult> => {
  const { memo, timeoutSeconds = 30 } = options;

  // Validate before touching the network
  validateOperations(operations);

  const server = getStellarServer();

  // Load source account (verifies it exists and fetches sequence number)
  let sourceAccount: StellarSdk.AccountResponse;
  try {
    sourceAccount = await server.loadAccount(senderPublicKey);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      throw new Error("Sender account is not funded. Please fund it first.");
    }
    throw error;
  }

  // Fetch base fee and scale by operation count
  let baseFee = 100;
  try {
    baseFee = await server.fetchBaseFee();
  } catch {
    logger.warn("Failed to fetch base fee, using default 100 stroops");
  }
  const totalFee = baseFee * operations.length;

  // Build the transaction with all operations
  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: totalFee.toString(),
    networkPassphrase: getNetworkPassphrase(),
  });

  for (let i = 0; i < operations.length; i++) {
    const sdkOp = toSdkOperation(operations[i]);
    if (isInvokeContractBuildError(sdkOp)) {
      return { ok: false, error: sdkOp, operationIndex: i };
    }
    builder.addOperation(sdkOp);
  }

  if (memo) {
    builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = builder.setTimeout(timeoutSeconds).build();

  return {
    ok: true,
    xdr: transaction.toEnvelope().toXDR("base64"),
    feeStroops: totalFee,
    operationCount: operations.length,
  };
};

// ─── Soroban transaction builder and submitter ────────────────────────────────

/**
 * Build, simulate, and assemble a Soroban transaction for contract invocation.
 * This handles fetching Soroban transaction data and preparing it for signing.
 */
export async function buildSorobanTransaction(
  senderPublicKey: string,
  operations: StellarOperation[],
  options: {
    memo?: string;
    timeoutSeconds?: number;
  } = {}
): Promise<{
  xdr: string;
  feeStroops: number;
  operationCount: number;
}> {
  const { memo, timeoutSeconds = 30 } = options;

  // Validate operations first
  validateOperations(operations);

  const sorobanServer = getSorobanServer();
  const horizonServer = getStellarServer();

  // Load source account
  let sourceAccount: StellarSdk.AccountResponse;
  try {
    sourceAccount = await horizonServer.loadAccount(senderPublicKey);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      throw new Error("Sender account is not funded. Please fund it first.");
    }
    throw error;
  }

  // Fetch base fee
  let baseFee = 100;
  try {
    baseFee = await horizonServer.fetchBaseFee();
  } catch {
    logger.warn("Failed to fetch base fee, using default 100 stroops");
  }
  const totalFee = baseFee * operations.length;

  // Build transaction builder
  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: totalFee.toString(),
    networkPassphrase: getNetworkPassphrase(),
  });

  // Add operations
  for (const op of operations) {
    builder.addOperation(toSdkOperation(op));
  }

  if (memo) {
    builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const unsignedTx = builder.setTimeout(timeoutSeconds).build();

  // Simulate the transaction to get Soroban transaction data
  const simulated = await sorobanServer.simulateTransaction(unsignedTx);

  if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulated.error)}`);
  }

  // Assemble the transaction for signing
  const assembledTx = StellarSdk.assembleTransaction(
    unsignedTx,
    simulated
  ).build();

  return {
    xdr: assembledTx.toEnvelope().toXDR("base64"),
    feeStroops: totalFee,
    operationCount: operations.length,
  };
}

/**
 * Submit a signed Soroban transaction to the network.
 */
export async function submitSorobanTransaction(
  signedTx: StellarSdk.Transaction
): Promise<{ success: boolean; hash: string; ledger: number }> {
  const sorobanServer = getSorobanServer();
  try {
    const result = await sorobanServer.sendTransaction(signedTx);
    if (result.status === "ERROR") {
      throw new Error(
        `Soroban submission failed: ${JSON.stringify(result.errorResult)}`
      );
    }
    // Wait for transaction to be confirmed (optional but recommended)
    if (result.status === "PENDING") {
      let getTxResult;
      const maxRetries = 10;
      let retries = 0;
      do {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        getTxResult = await sorobanServer.getTransaction(result.hash);
        retries++;
      } while (
        getTxResult.status === "NOT_FOUND" &&
        retries < maxRetries
      );

      if (getTxResult.status === "SUCCESS") {
        return {
          success: true,
          hash: getTxResult.hash,
          ledger: getTxResult.ledger,
        };
      } else if (getTxResult.status === "FAILED") {
        throw new Error(
          `Soroban transaction failed: ${JSON.stringify(getTxResult.resultMetaXdr)}`
        );
      }
    }
    return {
      success: true,
      hash: result.hash,
      ledger: 0, // Ledger not available in pending status
    };
  } catch (error: any) {
    logger.error("Soroban submission error details:", error);
    throw new Error(`Soroban Submission Failed: ${error.message}`);
  }
}
