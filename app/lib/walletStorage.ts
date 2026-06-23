/**
 * walletStorage.ts
 *
 * Abstraction layer for persisting embedded wallet credentials.
 *
 * Current implementation: localStorage with a simple XOR-based obfuscation
 * (NOT cryptographically secure — suitable for demo/prototype only).
 *
 * Phase 2 upgrade path:
 *   - Replace `encodeKey` / `decodeKey` with AES-GCM via Web Crypto API
 *   - Replace localStorage calls with server-side encrypted vault API calls
 *   - Add HSM / KMS integration for production key custody
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

export class WalletStorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
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

export const WalletStorage = {
  /**
   * Persist a new wallet record for a user.
   * Throws `WalletStorageError` if storage is unavailable or full.
   * In production this should be a POST to an encrypted backend vault.
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
      // DOMException: QuotaExceededError
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
