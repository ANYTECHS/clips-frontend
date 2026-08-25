import { z } from "zod";

/**
 * Job ID validation schema
 * Accepts UUID (with or without hyphens) or alphanumeric slugs up to 64 chars
 */
export const jobIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
  message: "Invalid job id format. Must be 1-64 alphanumeric characters, underscores, or hyphens.",
});

/**
 * Query parameters for GET /api/jobs/[id]
 */
export const getJobQuerySchema = z.object({
  id: jobIdSchema,
});

/**
 * Request body for POST /api/jobs/[id] (restart job)
 */
export const restartJobBodySchema = z.object({
  // No body required for restart, just the job ID in the path
}).optional();

/**
 * Request body for POST /api/jobs (create job)
 */
export const createJobBodySchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().default("video/mp4"),
  objectKey: z.string().min(1, "Object key is required"),
});

export type JobId = z.infer<typeof jobIdSchema>;
export type GetJobQuery = z.infer<typeof getJobQuerySchema>;
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
