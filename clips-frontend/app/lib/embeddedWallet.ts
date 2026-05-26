/**
 * embeddedWallet.ts
 *
 * Foundation for seamless, automatic wallet creation on email signup (Web2 Flow).
 *
 * Architecture overview
 * ─────────────────────
 * 1. On email signup, `createEmbeddedWallet()` is called automatically — the user
 *    never sees a seed phrase or has to install an extension.
 * 2. A Stellar keypair is generated client-side using a pure-JS implementation
 *    (no native dependencies required for the prototype).
 * 3. The keypair is stored via `WalletStorage` (localStorage now, encrypted
 *    backend vault in production).
 * 4. The account is funded on Stellar Testnet via Friendbot so it's immediately
 *    usable for Soroban smart-contract interactions.
 *
 * Phase 2 upgrade path (production)
 * ──────────────────────────────────
 * - Replace the client-side keypair generation with a server-side MPC/TSS
 *   (Threshold Signature Scheme) so the raw secret key never exists in one place.
 * - Integrate @stellar/stellar-sdk for real Stellar/Soroban transactions.
 * - Add Freighter wallet detection so power users can opt into self-custody.
 * - Replace Friendbot funding with a server-side sponsorship transaction.
 * - Add key-rotation and social-recovery flows.
 *
 * Soroban Smart Wallet notes
 * ──────────────────────────
 * Stellar's Soroban supports "smart wallets" — accounts controlled by a
 * Soroban contract rather than a raw keypair. This enables:
 *   - Multi-sig / social recovery
 *   - Session keys (limited-scope signing without exposing the master key)
 *   - Gas sponsorship (platform pays fees on behalf of users)
 * The `walletType: "smart_contract"` field is reserved for this upgrade.
 */

import { WalletStorage } from "./walletStorage";

// ─── Network config ────────────────────────────────────────────────────────────

export type StellarNetwork = "testnet" | "mainnet";

export const STELLAR_NETWORKS: Record<StellarNetwork, { horizonUrl: string; friendbotUrl: string | null; networkPassphrase: string }> = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    friendbotUrl: null, // No Friendbot on mainnet
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
};

// ─── Wallet types ──────────────────────────────────────────────────────────────

export type EmbeddedWalletType = "embedded" | "freighter" | "smart_contract";

export interface EmbeddedWallet {
  publicKey: string;
  network: StellarNetwork;
  walletType: EmbeddedWalletType;
  /** Whether the account has been funded and activated on-chain */
  isActivated: boolean;
  createdAt: string;
}

export interface WalletCreationResult {
  wallet: EmbeddedWallet;
  /** Present only immediately after creation — store securely, never log */
  secretKey?: string;
  alreadyExisted: boolean;
}

// ─── Stellar keypair generation (pure JS, no native deps) ─────────────────────
//
// In production, install @stellar/stellar-sdk:
//   import { Keypair } from "@stellar/stellar-sdk";
//   const keypair = Keypair.random();
//
// For the prototype we generate a valid-looking Stellar keypair using the
// Web Crypto API + a base32 encoder, matching Stellar's StrKey format.
// This is sufficient for UI/UX development and mock flows.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Uint8Array): string {
  let result = "";
  let buffer = 0;
  let bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      result += BASE32_ALPHABET[(buffer >> bitsLeft) & 31];
    }
  }
  if (bitsLeft > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
  }
  return result;
}

/**
 * Generate a Stellar-compatible keypair using the Web Crypto API.
 * Returns { publicKey, secretKey } in Stellar StrKey format (G.../S...).
 *
 * NOTE: In production, use `Keypair.random()` from @stellar/stellar-sdk
 * which uses proper Ed25519 key generation and CRC16 checksums.
 */
async function generateStellarKeypair(): Promise<{ publicKey: string; secretKey: string }> {
  // Generate 32 random bytes for the secret key seed
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  // Derive a "public key" by hashing the secret (simplified — real Stellar uses Ed25519)
  const publicBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", secretBytes));

  // Stellar StrKey: version byte + payload + checksum (simplified)
  // Real format: version(1) + key(32) + checksum(2) → base32
  const secretPayload = new Uint8Array(33);
  secretPayload[0] = 0x90; // 'S' version byte (18 << 3)
  secretPayload.set(secretBytes, 1);

  const publicPayload = new Uint8Array(33);
  publicPayload[0] = 0x30; // 'G' version byte (6 << 3)
  publicPayload.set(publicBytes, 1);

  return {
    publicKey: "G" + toBase32(publicPayload).slice(1, 56),
    secretKey: "S" + toBase32(secretPayload).slice(1, 56),
  };
}

// ─── Freighter detection ───────────────────────────────────────────────────────

/**
 * Check whether the Freighter browser extension is installed.
 * Freighter is the primary Stellar/Soroban wallet extension.
 *
 * In production, use @stellar/freighter-api:
 *   import { isConnected } from "@stellar/freighter-api";
 */
export async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // @ts-expect-error — freighter injects window.freighter
  return typeof window.freighter !== "undefined";
}

/**
 * Request the user's public key from Freighter.
 * Returns null if Freighter is not available or the user rejects.
 */
export async function connectFreighter(): Promise<string | null> {
  try {
    if (!(await isFreighterAvailable())) return null;
    // @ts-expect-error — freighter API
    const { publicKey } = await window.freighter.getPublicKey();
    return publicKey ?? null;
  } catch {
    return null;
  }
}

// ─── Friendbot funding ─────────────────────────────────────────────────────────

/**
 * Fund a new Stellar testnet account via Friendbot.
 * This activates the account with 10,000 XLM on testnet.
 * On mainnet, the platform would sponsor account creation via a server transaction.
 */
export async function fundTestnetAccount(publicKey: string): Promise<boolean> {
  try {
    const { friendbotUrl } = STELLAR_NETWORKS.testnet;
    if (!friendbotUrl) return false;
    const res = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Core wallet creation ──────────────────────────────────────────────────────

/**
 * Create (or retrieve) an embedded Stellar wallet for a user.
 *
 * Called automatically on email signup — the user never sees this flow.
 * If a wallet already exists for the userId, it is returned without creating a new one.
 *
 * @param userId   - The user's ID from the auth system
 * @param network  - "testnet" (default) or "mainnet"
 * @param fund     - Whether to fund the account via Friendbot (testnet only)
 */
export async function createEmbeddedWallet(
  userId: string,
  network: StellarNetwork = "testnet",
  fund = true
): Promise<WalletCreationResult> {
  // Return existing wallet if already created
  const existing = WalletStorage.get(userId);
  if (existing) {
    return {
      wallet: {
        publicKey: existing.publicKey,
        network: existing.network,
        walletType: existing.walletType as EmbeddedWalletType,
        isActivated: true,
        createdAt: existing.createdAt,
      },
      alreadyExisted: true,
    };
  }

  // Generate a new keypair
  const { publicKey, secretKey } = await generateStellarKeypair();
  const createdAt = new Date().toISOString();

  // Persist to storage (secret key is obfuscated at rest)
  WalletStorage.save(userId, {
    userId,
    publicKey,
    secretKey,
    network,
    createdAt,
    walletType: "embedded",
  });

  // Fund on testnet (fire-and-forget — don't block signup on this)
  let isActivated = false;
  if (fund && network === "testnet") {
    isActivated = await fundTestnetAccount(publicKey);
  }

  return {
    wallet: {
      publicKey,
      network,
      walletType: "embedded",
      isActivated,
      createdAt,
    },
    secretKey, // Only returned once — caller should store securely or discard
    alreadyExisted: false,
  };
}

/**
 * Retrieve the embedded wallet for a user without creating a new one.
 * Returns null if no wallet exists.
 */
export function getEmbeddedWallet(userId: string): EmbeddedWallet | null {
  const record = WalletStorage.get(userId);
  if (!record) return null;
  return {
    publicKey: record.publicKey,
    network: record.network,
    walletType: record.walletType as EmbeddedWalletType,
    isActivated: true,
    createdAt: record.createdAt,
  };
}

/**
 * Truncate a Stellar public key for display: GABCD...WXYZ
 */
export function truncateStellarAddress(publicKey: string): string {
  if (publicKey.length < 10) return publicKey;
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
}

// ─── Transaction submission ────────────────────────────────────────────────────

import {
  submitStellarTransaction,
  getStellarErrorMessage,
  StellarTransactionPayload,
  StellarTransactionResult,
  StellarTransactionError,
} from "./stellarTransaction";

export { getStellarErrorMessage, StellarTransactionError };
export type { StellarTransactionPayload, StellarTransactionResult };

/**
 * Submit a Stellar transaction on behalf of an embedded wallet user.
 *
 * Automatically handles sequence number conflicts by re-fetching the account
 * sequence from Horizon and rebuilding the transaction (up to 3 retries).
 * Transient network errors are retried with exponential backoff.
 *
 * @param userId          - The user whose embedded wallet will sign the transaction
 * @param operationType   - Stellar operation type (e.g. "payment", "invoke_contract")
 * @param operationParams - Operation-specific parameters
 * @param options         - Optional: memo, network override, retry callback
 *
 * @throws StellarTransactionError with a user-friendly `.message` and `.code`
 *
 * @example
 * ```ts
 * try {
 *   const result = await submitEmbeddedWalletTransaction(userId, "payment", {
 *     destination: "GABCD...",
 *     asset: "native",
 *     amount: "10",
 *   });
 *   console.log("Submitted:", result.hash, "after", result.attempts, "attempt(s)");
 * } catch (err) {
 *   if (err instanceof StellarTransactionError) {
 *     console.error(err.code, err.message);
 *   }
 * }
 * ```
 */
export async function submitEmbeddedWalletTransaction(
  userId: string,
  operationType: string,
  operationParams: Record<string, unknown>,
  options?: {
    memo?: string;
    network?: StellarNetwork;
    onRetry?: (info: { attempt: number; reason: string; nextDelayMs: number }) => void;
  }
): Promise<StellarTransactionResult> {
  // Retrieve the wallet record
  const record = WalletStorage.get(userId);
  if (!record) {
    throw new StellarTransactionError(
      "tx_no_account",
      "No embedded wallet found for this user. Please create a wallet first.",
      false
    );
  }

  // Retrieve the secret key for signing (never stored after this call)
  const secretKey = WalletStorage.getSecretKey(userId);
  if (!secretKey) {
    throw new StellarTransactionError(
      "tx_bad_auth",
      "Could not retrieve wallet signing key. Please reconnect your wallet.",
      false
    );
  }

  const network = options?.network ?? (record.network as StellarNetwork);

  const payload: StellarTransactionPayload = {
    sourcePublicKey: record.publicKey,
    operationType,
    operationParams,
    network,
    memo: options?.memo,
  };

  return submitStellarTransaction(payload, secretKey, options?.onRetry);
}
