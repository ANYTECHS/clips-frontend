/**
 * walletStorage.ts
 *
 * Abstraction layer for persisting embedded wallet credentials.
 *
 * Private keys are encrypted with AES-GCM (256-bit) before any persistence
 * (Issue #1218). The key is derived with PBKDF2-SHA256 (100,000 iterations)
 * from the user's password — or, when none is supplied, a per-device master
 * key — and the salt maintained by `CryptoSaltInitializer`. The stored record
 * carries only the encrypted payload (`{ v, alg, salt, iv, ciphertext }`);
 * the record as a whole is additionally wrapped by `secureStorage`.
 *
 * Plaintext keys are never returned by `get()`. They are decrypted in memory
 * only by `getSecretKey()` / `withSecretKey()` immediately before signing,
 * and are never logged.
 *
 * Phase 2 upgrade path:
 * - Replace localStorage calls with server-side encrypted vault API calls
 * - Add HSM / KMS integration for production key custody
 */

import { secureStorage, getCryptoSalt } from "./secureStorage";
import {
  decryptFromPayload,
  encryptToPayload,
  type EncryptedPayload,
} from "./cryptoUtils";

const WALLET_STORE_PREFIX = "clipcash_ew_";
const WALLET_MASTER_KEY = "clipcash_wallet_master_key";

export interface StoredWalletRecord {
  userId: string;
  publicKey: string;
  /** AES-GCM encrypted secret key. The plaintext is never persisted. */
  encryptedSecretKey?: EncryptedPayload;
  /** @deprecated Plaintext secret from records written before #1218; migrated on read. */
  secretKey?: string;
  /** @deprecated Base64 secret from the original prototype format; migrated on read. */
  _encodedSecret?: string;
  network: "testnet" | "mainnet";
  createdAt: string;
  walletType: "embedded" | "freighter" | "external";
}

/** Wallet record as returned to callers — never contains a plaintext key. */
export type WalletRecord = Omit<StoredWalletRecord, "secretKey" | "_encodedSecret">;

/** Reasons a storage operation can fail */
export type StorageErrorCode =
  | "STORAGE_UNAVAILABLE"  // localStorage not accessible (SSR, private mode, etc.)
  | "STORAGE_FULL"         // QuotaExceededError
  | "SERIALIZATION_ERROR"  // JSON parse/stringify failure
  | "DECODE_ERROR"         // base64 decode failure
  | "ENCRYPTION_ERROR"     // AES-GCM encryption failure
  | "DECRYPTION_ERROR";    // wrong password or tampered ciphertext

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
 * Per-device master key used when the caller has no user password.
 * Generated once with a CSPRNG; a user password gives stronger protection
 * because it is never stored.
 */
function getMasterKey(): string {
  let masterKey = localStorage.getItem(WALLET_MASTER_KEY);
  if (!masterKey) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    masterKey = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(WALLET_MASTER_KEY, masterKey);
  }
  return masterKey;
}

function saltBytes(): Uint8Array {
  return Uint8Array.from(atob(getCryptoSalt()), (c) => c.charCodeAt(0));
}

/** Encrypt a secret key for storage. The plaintext never leaves this call. */
async function encryptSecretKey(secretKey: string, password?: string): Promise<EncryptedPayload> {
  try {
    return await encryptToPayload(secretKey, password ?? getMasterKey(), saltBytes());
  } catch (err) {
    throw new WalletStorageError("ENCRYPTION_ERROR", "Failed to encrypt wallet key.", err);
  }
}

function toWalletRecord(record: StoredWalletRecord): WalletRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secretKey, _encodedSecret, ...rest } = record;
  return rest;
}

/**
 * Main application interface managing localized client encryption profiles for wallets.
 */
export const WalletStorage = {
  /**
   * Persist a new wallet record for a user.
   * The secret key is AES-GCM encrypted before it is serialized.
   * Throws `WalletStorageError` if storage is unavailable or full.
   * In production this should be a POST to an encrypted backend vault.
   *
   * @param userId - Target reference owner key descriptor.
   * @param record - Wallet record including the plaintext secret key to encrypt.
   * @param password - Optional user password; a device master key is used when omitted.
   * @throws {WalletStorageError} Thrown if environment restrictions disrupt write permissions or if parsing errors occur.
   */
  async save(
    userId: string,
    record: WalletRecord & { secretKey: string },
    password?: string,
  ): Promise<void> {
    if (!isStorageAvailable()) {
      throw new WalletStorageError(
        "STORAGE_UNAVAILABLE",
        "localStorage is not available. Wallet cannot be persisted in this environment."
      );
    }

    const { secretKey, ...publicFields } = record;
    const stored: StoredWalletRecord = {
      ...publicFields,
      encryptedSecretKey: await encryptSecretKey(secretKey, password),
    };

    let serialized: string;
    try {
      serialized = JSON.stringify(stored);
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
   * Read the raw stored record, migrating legacy formats that held the
   * secret key unencrypted. Migration re-encrypts with the device master key.
   */
  async readStored(userId: string): Promise<StoredWalletRecord | null> {
    if (!isStorageAvailable()) return null;
    try {
      const key = `${WALLET_STORE_PREFIX}${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      let record: StoredWalletRecord | null = null;
      try {
        // Oldest format: plaintext JSON with a base64 `_encodedSecret`.
        const parsed = JSON.parse(raw) as StoredWalletRecord;
        if (parsed && typeof parsed === "object" && parsed._encodedSecret) {
          record = parsed;
        }
      } catch {
        // Not JSON — encrypted via secureStorage.
      }

      if (!record) {
        const decrypted = await secureStorage.getItem(key);
        if (!decrypted) return null;
        record = JSON.parse(decrypted) as StoredWalletRecord;
      }

      const legacySecret =
        record._encodedSecret !== undefined ? atob(record._encodedSecret) : record.secretKey;
      if (legacySecret && !record.encryptedSecretKey) {
        await this.save(userId, { ...toWalletRecord(record), secretKey: legacySecret });
        const migrated = await secureStorage.getItem(key);
        return migrated ? (JSON.parse(migrated) as StoredWalletRecord) : null;
      }

      return record;
    } catch {
      return null;
    }
  },

  /**
   * Retrieve a wallet record for a user, without its secret key.
   * Returns null if no wallet has been created yet or storage is unavailable.
   *
   * @param userId - Unique platform identifier key.
   * @returns Wallet metadata and encrypted key payload, or null if absent.
   */
  async get(userId: string): Promise<WalletRecord | null> {
    const record = await this.readStored(userId);
    return record ? toWalletRecord(record) : null;
  },

  /**
   * Decrypt the secret key for signing transactions.
   * Only call this immediately before signing — never store or log the result.
   * Prefer `withSecretKey`, which scopes the plaintext to the signing callback.
   *
   * @param userId - Unique platform identifier key.
   * @param password - The password used at save time, if any.
   * @returns The plaintext secret key, or null if no wallet exists.
   * @throws {WalletStorageError} DECRYPTION_ERROR on a wrong password or tampered ciphertext.
   */
  async getSecretKey(userId: string, password?: string): Promise<string | null> {
    const record = await this.readStored(userId);
    if (!record?.encryptedSecretKey) return null;
    try {
      return await decryptFromPayload(record.encryptedSecretKey, password ?? getMasterKey());
    } catch (err) {
      // Deliberately no plaintext or key material in the error.
      throw new WalletStorageError(
        "DECRYPTION_ERROR",
        "Unable to decrypt wallet key. The password may be wrong or the data was modified.",
        err
      );
    }
  },

  /**
   * Run a signing callback with the decrypted secret key. The plaintext only
   * exists in memory for the duration of the callback.
   *
   * @param userId - Unique platform identifier key.
   * @param sign - Callback that signs with the secret key.
   * @param password - The password used at save time, if any.
   * @returns The callback's result.
   */
  async withSecretKey<T>(
    userId: string,
    sign: (secretKey: string) => Promise<T> | T,
    password?: string,
  ): Promise<T> {
    const secretKey = await this.getSecretKey(userId, password);
    if (!secretKey) {
      throw new WalletStorageError("DECODE_ERROR", "No wallet key found for this user.");
    }
    return sign(secretKey);
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
