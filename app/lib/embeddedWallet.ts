/**
 * embeddedWallet.ts
 *
 * Foundation for seamless, automatic wallet creation on email signup (Web2 Flow).
 *
 * Architecture overview
 * ─────────────────────
 * 1. On email signup, `createEmbeddedWallet()` is called automatically — the user
 * never sees a seed phrase or has to install an extension.
 * 2. A Stellar keypair is generated client-side using a pure-JS implementation
 * (no native dependencies required for the prototype).
 * 3. The keypair is stored via `WalletStorage` (localStorage now, encrypted
 * backend vault in production).
 * 4. The account is funded on Stellar Testnet via Friendbot so it's immediately
 * usable for Soroban smart-contract interactions.
 *
 * Phase 2 upgrade path (production)
 * ──────────────────────────────────
 * - Replace the client-side keypair generation with a server-side MPC/TSS
 * (Threshold Signature Scheme) so the raw secret key never exists in one place.
 * - Integrate @stellar/stellar-sdk for real Stellar/Soroban transactions.
 * - Add Freighter wallet detection so power users can opt into self-custody.
 * - Replace Friendbot funding with a server-side sponsorship transaction.
 * - Add key-rotation and social-recovery flows.
 *
 * Soroban Smart Wallet notes
 * ──────────────────────────
 * Stellar's Soroban supports "smart wallets" — accounts controlled by a
 * Soroban contract rather than a raw keypair. This enables:
 * - Multi-sig / social recovery
 * - Session keys (limited-scope signing without exposing the master key)
 * - Gas sponsorship (platform pays fees on behalf of users)
 * The `walletType: "smart_contract"` field is reserved for this upgrade.
 */

import { WalletStorage, WalletStorageError } from "./walletRepository";
import { getStellarNetwork, NETWORK_CONFIGS, StellarNetwork } from "./networkConfig";
import { withRetry, withFallback } from "./retryUtils";

export type { StellarNetwork };

/** @deprecated Import from networkConfig.ts instead */
export const STELLAR_NETWORKS = NETWORK_CONFIGS;

// ─── Wallet types ──────────────────────────────────────────────────────────────

/** Supported operational modalities for key management on the ledger interface */
export type EmbeddedWalletType = "embedded" | "freighter" | "smart_contract";

/**
 * Structural container data object tracking an active network identity wallet.
 */
export interface EmbeddedWallet {
  /** The public ledger coordinate mapping the account identification string. */
  publicKey: string;
  /** Active blockchain target layout designation. */
  network: StellarNetwork;
  /** Custom operational modality strategy tag. */
  walletType: EmbeddedWalletType;
  /** Whether the account has been funded and activated on-chain */
  isActivated: boolean;
  /** ISO string timestamp tracking creation milestones. */
  createdAt: string;
}

/**
 * Packaging container returned upon successful resolution of a key generation procedure.
 */
export interface WalletCreationResult {
  /** The validated metadata reference tracking the newly assigned credential space. */
  wallet: EmbeddedWallet;
  /** Present only immediately after creation — store securely, never log */
  secretKey?: string;
  /** Explicit indicator flag denoting if an allocation index existed prior to invocation. */
  alreadyExisted: boolean;
}

// ─── Wallet creation error types ──────────────────────────────────────────────

/** Unique identification string error categorization codes */
export type WalletErrorCode =
  | "KEYPAIR_GENERATION_FAILED"  // Web Crypto API unavailable or failed
  | "STORAGE_FAILED"              // localStorage unavailable or full
  | "FUNDING_FAILED"              // Friendbot unreachable (testnet only)
  | "UNKNOWN";

/**
 * Special handling error object recording tracking failures encountered during credential deployment blocks.
 */
export class WalletCreationError extends Error {
  /**
   * Constructs an instance of a WalletCreationError.
   * @param code - Functional taxonomy label organizing execution tracking errors.
   * @param message - Descriptive contextual notification text logging the underlying operational failure.
   * @param cause - Direct upstream operational stack traces, if available.
   * @param retryable - Explicit flag guiding remediation mechanisms on whether execution can be safely re-attempted.
   */
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = "WalletCreationError";
  }
}

/**
 * Classify a raw error into a typed WalletCreationError
 * @param err - Unstructured raw error exception encountered within an internal execution thread.
 * @returns An application-normalized error schema instance tracking original execution failures.
 */
function classifyError(err: unknown): WalletCreationError {
  if (err instanceof WalletCreationError) return err;

  if (err instanceof WalletStorageError) {
    return new WalletCreationError(
      "STORAGE_FAILED",
      err.message,
      err,
      // Storage-full is retryable after the user clears space; unavailable is not
      err.code !== "STORAGE_UNAVAILABLE"
    );
  }

  if (err instanceof Error) {
    if (
      err.name === "NotSupportedError" ||
      err.message.includes("crypto") ||
      err.message.includes("subtle")
    ) {
      return new WalletCreationError(
        "KEYPAIR_GENERATION_FAILED",
        "Cryptographic key generation is not supported in this browser.",
        err,
        false // non-retryable — browser limitation
      );
    }
  }

  return new WalletCreationError(
    "UNKNOWN",
    err instanceof Error ? err.message : "An unexpected error occurred during wallet creation.",
    err,
    true
  );
}

// ─── Stellar keypair generation (pure JS, no native deps) ─────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Packs raw byte components down to a normalized Base32 format encoding string sequence.
 * @param bytes - High-precision unsigned integer data vector.
 * @returns Character sequence representation string.
 */
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
 *
 * @returns Resolves with generated cryptographic strings.
 * @throws {WalletCreationError} Thrown if Web Crypto API configurations are missing or insecure.
 */
async function generateStellarKeypair(): Promise<{ publicKey: string; secretKey: string }> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      throw new WalletCreationError(
        "KEYPAIR_GENERATION_FAILED",
        "Web Crypto API is not available in this environment.",
        undefined,
        false
      );
    }

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
  } catch (err) {
    if (err instanceof WalletCreationError) throw err;
    throw classifyError(err);
  }
}

// ─── Freighter detection ───────────────────────────────────────────────────────

/**
 * Check whether the Freighter browser extension is installed.
 * Freighter is the primary Stellar/Soroban wallet extension.
 *
 * @returns True if window context variables confirm availability.
 */
export async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // @ts-expect-error — freighter injects window.freighter
  return typeof window.freighter !== "undefined";
}

/**
 * Request the user's public key from Freighter.
 * @returns Public address identifier string or null if interaction is aborted or unavailable.
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
 *
 * @param publicKey - The destination account identification address targeted for activation.
 * @returns Operational execution indicator reporting completion metrics.
 */
export async function fundTestnetAccount(publicKey: string): Promise<boolean> {
  try {
    const { friendbotUrl } = NETWORK_CONFIGS.testnet;
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
 * Called automatically on email signup — the user never sees this flow.
 *
 * @param userId   - The user's ID from the auth system.
 * @param network  - Target network layer configuration enum. Defaults to environment settings.
 * @param fund     - True if the application should trigger a testnet token subsidy operation.
 * @returns Structural result containing operational models tracking security entities.
 */
export async function createEmbeddedWallet(
  userId: string,
  network: StellarNetwork = getStellarNetwork(),
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

  // Fund on testnet via Friendbot (fire-and-forget — don't block signup on this).
  // On mainnet, account activation requires a server-side sponsorship transaction;
  // isActivated will remain false until the platform funds the account externally.
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
 * @param userId - Target identification mapping key corresponding to the session owner.
 * @returns The structured target context record object model or null if absent.
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
 * @param publicKey - Complete address identifier mapping string.
 * @returns Formatted representation target text.
 */
export function truncateStellarAddress(publicKey: string): string {
  if (publicKey.length < 10) return publicKey;
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
}
