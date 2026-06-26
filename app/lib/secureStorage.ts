import { PBKDF2_ITERATIONS } from "./constants";

const CRYPTO_SALT_KEY = 'clipcash_crypto_salt';

let pendingDecryptionWarning: string | null = null;

/**
 * Retrieves and clears any pending warning messages triggered by decryption exceptions.
 *
 * @returns The localized warning alert message string, or null if no alerts are pending.
 */
export function getSecureStorageWarning(): string | null {
  const warning = pendingDecryptionWarning;
  pendingDecryptionWarning = null;
  return warning;
}

/**
 * Synchronizes cryptographic salt material from temporary sessionStorage into long-term localStorage.
 *
 * @returns True if salt migration rules successfully executed on rest structures.
 */
export function migrateCryptoSalt(): boolean {
  if (typeof window === 'undefined') return false;
  const sessionSalt = sessionStorage.getItem(CRYPTO_SALT_KEY);
  const localSalt = localStorage.getItem(CRYPTO_SALT_KEY);
  if (sessionSalt && !localSalt) {
    localStorage.setItem(CRYPTO_SALT_KEY, sessionSalt);
    sessionStorage.removeItem(CRYPTO_SALT_KEY);
    return true;
  }
  if (sessionSalt && localSalt) {
    sessionStorage.removeItem(CRYPTO_SALT_KEY);
  }
  return false;
}

/**
 * Evaluates storage allocations to detect existing keys or wallet payloads needing decryption.
 *
 * @returns True if active ciphertext configurations are present on the client.
 */
function hasEncryptedWalletEntries(): boolean {
  if (typeof window === 'undefined') return false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === CRYPTO_SALT_KEY) continue;
    const value = localStorage.getItem(key);
    if (value && value.length > 0) return true;
  }
  return false;
}

/**
 * Derives a symmetric AES-GCM encryption key using the Web Crypto API, PBKDF2, and a persistent salt.
 *
 * @returns Resolves with the derived CryptoKey instance configured for symmetric encryption and decryption.
 * @throws {Error} Thrown if window context elements or modern cryptography primitives are absent.
 */
const getCryptoKey = async (): Promise<CryptoKey> => {
  if (typeof window === 'undefined') throw new Error('Crypto not available');
  migrateCryptoSalt();
  let salt = localStorage.getItem(CRYPTO_SALT_KEY);
  if (!salt) {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    salt = btoa(String.fromCharCode(...saltBuffer));
    localStorage.setItem(CRYPTO_SALT_KEY, salt);
    if (hasEncryptedWalletEntries()) {
      pendingDecryptionWarning =
        'Unable to decrypt stored wallet data. Close this tab and reopen the app in the same browser session, or restore your wallet from backup.';
    }
  }
  const appId = 'clipcash-secure-storage-v1';
  const passwordMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appId + salt),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts cleartext using AES-GCM (256-bit) and returns a Base64 string containing the IV and ciphertext.
 *
 * @param data - Raw string parameter payload to encrypt.
 * @returns Resolves with a combined, base64-encoded initialization vector and ciphertext string.
 */
const encrypt = async (data: string): Promise<string> => {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
};

/**
 * Decrypts a combined Base64 string payload back into original clean plaintext data.
 *
 * @param encryptedData - Combined base64 initialization vector and ciphertext stream string.
 * @returns Resolves with decoded plaintext string results.
 */
const decrypt = async (encryptedData: string): Promise<string> => {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  );
};

/**
 * High-level cryptographic key-value storage proxy managing symmetric encryption over persistent Web APIs.
 */
export const secureStorage = {
  /**
   * Retrieves and decrypts data from local storage.
   * @param name - The key associated with the encrypted data store.
   * @returns Resolves with plaintext data, or null if key does not exist or decryption fails.
   */
  async getItem(name: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const encrypted = localStorage.getItem(name);
    if (!encrypted) return null;
    try {
      return await decrypt(encrypted);
    } catch {
      pendingDecryptionWarning =
        'Unable to decrypt stored wallet data. Your encryption key may have changed; restore from backup if you have one.';
      return null;
    }
  },
  /**
   * Encrypts and writes values securely down to client memory.
   * @param name - The targeted reference index key.
   * @param value - Explicit unencrypted cleartext string payload to persist.
   */
  async setItem(name: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const encrypted = await encrypt(value);
    localStorage.setItem(name, encrypted);
  },
  /**
   * Deletes specified references from persistence bounds.
   * @param name - Target index reference identifier key.
   */
  async removeItem(name: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
  },
};

export const __testing__ = {
  CRYPTO_SALT_KEY,
  migrateCryptoSalt,
  getSecureStorageWarning,
};
