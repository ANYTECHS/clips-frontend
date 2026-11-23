"use client";

// Issue #1368 — application-layer encryption for sensitive data at rest.
//
// KEY SOURCE (documented):
//   Primary:   NEXT_PUBLIC_PII_ENCRYPTION_KEY — a 32-byte base64/hex secret
//              injected at build time from the deployment secret store
//              (e.g. `openssl rand -base64 32`). It must be treated as a
//              secret; do NOT commit a real value.
//   Fallback:  when the env var is absent (local dev), a per-installation key
//              is generated once and stored in localStorage under
//              "clp_pii_key_wrap" — still AES-GCM encrypted at rest, but only
//              obfuscates against casual inspection. Production MUST set the
//              env var for real at-rest protection.
//
// Format on disk: "v1.<salt_b64>.<iv_b64>.<ct_b64>" (AES-256-GCM, PBKDF2-SHA256
// key derivation, 100k iterations). Decryption returns null for legacy
// plaintext values so callers can migrate + re-encrypt on next write.

import {
  AES_GCM_IV_BYTES,
  AES_KEY_BYTES,
  AES_KEY_LENGTH_BITS,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_BYTES,
} from "./constants";

const ENV_KEY = process.env.NEXT_PUBLIC_PII_ENCRYPTION_KEY || "";
const KEY_WRAP_STORAGE = "clp_pii_key_wrap";
const ENC_PREFIX = "v1";

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(material: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", material as BufferSource, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function decodeEnvKey(): Uint8Array | null {
  const k = ENV_KEY.trim();
  if (!k) return null;
  try {
    if (new RegExp(`^[0-9a-fA-F]{${AES_KEY_BYTES * 2}}$`).test(k)) {
      const out = new Uint8Array(AES_KEY_BYTES);
      for (let i = 0; i < AES_KEY_BYTES; i++) out[i] = parseInt(k.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    return b64ToBytes(k);
  } catch {
    return null;
  }
}

/**
 * Encrypts a UTF-8 string for at-rest storage. Returns the "v1.…" blob.
 * `salt` is random per value when derived from the env key; for the fallback
 * key the salt is stored alongside the wrapped key material.
 */
export async function encryptPII(plaintext: string): Promise<string> {
  const envKey = decodeEnvKey();
  let keyMaterial: Uint8Array;
  let salt: Uint8Array;

  if (envKey) {
    keyMaterial = envKey;
    salt = new Uint8Array(PBKDF2_SALT_BYTES);
    crypto.getRandomValues(salt);
  } else {
    // Fallback: stable per-installation material so values remain decryptable
    // across reloads. Stored base64 in localStorage (documented above).
    let stored = localStorage.getItem(KEY_WRAP_STORAGE);
    if (!stored) {
      const raw = new Uint8Array(AES_KEY_BYTES);
      crypto.getRandomValues(raw);
      stored = bytesToB64(raw);
      localStorage.setItem(KEY_WRAP_STORAGE, stored);
    }
    keyMaterial = b64ToBytes(stored);
    salt = new Uint8Array(PBKDF2_SALT_BYTES);
    crypto.getRandomValues(salt);
  }

  const key = await deriveKey(keyMaterial, salt);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return [ENC_PREFIX, bytesToB64(salt), bytesToB64(iv), bytesToB64(new Uint8Array(ct))].join(".");
}

/**
 * Decrypts a blob produced by encryptPII. Returns null when the value is not
 * an encrypted blob (legacy plaintext) or decryption fails.
 */
export async function decryptPII(blob: string): Promise<string | null> {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== ENC_PREFIX) return null;
  try {
    const envKey = decodeEnvKey();
    let keyMaterial: Uint8Array;
    if (envKey) {
      keyMaterial = envKey;
    } else {
      const stored = localStorage.getItem(KEY_WRAP_STORAGE);
      if (!stored) return null;
      keyMaterial = b64ToBytes(stored);
    }
    const key = await deriveKey(keyMaterial, b64ToBytes(parts[1]));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(parts[2]) as BufferSource },
      key,
      b64ToBytes(parts[3]) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
