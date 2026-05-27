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

export const WalletStorage = {
  /**
   * Persist a new wallet record for a user.
   * In production this should be a POST to an encrypted backend vault.
   */
  save(userId: string, record: Omit<StoredWalletRecord, "_encodedSecret"> & { secretKey: string }): void {
    const { secretKey, ...rest } = record;
    const stored: StoredWalletRecord = {
      ...rest,
      _encodedSecret: encodeKey(secretKey),
    };
    localStorage.setItem(`${WALLET_STORE_PREFIX}${userId}`, JSON.stringify(stored));
  },

  /**
   * Retrieve a wallet record for a user.
   * Returns null if no wallet has been created yet.
   */
  get(userId: string): StoredWalletRecord | null {
    const raw = localStorage.getItem(`${WALLET_STORE_PREFIX}${userId}`);
    if (!raw) return null;
    try {
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
    localStorage.removeItem(`${WALLET_STORE_PREFIX}${userId}`);
  },

  /**
   * Check whether a wallet record exists for a user.
   */
  exists(userId: string): boolean {
    return localStorage.getItem(`${WALLET_STORE_PREFIX}${userId}`) !== null;
  },
};
