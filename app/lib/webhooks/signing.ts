/**
 * HMAC-SHA256 request signing for outbound webhooks — Issue #1251.
 *
 * Scheme:
 * Header: `X-ClipCash-Signature: t=${timestamp},v1=${hmac}`
 *
 * Payload covered by HMAC: `${timestamp}.${rawBody}`
 * Timestamp prevents replay attacks; receivers should verify timestamps are recent.
 */

import * as crypto from "crypto";

export interface WebhookSignatureResult {
  timestamp: string;
  signature: string;
  headerValue: string;
}

/**
 * Signs the exact payload bytes using the endpoint secret and a UNIX epoch timestamp.
 */
export function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestampOverride?: string
): WebhookSignatureResult {
  const timestamp = timestampOverride ?? Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const headerValue = `t=${timestamp},v1=${signature}`;
  return { timestamp, signature, headerValue };
}

/**
 * Verifies an incoming X-ClipCash-Signature header using constant-time comparison.
 *
 * @param secret The endpoint's shared secret
 * @param rawBody The exact raw body bytes received
 * @param signatureHeader The value of `X-ClipCash-Signature` (e.g. `t=1700000000,v1=abcdef...`)
 * @param toleranceSeconds Maximum acceptable signature age in seconds (default: 300)
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
  toleranceSeconds = 300
): { valid: boolean; error?: string } {
  if (!signatureHeader || !secret) {
    return { valid: false, error: "Missing secret or signature header" };
  }

  // Parse header: t=...,v1=...
  const parts = signatureHeader.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }

  if (!timestamp || !signature) {
    return { valid: false, error: "Invalid signature header format" };
  }

  // Verify timestamp freshness if tolerance is set
  if (toleranceSeconds > 0) {
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      return { valid: false, error: "Invalid timestamp in signature header" };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > toleranceSeconds) {
      return { valid: false, error: "Signature timestamp expired or out of tolerance" };
    }
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) {
      return { valid: false, error: "Signature mismatch" };
    }
    const matches = crypto.timingSafeEqual(expectedBuf, actualBuf);
    return matches ? { valid: true } : { valid: false, error: "Signature mismatch" };
  } catch {
    return { valid: false, error: "Verification failed" };
  }
}
