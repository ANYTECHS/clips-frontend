const CRYPTO_SALT_KEY = 'clipcash_crypto_salt';

let pendingDecryptionWarning: string | null = null;

export function getSecureStorageWarning(): string | null {
  const warning = pendingDecryptionWarning;
  pendingDecryptionWarning = null;
  return warning;
}

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
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

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

const decrypt = async (encryptedData: string): Promise<string> => {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  );
};

export const secureStorage = {
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
  async setItem(name: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const encrypted = await encrypt(value);
    localStorage.setItem(name, encrypted);
  },
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
