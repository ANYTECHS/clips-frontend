import { z } from "zod";

const BATCH_MAX_REQUESTS = 20;

export const batchRequestItemSchema = z.object({
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
  path: z.string().min(1).startsWith("/api/"),
  body: z.unknown().optional(),
});

export const batchRequestSchema = z.object({
  requests: z
    .array(batchRequestItemSchema)
    .min(1, "At least one request is required")
    .max(BATCH_MAX_REQUESTS, `At most ${BATCH_MAX_REQUESTS} requests per batch`),
});

export type BatchRequestItem = z.infer<typeof batchRequestItemSchema>;
export type BatchRequest = z.infer<typeof batchRequestSchema>;

export interface BatchResponseItem {
  status: number;
  body: unknown;
}
