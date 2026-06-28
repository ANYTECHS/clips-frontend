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

import { secureStorage } from "./secureStorage";

const WALLET_STORE_PREFIX = "clipcash_ew_";

export interface StoredWalletRecord {
  userId: string;
  publicKey: string;
  /** Secret key — now encrypted via secureStorage, so we don't need _encodedSecret but we'll keep the type compatible or just use secretKey */
  secretKey?: string;
  _encodedSecret?: string;
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
  async save(userId: string, record: Omit<StoredWalletRecord, "_encodedSecret" | "secretKey"> & { secretKey: string }): Promise<void> {
    if (!isStorageAvailable()) {
      throw new WalletStorageError(
        "STORAGE_UNAVAILABLE",
        "localStorage is not available. Wallet cannot be persisted in this environment."
      );
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(record);
    } catch (err) {
      throw new WalletStorageError(
        "SERIALIZATION_ERROR",
        "Failed to serialize wallet record.",
        err
      );
    }

    try {
      await secureStorage.setItem(`${WALLET_STORE_PREFIX}${userId}`, serialized);
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
  async get(userId: string): Promise<StoredWalletRecord | null> {
    if (!isStorageAvailable()) return null;
    try {
      const key = `${WALLET_STORE_PREFIX}${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      // Migration: Check if it's plaintext JSON with `_encodedSecret`
      let record: StoredWalletRecord;
      try {
        record = JSON.parse(raw);
        if (record && typeof record === "object" && record._encodedSecret) {
          // It's the old format!
          const decodedSecret = atob(record._encodedSecret);
          const { _encodedSecret, ...rest } = record;
          const newRecord = { ...rest, secretKey: decodedSecret };
          // Save using new format and await
          await this.save(userId, newRecord as any);
          return newRecord as StoredWalletRecord;
        }
      } catch (e) {
        // Not a JSON string (or invalid), so it must be encrypted via secureStorage
      }

      const decrypted = await secureStorage.getItem(key);
      if (!decrypted) return null;
      return JSON.parse(decrypted) as StoredWalletRecord;
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
  async getSecretKey(userId: string): Promise<string | null> {
    const record = await this.get(userId);
    if (!record) return null;
    return record.secretKey || null;
  },

  /**
   * Remove a wallet record (e.g. on account deletion or key rotation).
   *
   * @param userId - Unique platform identifier key.
   */
  async remove(userId: string): Promise<void> {
    if (!isStorageAvailable()) return;
    try {
      await secureStorage.removeItem(`${WALLET_STORE_PREFIX}${userId}`);
      // Also remove from localStorage in case it's the old format
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
  async exists(userId: string): Promise<boolean> {
    if (!isStorageAvailable()) return false;
    try {
      const key = `${WALLET_STORE_PREFIX}${userId}`;
      const raw = localStorage.getItem(key);
      return raw !== null;
    } catch {
      return false;
    }
  },
};
