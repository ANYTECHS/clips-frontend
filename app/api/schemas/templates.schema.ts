import { z } from "zod";

export const templateAspectRatioSchema = z.enum(["9:16", "1:1", "16:9"]);
export const templateDurationSecondsSchema = z.number().int().min(3).max(600);
export const templateNameSchema = z.string().trim().min(1).max(80);

export const templateSettingsSchema = z.object({
  aspectRatio: templateAspectRatioSchema,
  durationSeconds: templateDurationSecondsSchema,
  /** Human-readable style preset selected in the editor. */
  style: z.string().trim().min(1).max(64),
  /** Machine style name used by the processing backend, when one is selected. */
  transformStyle: z.string().trim().min(1).max(64).nullable().default(null),
  /** Backend-compatible transform tuning options. */
  transformOptions: z.record(z.string(), z.unknown()).default({}),
});

export const createTemplateBodySchema = z.object({
  name: templateNameSchema,
  description: z.string().trim().max(240).default(""),
  settings: templateSettingsSchema,
  sharedWithTeam: z.boolean().default(false),
});

export const updateTemplateBodySchema = createTemplateBodySchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;
