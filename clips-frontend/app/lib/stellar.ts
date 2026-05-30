import * as StellarSdk from "@stellar/stellar-sdk";
import {
  STELLAR_NETWORK,
  getHorizonUrl,
  getNetworkPassphrase,
  getFriendbotUrl,
} from "./networkConfig";
import type { StellarOperation } from "./stellarOperations";
import { validateOperations } from "./stellarOperations";

// Re-export so existing callers that import these from stellar.ts keep working.
export { STELLAR_NETWORK };

export const HORIZON_URL = getHorizonUrl();

export const NETWORK_PASSPHRASE = getNetworkPassphrase();

export const getStellarServer = () => {
  return new StellarSdk.Horizon.Server(HORIZON_URL);
};

// Simplified BIP39 word list for generating a 12-word mnemonic phrase
const WORD_LIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "advise", "aerobic", "affair", "afford", "afraid", "again", "age",
  "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol",
  "alert", "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also",
  "alter", "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient"
];

// Hash a string deterministically to a 32-byte seed
export const deriveSeedFromMnemonic = async (mnemonic: string): Promise<Uint8Array> => {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  // Using Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
};

export const generateMnemonic = (): string => {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
    words.push(WORD_LIST[randomIndex]);
  }
  return words.join(" ");
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
    console.error("Friendbot funding error:", error);
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
    console.warn("Failed to fetch base fee, using default 100 stroops", e);
  }

  // 3. Build the transaction
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: fee.toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
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
    console.error("Horizon submission error details:", error?.response?.data?.extras?.result_codes || error);
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
function toSdkOperation(op: StellarOperation): StellarSdk.xdr.Operation {
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
      // Soroban contract invocations require the Soroban RPC path and a
      // SorobanDataBuilder — this stub builds a placeholder operation.
      // Replace with a full Soroban client call in production.
      throw new Error(
        "invoke_contract operations must be built via the Soroban RPC client. " +
          "Use SorobanRpc.Server and assembleTransaction() before calling submitTransaction()."
      );

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
): Promise<BatchTransactionResult> => {
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
    console.warn("Failed to fetch base fee, using default 100 stroops");
  }
  const totalFee = baseFee * operations.length;

  // Build the transaction with all operations
  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: totalFee.toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const op of operations) {
    builder.addOperation(toSdkOperation(op));
  }

  if (memo) {
    builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = builder.setTimeout(timeoutSeconds).build();

  return {
    xdr: transaction.toEnvelope().toXDR("base64"),
    feeStroops: totalFee,
    operationCount: operations.length,
  };
};
