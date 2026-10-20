/**
 * Outbound webhook dispatcher — Issue #1251.
 * Bridges to durable database-backed delivery engine.
 */

import { triggerWebhookEvent, executeDeliveryAttempt } from "./delivery";

export { triggerWebhookEvent, executeDeliveryAttempt };
