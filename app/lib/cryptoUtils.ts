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

// ─── Structured encrypted payloads (#1218) ───────────────────────────────────

/**
 * Self-describing AES-GCM payload. Everything needed to decrypt — except the
 * password — travels with the ciphertext, so it can be stored as a single
 * JSON value in localStorage or a database column.
 */
export interface EncryptedPayload {
  v: 1;
  alg: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  /** Base64 PBKDF2 salt. */
  salt: string;
  /** Base64 96-bit AES-GCM nonce, unique per encryption. */
  iv: string;
  /** Base64 ciphertext including the GCM authentication tag. */
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.v === 1 &&
    payload.alg === "AES-GCM" &&
    typeof payload.iterations === "number" &&
    typeof payload.salt === "string" &&
    typeof payload.iv === "string" &&
    typeof payload.ciphertext === "string"
  );
}

/**
 * Encrypts plaintext with AES-GCM using a PBKDF2-derived key.
 *
 * @param plaintext - The secret to encrypt.
 * @param password - The user's password or a master key.
 * @param salt - PBKDF2 salt; a random one is generated when omitted.
 * @returns A serializable payload holding the salt, IV and ciphertext.
 */
export async function encryptToPayload(
  plaintext: string,
  password: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(SALT_LENGTH)),
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS, "encrypt");
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts a payload produced by encryptToPayload.
 *
 * @throws {Error} On a wrong password or tampered payload — AES-GCM's
 * authentication tag makes both fail rather than return garbage.
 */
export async function decryptFromPayload(
  payload: EncryptedPayload,
  password: string,
): Promise<string> {
  if (!isEncryptedPayload(payload)) {
    throw new Error("Invalid encrypted payload");
  }
  // Never accept a weakened KDF from stored data.
  if (payload.iterations < PBKDF2_ITERATIONS) {
    throw new Error("Encrypted payload uses an insecure iteration count");
  }
  const key = await deriveAesKey(
    password,
    fromBase64(payload.salt),
    payload.iterations,
    "decrypt",
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}
