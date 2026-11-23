import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookSignature } from './webhook-signature';
import type { EarningCreatedEvent } from './webhooks.gateway';

const DELIVERY_TIMEOUT_MS = 10_000;

export interface OutboundWebhookEvent {
  /** Unique delivery id (also sent as X-Clips-Delivery). */
  id: string;
  /** Event name, e.g. "earning.created". */
  event: string;
  createdAt: string;
  data: unknown;
}

/**
 * OutboundWebhookService — Issue #1400
 *
 * Delivers domain events to user-registered webhook subscriptions.
 * Each delivery is a JSON POST signed with HMAC-SHA256 — see
 * WebhookSignature and docs/webhooks.md for the verification algorithm.
 *
 * Delivery is best-effort: failures are logged, never thrown, so webhook
 * consumers can never break core request processing.
 */
@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Domain event → dispatch to every matching active subscription. */
  @OnEvent('earning.created')
  async handleEarningCreated(event: EarningCreatedEvent): Promise<void> {
    if (!event.userId) return;
    await this.dispatch(event.userId, 'earning.created', {
      id: event.id,
      clipId: event.clipId,
      amount: event.amount,
      currency: event.currency,
      date: event.date,
      source: event.source,
      platform: event.platform,
    });
  }

  /** Dispatch `event` to all active subscriptions of `userId` matching it. */
  async dispatch(
    userId: number,
    event: string,
    data: unknown,
  ): Promise<{ delivered: number; failed: number }> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ events: { has: event } }, { events: { has: '*' } }],
      },
    });

    const payload: OutboundWebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      event,
      createdAt: new Date().toISOString(),
      data,
    };
    const rawBody = JSON.stringify(payload);

    let delivered = 0;
    let failed = 0;
    for (const sub of subscriptions) {
      const ok = await this.deliver(sub.url, sub.secret, rawBody, payload);
      if (ok) delivered++;
      else failed++;
    }

    if (subscriptions.length) {
      this.logger.log(
        `Outbound webhook "${event}" for user ${userId}: ${delivered} delivered, ${failed} failed`,
      );
    }
    return { delivered, failed };
  }

  private async deliver(
    url: string,
    secret: string,
    rawBody: string,
    payload: OutboundWebhookEvent,
  ): Promise<boolean> {
    try {
      const signature = WebhookSignature.sign(secret, rawBody);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Clips-Event': payload.event,
          'X-Clips-Delivery': payload.id,
          'X-Clips-Timestamp': payload.createdAt,
          'X-Clips-Signature': signature,
        },
        body: rawBody,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          `Webhook delivery to ${url} returned HTTP ${response.status}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Webhook delivery to ${url} failed: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
