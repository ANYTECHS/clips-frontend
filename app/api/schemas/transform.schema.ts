import { z } from "zod";

/**
 * Allowed transform styles (sourced from env at runtime)
 */
const ALLOWED_STYLES = ["anime", "cinematic", "sketch", "watercolor"] as const;

/**
 * Anime sub-styles
 */
const ANIME_SUB_STYLES = ["shonen", "shojo", "chibi", "mecha", "ghibli-inspired"] as const;

/**
 * Outline thickness options
 */
const OUTLINE_THICKNESSES = ["thin", "medium", "bold"] as const;

/**
 * Background style options
 */
const BACKGROUND_STYLES = ["original", "painted", "cel-shaded"] as const;

/**
 * Anime transform options - matches the interface in app/lib/animeTransform.ts
 */
export const animeTransformOptionsSchema = z.object({
  subStyle: z.enum(ANIME_SUB_STYLES),
  colorIntensity: z.number().min(0).max(100),
  outlineThickness: z.enum(OUTLINE_THICKNESSES),
  backgroundStyle: z.enum(BACKGROUND_STYLES),
});

/**
 * Request body for POST /api/transform
 */
export const transformBodySchema = z.object({
  clipId: z.string().min(1, "Clip ID is required"),
  style: z.enum(ALLOWED_STYLES),
  userId: z.string().optional(),
  transformOptions: animeTransformOptionsSchema.optional(),
});

/**
 * Request body for POST /api/transform/batch
 */
export const transformBatchBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1, "At least one clip ID is required"),
  style: z.enum(ALLOWED_STYLES),
  transformOptions: animeTransformOptionsSchema.optional(),
});

/**
 * Request body for POST /api/transform/preview
 */
export const transformPreviewBodySchema = z.object({
  clipId: z.string().min(1, "Clip ID is required"),
  style: z.enum(ALLOWED_STYLES),
  transformOptions: animeTransformOptionsSchema.optional(),
});

export type AnimeTransformOptions = z.infer<typeof animeTransformOptionsSchema>;
export type TransformBody = z.infer<typeof transformBodySchema>;
export type TransformBatchBody = z.infer<typeof transformBatchBodySchema>;
export type TransformPreviewBody = z.infer<typeof transformPreviewBodySchema>;
