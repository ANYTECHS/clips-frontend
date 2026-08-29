/**
 * HMAC-SHA256 request signing for outbound webhooks — lets a receiver
 * verify a delivery actually came from us and wasn't tampered with in
 * transit. Signature covers `${timestamp}.${rawBody}` (not the body alone)
 * so a captured request can't be replayed indefinitely; receivers should
 * reject signatures with a timestamp older than a few minutes.
 */

import crypto from "crypto";

export interface SignedPayload {
  timestamp: string;
  signature: string;
}

export function signWebhookPayload(secret: string, rawBody: string): SignedPayload {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return { timestamp, signature };
}

/**
 * Verifies a signature produced by signWebhookPayload. Intended for
 * reference/testing — real verification happens on the receiving service.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  timestamp: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
