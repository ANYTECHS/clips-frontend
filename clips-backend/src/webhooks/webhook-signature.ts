import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Outbound webhook signing (Issue #1400).
 *
 * Every outbound delivery is signed with HMAC-SHA256 over the **raw JSON
 * request body** using the subscription's secret. The signature is sent in
 * the `X-Clips-Signature` header in the form `sha256=<hex digest>` — the
 * same convention as GitHub/Stripe-style webhooks.
 *
 * Consumers verify by recomputing the HMAC over the exact raw body bytes
 * they received (before any JSON parsing) and comparing in constant time.
 * See docs/webhooks.md for the full algorithm and a sample snippet.
 */
export class WebhookSignature {
  /** `sha256=<hex>` signature for a raw body. */
  static sign(secret: string, rawBody: string | Buffer): string {
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    return `sha256=${digest}`;
  }

  /** Constant-time verification of a `sha256=<hex>` signature. */
  static verify(
    secret: string,
    rawBody: string | Buffer,
    signature: string | undefined,
  ): boolean {
    if (!signature) return false;
    const expected = WebhookSignature.sign(secret, rawBody);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Generate a signing secret for a new subscription. */
  static generateSecret(): string {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }
}
