/**
 * walletStorage.ts
 *
 * Abstraction layer for persisting embedded wallet credentials.
 *
 * Current implementation: localStorage with a simple XOR-based obfuscation
 * (NOT cryptographically secure — suitable for demo/prototype only).
 *
 * Phase 2 upgrade path:
 * - Replace `encodeKey` / `decodeKey` with AES-GCM via Web Crypto API
 * - Replace localStorage calls with server-side encrypted vault API calls
 * - Add HSM / KMS integration for production key custody
 */

const WALLET_STORE_PREFIX = "clipcash_ew_";

/** Lightweight obfuscation — swap for Web Crypto AES-GCM in production */
function encodeKey(raw: string): string {
  return btoa(raw);
}

function decodeKey(encoded: string): string {
  return atob(encoded);
}

export interface StoredWalletRecord {
  userId: string;
  publicKey: string;
  /** Obfuscated secret key — never log or expose this value */
  _encodedSecret: string;
  network: "testnet" | "mainnet";
  createdAt: string;
  walletType: "embedded" | "freighter" | "external";
}

/** Reasons a storage operation can fail */
export type StorageErrorCode =
  | "STORAGE_UNAVAILABLE"  // localStorage not accessible (SSR, private mode, etc.)
  | "STORAGE_FULL"         // QuotaExceededError
  | "SERIALIZATION_ERROR"  // JSON parse/stringify failure
  | "DECODE_ERROR";        // base64 decode failure

/**
 * Custom error class managing data lifecycle and runtime exceptions across browser cache bounds.
 */
export class WalletStorageError extends Error {
  /**
   * Constructs an instance of WalletStorageError.
   * @param code - Identified classification tag.
   * @param message - Contextual message detailing the internal issue.
   * @param cause - Optional structural tracking object mapping native errors.
   */
  constructor(
    public readonly code: StorageErrorCode,
    public override readonly message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "WalletStorageError";
  }
}

/** Returns true when localStorage is accessible in the current environment */
function isStorageAvailable(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  try {
    const probe = "__clipcash_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main application interface managing localized client encryption profiles for wallets.
 */
export const WalletStorage = {
  /**
   * Persist a new wallet record for a user.
   * Throws `WalletStorageError` if storage is unavailable or full.
   * In production this should be a POST to an encrypted backend vault.
   *
   * @param userId - Target reference owner key descriptor.
   * @param record - Data payload structure minus initial base64 encoded parameters.
   * @throws {WalletStorageError} Thrown if environment restrictions disrupt write permissions or if parsing errors occur.
   */
  save(userId: string, record: Omit<StoredWalletRecord, "_encodedSecret"> & { secretKey: string }): void {
    if (!isStorageAvailable()) {
      throw new WalletStorageError(
        "STORAGE_UNAVAILABLE",
        "localStorage is not available. Wallet cannot be persisted in this environment."
      );
    }

    const { secretKey, ...rest } = record;
    let serialized: string;
    try {
      const stored: StoredWalletRecord = {
        ...rest,
        _encodedSecret: encodeKey(secretKey),
      };
      serialized = JSON.stringify(stored);
    } catch (err) {
      throw new WalletStorageError(
        "SERIALIZATION_ERROR",
        "Failed to serialize wallet record.",
        err
      );
    }

    try {
      localStorage.setItem(`${WALLET_STORE_PREFIX}${userId}`, serialized);
    } catch (err) {
      throw new WalletStorageError(
        "STORAGE_FULL",
        "Storage quota exceeded. Please clear some browser data and try again.",
        err
      );
    }
  },

  /**
   * Retrieve a wallet record for a user.
   * Returns null if no wallet has been created yet or storage is unavailable.
   *
   * @param userId - Unique platform identifier key.
   * @returns Unpacked configuration metadata map, or null if key does not exist.
   */
  get(userId: string): StoredWalletRecord | null {
    if (!isStorageAvailable()) return null;
    try {
      const raw = localStorage.getItem(`${WALLET_STORE_PREFIX}${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as StoredWalletRecord;
    } catch {
      return null;
    }
  },

  /**
   * Retrieve the decoded secret key for signing transactions.
   * Only call this immediately before signing — never store the result.
   *
   * @param userId - Unique platform identifier key.
   * @returns Clean decoded secret string material, or null if evaluation matches errors.
   */
  getSecretKey(userId: string): string | null {
    const record = WalletStorage.get(userId);
    if (!record) return null;
    try {
      return decodeKey(record._encodedSecret);
    } catch {
      return null;
    }
  },

  /**
   * Remove a wallet record (e.g. on account deletion or key rotation).
   *
   * @param userId - Unique platform identifier key.
   */
  remove(userId: string): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.removeItem(`${WALLET_STORE_PREFIX}${userId}`);
    } catch {
      // Silently ignore — removal failures are non-critical
    }
  },

  /**
   * Check whether a wallet record exists for a user.
   *
   * @param userId - Unique platform identifier key.
   * @returns True if specific profile references evaluate positive.
   */
  exists(userId: string): boolean {
    if (!isStorageAvailable()) return false;
    try {
      return localStorage.getItem(`${WALLET_STORE_PREFIX}${userId}`) !== null;
    } catch {
      return false;
    }
  },
};
