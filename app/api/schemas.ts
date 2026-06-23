import { z, ZodSchema, ZodIssue } from "zod";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const JobRestartSchema = z.object({
  action: z.enum(["restart"]).optional(),
});

export const UploadFormSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file is required"),
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
