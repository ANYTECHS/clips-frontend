const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;
const COMBINED_SALT_IV_END = SALT_LENGTH + IV_LENGTH;

/**
 * Encrypts plaintext using a password-derived key via Web Crypto API.
 *
 * @param data - The plaintext string to encrypt.
 * @param password - The user-supplied password used to derive the encryption key.
 * @returns A Base64-encoded string containing the salt, IV, and ciphertext.
 */
export async function encryptWithPassword(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const encoded = encoder.encode(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a ciphertext produced by encryptWithPassword using the same password.
 *
 * @param encryptedData - The Base64-encoded output from encryptWithPassword.
 * @param password - The user-supplied password used to derive the decryption key.
 * @returns The original plaintext string.
 * @throws {Error} If decryption fails due to an incorrect password or corrupted data.
 */
export async function decryptWithPassword(encryptedData: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, COMBINED_SALT_IV_END);
  const ciphertext = combined.slice(COMBINED_SALT_IV_END);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
