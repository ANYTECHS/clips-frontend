#!/usr/bin/env node
/**
 * Issue #1371 — security header verification.
 *
 * Asserts that the app's configured response headers include the required
 * hardening headers. Run against a built/served app:
 *   BASE_URL=https://enclips.ai node scripts/verify-security-headers.mjs
 *
 * Also runnable in "config" mode (no server needed) to validate
 * next.config.ts statically.
 */

const REQUIRED = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const base = process.env.BASE_URL;

if (!base) {
  // Static mode: check next.config.ts declares the headers.
  const { readFileSync } = await import("node:fs");
  const cfg = readFileSync("next.config.ts", "utf8");
  let ok = true;
  for (const [key, expected] of Object.entries(REQUIRED)) {
    const present = cfg.toLowerCase().includes(`"${key}"`) || cfg.toLowerCase().includes(`'${key}'`);
    const valueOk = cfg.includes(expected);
    if (!present || !valueOk) {
      console.error(`MISSING/BAD: ${key}: ${expected}`);
      ok = false;
    }
  }
  if (!ok) process.exit(1);
  console.log("Static check OK — required security headers declared in next.config.ts.");
  process.exit(0);
}

const res = await fetch(base, { redirect: "manual" });
let ok = true;
for (const [key, expected] of Object.entries(REQUIRED)) {
  const got = res.headers.get(key);
  if (got !== expected) {
    console.error(`FAIL ${key}: expected "${expected}", got "${got}"`);
    ok = false;
  } else {
    console.log(`OK   ${key}: ${got}`);
  }
}
process.exit(ok ? 0 : 1);
