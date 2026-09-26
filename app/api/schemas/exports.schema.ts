import { z } from "zod";

export const transcodeBodySchema = z.object({
  format: z.enum(["mp4", "webm"]),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
  quality: z.enum(["source", "720p", "1080p"]),
  platform: z.enum(["tiktok", "instagram", "youtube", "x"]).optional(),
});

export type TranscodeBody = z.infer<typeof transcodeBodySchema>;
