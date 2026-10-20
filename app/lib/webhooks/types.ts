/**
 * Webhook event types and data contracts — Issue #1251.
 *
 * Supported canonical events:
 *   - job_complete
 *   - transform_complete
 *   - mint_success
 *   - earnings_received
 */

export const WEBHOOK_EVENT_TYPES = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
  // Dot-separated aliases for backwards compatibility with external integrators
  "job.completed",
  "transform.completed",
  "clip.minted",
  "earnings.received",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const CANONICAL_WEBHOOK_EVENTS = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
] as const;

export type CanonicalWebhookEventType = (typeof CANONICAL_WEBHOOK_EVENTS)[number];

export function normalizeWebhookEventType(event: string): string {
  if (event === "job.completed") return "job_complete";
  if (event === "transform.completed") return "transform_complete";
  if (event === "clip.minted") return "mint_success";
  if (event === "earnings.received") return "earnings_received";
  return event;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "dead_letter";

export interface WebhookEndpointDto {
  id: string;
  userId: string;
  url: string;
  events: string[];
  active: boolean;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryDto {
  id: string;
  endpointId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  attempt: number;
  status: WebhookDeliveryStatus;
  statusCode: number | null;
  response: string | null;
  error: string | null;
  isDeadLetter: boolean;
  nextAttemptAt: string | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}
