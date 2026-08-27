/**
 * app/api/schemas.ts
 *
 * Centralised Zod schemas for all API route inputs.
 *
 * Issue #890 – comprehensive request validation with sanitization.
 * Issue #889 – version constants consumed by the versioning middleware.
 */

import { z, ZodSchema, ZodIssue } from "zod";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const JobRestartSchema = z.object({
  action: z.enum(["restart"]).optional(),
});

export const UploadFormSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file is required"),
});

/**
 * Earnings query-string parameters accepted by GET /api/earnings/transactions.
 */
export const EarningsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1).max(10_000)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  startDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "startDate must be YYYY-MM-DD"),
  endDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "endDate must be YYYY-MM-DD"),
  platform: z
    .enum(["YouTube", "TikTok", "Instagram", "Twitch", "all"])
    .optional()
    .default("all"),
  status: z
    .enum(["completed", "pending", "failed", "all"])
    .optional()
    .default("all"),
  search: z
    .string()
    .max(200, "Search query too long")
    .optional()
    .transform((v) => v?.trim()),
});

/**
 * Job callback body — posted by the AI backend.
 * Mirrors the CallbackBodySchema in the callback route but is co-located
 * here so other utilities can import it without pulling in route internals.
 */
export const JobCallbackSchema = z.object({
  status: z.enum(["queued", "processing", "complete", "error"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  momentsFound: z.number().min(0).optional(),
  estimatedSecondsRemaining: z.number().min(0).optional(),
  errorCode: z
    .enum([
      "UNSUPPORTED_CODEC",
      "VIDEO_TOO_SHORT",
      "VIDEO_TOO_LONG",
      "PROCESSING_TIMEOUT",
      "INTERNAL_ERROR",
    ])
    .optional(),
  errorMessage: z.string().max(500).optional(),
});

/**
 * User profile update body — PATCH /api/user/profile.
 */
export const UserProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().max(254).optional(),
  avatarUrl: z.string().url().max(2_048).optional(),
});

/**
 * Onboarding form body — POST /api/user/onboarding.
 */
export const OnboardingSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  platforms: z
    .array(z.enum(["YouTube", "TikTok", "Instagram", "Twitch", "Facebook", "Snapchat", "LinkedIn"]))
    .min(1, "Select at least one platform"),
  goal: z.enum(["grow_audience", "monetise", "repurpose", "all"]).optional(),
});

// ── Helper ────────────────────────────────────────────────────────────────────

export type ValidationError = { error: "Validation failed"; issues: ZodIssue[] };

export function parseBody<T>(
  schema: ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; result: ValidationError } {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, result: { error: "Validation failed", issues: parsed.error.issues } };
  }
  return { ok: true, data: parsed.data };
}

/**
 * parseQuery — validate URL search params against a schema.
 *
 * Converts a URLSearchParams / Record<string, string> to a plain object
 * and runs it through the provided schema.
 */
export function parseQuery<T>(
  schema: ZodSchema<T>,
  params: URLSearchParams | Record<string, string>
): { ok: true; data: T } | { ok: false; result: ValidationError } {
  const plain: Record<string, string> =
    params instanceof URLSearchParams
      ? Object.fromEntries(params.entries())
      : params;
  return parseBody(schema, plain);
}

