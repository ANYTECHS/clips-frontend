/**
 * Public-key encryption for social recovery guardian shares.
 *
 * Each guardian holds an ECDH P-256 key pair. A share is encrypted to the
 * guardian's public key with an ephemeral ECDH exchange + AES-GCM (ECIES
 * style), so the server only ever stores ciphertext and only the guardian
 * can recover the plaintext share.
 *
 * Encoded payload (base64): ephemeralPublicKey(65 raw bytes) || iv(12) || ciphertext
 */

const CURVE = "P-256";
const IV_LENGTH = 12;
const RAW_PUBLIC_KEY_LENGTH = 65;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value.trim()), (c) => c.charCodeAt(0));
}

async function deriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  usage: "encrypt" | "decrypt"
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

function importPublicKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: CURVE }, true, []);
}

export type GuardianKeyPair = {
  /** Base64 raw public key — safe to share with the account owner. */
  publicKey: string;
  /** Base64 PKCS#8 private key — the guardian must keep this secret. */
  privateKey: string;
};

/**
 * Generates a new guardian key pair.
 *
 * @returns Base64-encoded public and private keys.
 */
export async function generateGuardianKeyPair(): Promise<GuardianKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: CURVE }, true, [
    "deriveKey",
  ]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return { publicKey: toBase64(publicRaw), privateKey: toBase64(privatePkcs8) };
}

/**
 * Returns true when the value decodes to a valid P-256 raw public key.
 */
export async function isValidGuardianPublicKey(publicKey: string): Promise<boolean> {
  try {
    const raw = fromBase64(publicKey);
    if (raw.length !== RAW_PUBLIC_KEY_LENGTH) return false;
    await importPublicKey(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a Shamir share so that only the holder of the guardian's private key can read it.
 *
 * @param share - The plaintext hex share.
 * @param guardianPublicKey - The guardian's base64 raw public key.
 * @returns Base64 payload containing the ephemeral public key, IV and ciphertext.
 */
export async function encryptShareForGuardian(
  share: string,
  guardianPublicKey: string
): Promise<string> {
  const recipient = await importPublicKey(fromBase64(guardianPublicKey));
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: CURVE }, true, [
    "deriveKey",
  ]);
  const key = await deriveAesKey(ephemeral.privateKey, recipient, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(share))
  );
  const ephemeralRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  const combined = new Uint8Array(ephemeralRaw.length + iv.length + ciphertext.length);
  combined.set(ephemeralRaw, 0);
  combined.set(iv, ephemeralRaw.length);
  combined.set(ciphertext, ephemeralRaw.length + iv.length);
  return toBase64(combined);
}

/**
 * Decrypts a share produced by {@link encryptShareForGuardian}.
 *
 * @param encryptedShare - Base64 payload from encryptShareForGuardian.
 * @param guardianPrivateKey - The guardian's base64 PKCS#8 private key.
 * @returns The plaintext hex share.
 * @throws {Error} If the key does not match or the payload is corrupted.
 */
export async function decryptShareForGuardian(
  encryptedShare: string,
  guardianPrivateKey: string
): Promise<string> {
  const combined = fromBase64(encryptedShare);
  const ephemeralRaw = combined.slice(0, RAW_PUBLIC_KEY_LENGTH);
  const iv = combined.slice(RAW_PUBLIC_KEY_LENGTH, RAW_PUBLIC_KEY_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(RAW_PUBLIC_KEY_LENGTH + IV_LENGTH);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(guardianPrivateKey),
    { name: "ECDH", namedCurve: CURVE },
    false,
    ["deriveKey"]
  );
  const key = await deriveAesKey(privateKey, await importPublicKey(ephemeralRaw), "decrypt");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
