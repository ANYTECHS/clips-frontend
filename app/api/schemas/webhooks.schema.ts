import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "@/app/lib/webhooks/types";

/**
 * Request body for POST /api/webhooks
 */
export const createWebhookBodySchema = z.object({
  url: z.string().url().refine((url) => url.startsWith("https://"), {
    message: "Webhook URL must use HTTPS",
  }),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "At least one event is required"),
});

/**
 * Request body for PATCH /api/webhooks/[id]
 */
export const updateWebhookBodySchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith("https://"), { message: "Webhook URL must use HTTPS" })
    .optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  active: z.boolean().optional(),
});

export type CreateWebhookBody = z.infer<typeof createWebhookBodySchema>;
export type UpdateWebhookBody = z.infer<typeof updateWebhookBodySchema>;
