/**
 * Webhook event types — the full set of events an external integration can
 * subscribe to. Naming mirrors the existing Notification.type values
 * (job_complete | transform_complete | mint_success | earnings_received)
 * but uses dot-separated names, the convention external webhook consumers
 * expect (Stripe, GitHub, etc.).
 */
export const WEBHOOK_EVENT_TYPES = [
  "job.completed",
  "transform.completed",
  "clip.minted",
  "earnings.received",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  events: WebhookEventType[];
  /** HMAC signing secret — returned to the caller only at creation time. */
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface WebhookEventPayload {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: Record<string, unknown>;
}

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed";

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEventPayload;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
}
