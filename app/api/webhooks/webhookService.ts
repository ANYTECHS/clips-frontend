/**
 * Webhook service bridge — delegates to app/lib/webhooks/delivery.ts — Issue #1251.
 */

import { triggerWebhookEvent, executeDeliveryAttempt, redeliverWebhook } from "@/app/lib/webhooks/delivery";
import { signWebhookPayload, verifyWebhookSignature } from "@/app/lib/webhooks/signing";

export {
  triggerWebhookEvent,
  executeDeliveryAttempt,
  redeliverWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
};

export async function triggerWebhook(userId: string, eventType: string, data: unknown) {
  return triggerWebhookEvent(userId, eventType, data as Record<string, unknown>);
}

export function generateSignature(payload: unknown, secret: string): string {
  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const { headerValue } = signWebhookPayload(secret, payloadString);
  return headerValue;
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const result = verifyWebhookSignature(secret, payload, signature, 0);
  return result.valid;
}
