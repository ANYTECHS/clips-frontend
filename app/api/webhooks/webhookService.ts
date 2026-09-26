import crypto from "crypto";

import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m
const MAX_RETRIES = RETRY_DELAYS.length;

export interface WebhookPayload {
  eventType: string;
  data: any;
  timestamp: string;
}

export async function triggerWebhook(userId: string, eventType: string, data: any) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      userId,
      active: true,
      events: {
        has: eventType,
      },
    },
  });

  for (const webhook of webhooks) {
    await deliverWebhook(webhook.id, eventType, data);
  }
}

async function deliverWebhook(webhookId: string, eventType: string, data: any) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) return;

  const payload: WebhookPayload = {
    eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  const signature = generateSignature(payload, webhook.secret);

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      eventType,
      payload,
      attempt: 1,
    },
  });

  await attemptDelivery(delivery.id, webhook.url, webhook.secret, payload);
}

async function attemptDelivery(
  deliveryId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) return;

  const signature = generateSignature(payload, secret);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": payload.eventType,
        "User-Agent": "ClipCash-Webhooks/1.0",
      },
      body: JSON.stringify(payload),
    });

    const statusCode = response.status;
    const responseText = await response.text();

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        statusCode,
        response: responseText,
        success: statusCode >= 200 && statusCode < 300,
        deliveredAt: new Date(),
      },
    });

    if (!response.ok && delivery.attempt < MAX_RETRIES) {
      // Schedule retry
      const nextRetryDelay = RETRY_DELAYS[delivery.attempt - 1];
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attempt: delivery.attempt + 1,
          nextRetryAt,
        },
      });

      // Schedule retry (in production, use a job queue like Bull/Redis)
      setTimeout(() => {
        retryDelivery(deliveryId, url, secret, payload);
      }, nextRetryDelay);
    }
  } catch (error) {
    logger.error("Webhook delivery failed:", error);

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        statusCode: 0,
        response: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
    });

    if (delivery.attempt < MAX_RETRIES) {
      const nextRetryDelay = RETRY_DELAYS[delivery.attempt - 1];
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attempt: delivery.attempt + 1,
          nextRetryAt,
        },
      });

      setTimeout(() => {
        retryDelivery(deliveryId, url, secret, payload);
      }, nextRetryDelay);
    }
  }
}

async function retryDelivery(
  deliveryId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery || delivery.success) return;

  await attemptDelivery(deliveryId, url, secret, payload);
}

function generateSignature(payload: WebhookPayload, secret: string): string {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  return `sha256=${hmac.digest("hex")}`;
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(JSON.parse(payload), secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
