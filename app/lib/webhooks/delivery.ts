/**
 * Outbound webhook delivery engine with exponential retry schedule and Dead Letter Queue — Issue #1251.
 */

import * as crypto from "crypto";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { signWebhookPayload } from "./signing";
import { validateWebhookUrl } from "./ssrf";
import { normalizeWebhookEventType } from "./types";

/**
 * Required retry-delay schedule:
 * Retry 1: 1 minute (60_000 ms)
 * Retry 2: 5 minutes (300_000 ms)
 * Retry 3: 30 minutes (1_800_000 ms)
 * Retry 4: 2 hours (7_200_000 ms)
 * Retry 5: 12 hours (43_200_000 ms)
 */
export const RETRY_DELAYS_MS = [
  60 * 1000,          // 1 min
  5 * 60 * 1000,      // 5 min
  30 * 60 * 1000,     // 30 min
  2 * 60 * 60 * 1000, // 2 hours
  12 * 60 * 60 * 1000 // 12 hours
] as const;

export const MAX_SCHEDULED_RETRIES = RETRY_DELAYS_MS.length; // 5 retries (6 total attempts)
export const DELIVERY_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KB limit

export interface DeliveryClock {
  now: () => number;
}

export interface DeliveryScheduler {
  schedule: (fn: () => Promise<void> | void, delayMs: number) => void;
}

export interface DeliveryFetcher {
  fetch: typeof globalThis.fetch;
}

const defaultClock: DeliveryClock = {
  now: () => Date.now(),
};

const defaultScheduler: DeliveryScheduler = {
  schedule: (fn, delayMs) => {
    const timer = setTimeout(() => {
      void fn();
    }, delayMs);
    // Unref so test/node runner doesn't keep alive unnecessarily
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  },
};

const defaultFetcher: DeliveryFetcher = {
  fetch: (url, init) => globalThis.fetch(url, init),
};

export interface DeliveryContext {
  clock?: DeliveryClock;
  scheduler?: DeliveryScheduler;
  fetcher?: DeliveryFetcher;
}

/**
 * Triggers outbound webhook deliveries for all active endpoints subscribed to eventType for a user.
 */
export async function triggerWebhookEvent(
  userId: string,
  eventType: string,
  data: Record<string, unknown>,
  ctx: DeliveryContext = {}
): Promise<string[]> {
  const canonicalEvent = normalizeWebhookEventType(eventType);

  // Find all active endpoints for this user that subscribe to this event or canonical alias
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      active: true,
      OR: [
        { events: { has: canonicalEvent } },
        { events: { has: eventType } },
        { events: { has: "*" } },
      ],
    },
  });

  if (!endpoints || endpoints.length === 0) {
    return [];
  }

  const deliveryIds: string[] = [];
  const eventId = `evt_${crypto.randomUUID()}`;

  for (const endpoint of endpoints) {
    try {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          eventType: canonicalEvent,
          eventId,
          payload: {
            id: eventId,
            type: canonicalEvent,
            createdAt: new Date().toISOString(),
            data,
          },
          attempt: 1,
          status: "pending",
          isDeadLetter: false,
        },
      });

      deliveryIds.push(delivery.id);

      // Trigger initial delivery attempt asynchronously
      void executeDeliveryAttempt(delivery.id, ctx);
    } catch (err) {
      logger.error("[webhooks] Failed to create delivery record:", err);
    }
  }

  return deliveryIds;
}

/**
 * Executes a single delivery attempt for a given delivery record.
 */
export async function executeDeliveryAttempt(
  deliveryId: string,
  ctx: DeliveryContext = {}
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const clock = ctx.clock ?? defaultClock;
  const scheduler = ctx.scheduler ?? defaultScheduler;
  const fetcher = ctx.fetcher ?? defaultFetcher;

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery || !delivery.endpoint || !delivery.endpoint.active) {
    return { success: false, error: "Delivery or active endpoint not found" };
  }

  const { endpoint } = delivery;

  // Validate URL scheme and SSRF restrictions
  const ssrfCheck = await validateWebhookUrl(endpoint.url);
  if (!ssrfCheck.valid) {
    const errorMsg = `SSRF check failed: ${ssrfCheck.error}`;
    await markDeliveryFailedOrDeadLetter(delivery.id, delivery.attempt, 0, errorMsg, clock, scheduler);
    return { success: false, error: errorMsg };
  }

  const payloadString = JSON.stringify(delivery.payload);
  const nowMs = clock.now();
  const timestamp = Math.floor(nowMs / 1000).toString();
  const { headerValue } = signWebhookPayload(endpoint.secret, payloadString, timestamp);

  const attemptTime = new Date(nowMs);
  let statusCode = 0;
  let responseText: string | null = null;
  let errorMsg: string | null = null;
  let isSuccess = false;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetcher.fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ClipCash-Signature": headerValue,
        "X-ClipCash-Delivery": delivery.id,
        "X-ClipCash-Event": delivery.eventType,
        "X-ClipCash-Timestamp": timestamp,
        "User-Agent": "ClipCash-Webhooks/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);
    statusCode = res.status;
    isSuccess = res.ok;

    try {
      const text = await res.text();
      responseText = text.slice(0, 2048); // Bound stored response text
    } catch {
      responseText = null;
    }

    if (!isSuccess) {
      errorMsg = `HTTP response status ${statusCode}`;
    }
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);
    statusCode = 0;
    isSuccess = false;
    errorMsg = err instanceof Error ? err.message : "Network failure or timeout";
  }

  if (isSuccess) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "delivered",
        statusCode,
        response: responseText,
        error: null,
        attemptedAt: attemptTime,
        deliveredAt: attemptTime,
        nextAttemptAt: null,
        isDeadLetter: false,
      },
    });

    return { success: true, statusCode };
  }

  // Delivery failed - schedule retry or transition to dead letter queue
  await markDeliveryFailedOrDeadLetter(
    delivery.id,
    delivery.attempt,
    statusCode,
    errorMsg ?? "Delivery failed",
    clock,
    scheduler,
    responseText
  );

  return { success: false, statusCode, error: errorMsg ?? undefined };
}

/**
 * Handles failed attempts: schedules retry according to schedule or moves to Dead Letter Queue.
 */
async function markDeliveryFailedOrDeadLetter(
  deliveryId: string,
  currentAttempt: number,
  statusCode: number,
  errorMsg: string,
  clock: DeliveryClock,
  scheduler: DeliveryScheduler,
  responseSnippet?: string | null
): Promise<void> {
  const nowMs = clock.now();
  const attemptTime = new Date(nowMs);

  // Check if retries are exhausted (1 initial attempt + 5 retries = 6 attempts max)
  if (currentAttempt > MAX_SCHEDULED_RETRIES) {
    // Retries exhausted -> Dead Letter Queue
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "dead_letter",
        isDeadLetter: true,
        statusCode,
        error: errorMsg,
        response: responseSnippet ?? null,
        attemptedAt: attemptTime,
        nextAttemptAt: null,
      },
    });

    logger.warn(`[webhooks] Delivery ${deliveryId} permanently failed and moved to Dead Letter Queue after ${currentAttempt} attempts.`);
    return;
  }

  // Next retry delay (currentAttempt: 1 -> retry 1 index 0; currentAttempt: 2 -> retry 2 index 1; etc.)
  const delayIndex = currentAttempt - 1;
  const delayMs = RETRY_DELAYS_MS[delayIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const nextAttemptAt = new Date(nowMs + delayMs);
  const nextAttemptNumber = currentAttempt + 1;

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "failed",
      statusCode,
      error: errorMsg,
      response: responseSnippet ?? null,
      attemptedAt: attemptTime,
      nextAttemptAt,
      attempt: nextAttemptNumber,
      isDeadLetter: false,
    },
  });

  scheduler.schedule(() => {
    void executeDeliveryAttempt(deliveryId, { clock, scheduler });
  }, delayMs);
}

/**
 * Manually redelivers an eligible delivery (e.g. from Dead Letter Queue or failed state).
 */
export async function redeliverWebhook(
  deliveryId: string,
  userId: string,
  ctx: DeliveryContext = {}
): Promise<{ success: boolean; delivery?: unknown; error?: string }> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery || !delivery.endpoint || delivery.endpoint.userId !== userId) {
    return { success: false, error: "Delivery not found or unauthorized" };
  }

  // Redelivery is only permitted when delivery is failed or dead-lettered
  if (delivery.status === "delivered" && !delivery.isDeadLetter) {
    return { success: false, error: "Delivered webhooks cannot be redelivered" };
  }

  if (delivery.status === "pending") {
    return { success: false, error: "Delivery is currently in progress" };
  }

  // Atomically move out of dead letter queue and mark pending
  const updated = await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "pending",
      isDeadLetter: false,
      error: null,
      nextAttemptAt: null,
    },
  });

  // Execute delivery immediately
  const result = await executeDeliveryAttempt(deliveryId, ctx);
  return { success: result.success, delivery: updated, error: result.error };
}
