import { z } from "zod";

export const CAPTION_LANGUAGES = [
  { code: "auto", label: "Auto detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
] as const;

export const CAPTION_LANGUAGE_CODES = CAPTION_LANGUAGES.map((entry) => entry.code);

const MAX_CAPTION_DURATION_MS = 6 * 60 * 60 * 1000;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const captionFontFamilies = ["inter", "poppins", "montserrat", "roboto"] as const;
export type CaptionFontFamily = (typeof captionFontFamilies)[number];

export const captionStyleSchema = z.object({
  fontStyle: z.enum(["bold", "rounded", "shadow", "gradient"]),
  fontFamily: z.enum(captionFontFamilies).optional(),
  fontSize: z.number().int().min(12).max(96).optional(),
  color: z.string().regex(HEX_COLOR_PATTERN, "Caption color must be a hex value").optional(),
  backgroundColor: z
    .string()
    .regex(HEX_COLOR_PATTERN, "Caption background must be a hex value")
    .optional(),
  position: z.enum(["top", "center", "bottom"]),
});

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontStyle: "bold",
  fontFamily: "inter",
  fontSize: 48,
  color: "#FFFFFF",
  backgroundColor: "#000000",
  position: "bottom",
};

export const captionSegmentSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(500),
  startMs: z.number().int().min(0).max(MAX_CAPTION_DURATION_MS),
  endMs: z.number().int().min(1).max(MAX_CAPTION_DURATION_MS),
});

export const captionSegmentListSchema = z
  .array(captionSegmentSchema)
  .min(1)
  .max(1000)
  .superRefine((segments, ctx) => {
    const ids = new Set<string>();
    let previous: { startMs: number; endMs: number } | undefined;

    segments.forEach((segment, index) => {
      if (ids.has(segment.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: "Caption segment ids must be unique.",
        });
      }
      ids.add(segment.id);

      if (segment.endMs <= segment.startMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "endMs"],
          message: "Caption end time must be after its start time.",
        });
      }

      if (previous && segment.startMs < previous.startMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "startMs"],
          message: "Caption segments must be ordered by start time.",
        });
      } else if (previous && segment.startMs < previous.endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "startMs"],
          message: "Caption segments must not overlap.",
        });
      }

      previous = segment;
    });
  });

export const generateCaptionsBodySchema = z.object({
  language: z.enum(CAPTION_LANGUAGE_CODES),
});

export const updateCaptionsBodySchema = z.object({
  segments: captionSegmentListSchema,
  style: captionStyleSchema,
  language: z.enum(CAPTION_LANGUAGE_CODES).optional(),
  burnIntoExport: z.boolean().optional().default(true),
});

export type CaptionSegment = z.infer<typeof captionSegmentSchema>;
export type CaptionStyle = z.infer<typeof captionStyleSchema>;
export type GenerateCaptionsBody = z.infer<typeof generateCaptionsBodySchema>;
export type UpdateCaptionsBody = z.infer<typeof updateCaptionsBodySchema>;
