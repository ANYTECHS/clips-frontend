import { z } from "zod";

const TAG_MAX_LENGTH = 30;
const TAGS_MAX_PER_CLIP = 10;

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(TAG_MAX_LENGTH)
  .transform((tag) => tag.toLowerCase());

export const getClipsQuerySchema = z.object({
  page: z.string().optional().default("1").transform((v) => parseInt(v, 10)),
  pageSize: z.string().optional().default("20").transform((v) => parseInt(v, 10)),
  status: z.string().optional().default(""),
  style: z.string().optional().default(""),
  virality: z.array(z.string()).optional().default(["high", "medium", "low"]),
  tags: z.string().optional().transform((v) =>
    v ? v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : []
  ),
  q: z.string().optional().default(""),
  dateFrom: z.string().optional().default(""),
  dateTo: z.string().optional().default(""),
  platform: z.string().optional().default(""),
  durationMin: z.string().optional().default("").transform((v) => v ? Number(v) : undefined),
  durationMax: z.string().optional().default("").transform((v) => v ? Number(v) : undefined),
});

export const updateClipBodySchema = z.object({
  title: z.string().min(1).optional(),
  tags: z
    .array(tagSchema)
    .max(TAGS_MAX_PER_CLIP)
    .optional()
    .transform((tags) => (tags ? [...new Set(tags)] : undefined)),
});

export const bulkClipIdsBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(100),
});

export const postClipBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1),
  platforms: z
    .array(z.enum(["youtube", "instagram", "tiktok", "twitter"]))
    .min(1),
});

export const mintClipBodySchema = z.object({
  clipId: z.string().min(1),
});

export const createClipBodySchema = z.object({
  jobId: z.string().min(1),
  title: z.string().min(1),
  style: z.string().optional(),
  virality: z.enum(["high", "medium", "low"]).optional(),
});

export const bulkUpdateTagsBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(100),
  tags: z.array(tagSchema).max(TAGS_MAX_PER_CLIP),
  mode: z.enum(["set", "add", "remove"]).default("set"),
});

export const bulkUpdateStatusBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(["pending", "listed", "history"]),
});

export type GetClipsQuery = z.infer<typeof getClipsQuerySchema>;
export type UpdateClipBody = z.infer<typeof updateClipBodySchema>;
export type BulkClipIdsBody = z.infer<typeof bulkClipIdsBodySchema>;
export type PostClipBody = z.infer<typeof postClipBodySchema>;
export type MintClipBody = z.infer<typeof mintClipBodyBodySchema>;
export type CreateClipBody = z.infer<typeof createClipBodySchema>;
export type BulkUpdateTagsBody = z.infer<typeof bulkUpdateTagsBodySchema>;
export type BulkUpdateStatusBody = z.infer<typeof bulkUpdateStatusBodySchema>;
