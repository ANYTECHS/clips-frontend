/**
 * Outbound webhook dispatcher — fans an internal event out to every active
 * subscriber's endpoint, signing each delivery and retrying on failure with
 * exponential backoff.
 *
 * In-process scheduling (setTimeout), matching the rest of this codebase's
 * single-instance in-memory stores (earningsStore, jobStore, rate limiter).
 * A multi-instance deployment should move this to a durable queue (SQS,
 * BullMQ, etc.) so retries survive a process restart.
 */

import crypto from "crypto";
import { logger } from "@/app/lib/logger";
import { webhookStore } from "./webhookStore";
import { signWebhookPayload } from "./signing";
import type { WebhookEndpoint, WebhookEventPayload, WebhookEventType, WebhookDelivery } from "./types";

const MAX_ATTEMPTS = 5;
/** Delay before each retry attempt, in ms. Index 0 = delay before attempt 2. */
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];
const DELIVERY_TIMEOUT_MS = 10_000;

export async function triggerWebhookEvent(
  userId: string,
  type: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = webhookStore.listActiveForEvent(type).filter((e) => e.userId === userId);
  if (endpoints.length === 0) return;

  const event: WebhookEventPayload = {
    id: `evt_${crypto.randomUUID()}`,
    type,
    createdAt: new Date().toISOString(),
    data,
  };

  for (const endpoint of endpoints) {
    const delivery: WebhookDelivery = {
      id: `whd_${crypto.randomUUID()}`,
      endpointId: endpoint.id,
      event,
      status: "pending",
      attempts: 0,
      lastAttemptAt: null,
      lastStatusCode: null,
      lastError: null,
    };
    // Fire-and-forget — callers trigger events from within request handlers
    // and shouldn't block on external delivery latency/retries.
    void attemptDelivery(endpoint, delivery);
  }
}

async function attemptDelivery(endpoint: WebhookEndpoint, delivery: WebhookDelivery): Promise<void> {
  delivery.attempts += 1;
  delivery.lastAttemptAt = new Date().toISOString();

  const rawBody = JSON.stringify(delivery.event);
  const { timestamp, signature } = signWebhookPayload(endpoint.secret, rawBody);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Id": delivery.event.id,
        "X-Webhook-Event": delivery.event.type,
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Signature": signature,
      },
      body: rawBody,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    delivery.lastStatusCode = response.status;

    if (response.ok) {
      delivery.status = "succeeded";
      delivery.lastError = null;
      webhookStore.recordDelivery({ ...delivery });
      return;
    }

    delivery.lastError = `Endpoint responded with ${response.status}`;
  } catch (error) {
    delivery.lastError = error instanceof Error ? error.message : "Delivery failed";
    delivery.lastStatusCode = null;
  }

  webhookStore.recordDelivery({ ...delivery });
  scheduleRetryOrGiveUp(endpoint, delivery);
}

function scheduleRetryOrGiveUp(endpoint: WebhookEndpoint, delivery: WebhookDelivery): void {
  if (delivery.attempts >= MAX_ATTEMPTS) {
    delivery.status = "failed";
    webhookStore.recordDelivery({ ...delivery });
    logger.warn(
      `[webhooks] Giving up on delivery ${delivery.id} to ${endpoint.url} after ${delivery.attempts} attempts: ${delivery.lastError}`
    );
    return;
  }

  const delay = RETRY_DELAYS_MS[delivery.attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  setTimeout(() => {
    void attemptDelivery(endpoint, delivery);
  }, delay);
}
