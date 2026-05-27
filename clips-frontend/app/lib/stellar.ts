import * as StellarSdk from "@stellar/stellar-sdk";

// Define network configurations
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

export const HORIZON_URL = 
  STELLAR_NETWORK === "mainnet" 
    ? "https://horizon.stellar.org" 
    : "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE = 
  STELLAR_NETWORK === "mainnet" 
    ? StellarSdk.Networks.PUBLIC 
    : StellarSdk.Networks.TESTNET;

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
  if (STELLAR_NETWORK === "mainnet") {
    throw new Error("Friendbot is only available on Testnet.");
  }
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
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
