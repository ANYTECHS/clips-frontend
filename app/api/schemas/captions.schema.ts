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

export const captionStyleSchema = z.object({
  fontStyle: z.enum(["bold", "rounded", "shadow", "gradient"]),
  position: z.enum(["top", "center", "bottom"]),
});

export const captionSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export const generateCaptionsBodySchema = z.object({
  language: z.enum([
    "auto", "en", "es", "fr", "de", "pt", "ja", "ko", "zh", "ar", "hi",
  ]),
});

export const updateCaptionsBodySchema = z.object({
  segments: z.array(captionSegmentSchema).min(1),
  style: captionStyleSchema,
  language: z.string().optional(),
  burnIntoExport: z.boolean().optional().default(true),
});

export type CaptionSegment = z.infer<typeof captionSegmentSchema>;
export type CaptionStyle = z.infer<typeof captionStyleSchema>;
