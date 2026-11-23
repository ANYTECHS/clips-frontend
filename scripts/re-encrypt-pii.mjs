#!/usr/bin/env node
/**
 * Issue #1368 — re-encryption / migration script for PII stored client-side.
 *
 * The app persists a small amount of PII (unlocked-clip wallet addresses,
 * session flags) in the browser's localStorage. `lib/secureStorage.ts`
 * encrypts values at rest with AES-256-GCM. This script migrates a plaintext
 * localStorage export to the encrypted "v1.<salt>.<iv>.<ct>" format so values
 * can be re-imported safely.
 *
 * Usage:
 *   NEXT_PUBLIC_PII_ENCRYPTION_KEY=<base64|hex-32B> \
 *     node scripts/re-encrypt-pii.mjs <input.json> <output.json>
 *
 * input.json format:  { "clp_unlocked_clips": "<raw string value>", ... }
 * output.json format: same keys, values replaced by encrypted blobs.
 *
 * NOTE: WebCrypto in Node requires the global `crypto` (Node >= 19) or
 * `globalThis.crypto = require('crypto').webcrypto` on older versions.
 */

import { webcrypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const ENV_KEY = process.env.NEXT_PUBLIC_PII_ENCRYPTION_KEY || "";
const ITERATIONS = 100_000;
const PII_KEYS = ["clp_unlocked_clips"]; // extend as new PII stores are added

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function unb64(s) {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function decodeEnvKey() {
  const k = ENV_KEY.trim();
  if (!k) throw new Error("NEXT_PUBLIC_PII_ENCRYPTION_KEY is required");
  if (/^[0-9a-fA-F]{64}$/.test(k)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(k.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return unb64(k);
}

async function deriveKey(material, salt) {
  const base = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPII(plaintext, keyMaterial) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(keyMaterial, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return ["v1", b64(salt), b64(iv), b64(new Uint8Array(ct))].join(".");
}

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("Usage: node scripts/re-encrypt-pii.mjs <input.json> <output.json>");
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(inPath, "utf8"));
  const keyMaterial = decodeEnvKey();
  const output = { ...input };

  for (const k of PII_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v && !v.startsWith("v1.")) {
      output[k] = await encryptPII(v, keyMaterial);
      console.log(`re-encrypted: ${k}`);
    } else {
      console.log(`skipped (already encrypted or absent): ${k}`);
    }
  }

  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
