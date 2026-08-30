/**
 * webhookStore — per-user webhook endpoint + delivery storage.
 *
 * Mirrors the earningsStore/jobStore pattern: a thin interface backed today
 * by an in-process Map (fine for single-instance / dev). Swap to a database
 * adapter without touching route or dispatcher code.
 */

import crypto from "crypto";
import type { WebhookEndpoint, WebhookEventType, WebhookDelivery } from "./types";

export interface CreateWebhookInput {
  userId: string;
  url: string;
  events: WebhookEventType[];
}

class MapWebhookStore {
  private readonly endpoints = new Map<string, WebhookEndpoint>();
  private readonly deliveries = new Map<string, WebhookDelivery[]>();

  create(input: CreateWebhookInput): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      id: `wh_${crypto.randomUUID()}`,
      userId: input.userId,
      url: input.url,
      events: input.events,
      secret: `whsec_${crypto.randomBytes(24).toString("hex")}`,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  listForUser(userId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter((e) => e.userId === userId);
  }

  get(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id);
  }

  update(
    id: string,
    userId: string,
    patch: Partial<Pick<WebhookEndpoint, "url" | "events" | "active">>
  ): WebhookEndpoint | undefined {
    const existing = this.endpoints.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated = { ...existing, ...patch };
    this.endpoints.set(id, updated);
    return updated;
  }

  remove(id: string, userId: string): boolean {
    const existing = this.endpoints.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.endpoints.delete(id);
    this.deliveries.delete(id);
    return true;
  }

  listActiveForEvent(eventType: WebhookEventType): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(
      (e) => e.active && e.events.includes(eventType)
    );
  }

  recordDelivery(delivery: WebhookDelivery): void {
    const existing = this.deliveries.get(delivery.endpointId) ?? [];
    const withoutStale = existing.filter((d) => d.id !== delivery.id);
    withoutStale.push(delivery);
    // Cap history per endpoint to avoid unbounded growth.
    this.deliveries.set(delivery.endpointId, withoutStale.slice(-100));
  }

  listDeliveries(endpointId: string, userId: string): WebhookDelivery[] {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint || endpoint.userId !== userId) return [];
    return this.deliveries.get(endpointId) ?? [];
  }
}

export const webhookStore = new MapWebhookStore();
