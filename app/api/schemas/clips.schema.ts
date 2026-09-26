import { z } from "zod";

import { createListQuerySchema } from "@/app/api/lib/listQuery";

const TAG_MAX_LENGTH = 30;
const TAGS_MAX_PER_CLIP = 10;

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(TAG_MAX_LENGTH)
  .transform((tag) => tag.toLowerCase());


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
  platforms: z.array(z.enum(["youtube", "instagram", "tiktok", "twitter"])).min(1),
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

/**
 * Bulk metadata export (Issue #1059).
 *
 * Capped at the same 100 as the other bulk operations: the selection UI works
 * in pages, and an unbounded request would let one call serialise an entire
 * library into memory.
 */
export const bulkExportBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(100),
  format: z.enum(["csv", "json"]).default("csv"),
});

export const bulkUpdateStatusBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(["pending", "listed", "history"]),
});

export type GetClipsQuery = z.infer<typeof getClipsQuerySchema>;
export type UpdateClipBody = z.infer<typeof updateClipBodySchema>;
export type BulkClipIdsBody = z.infer<typeof bulkClipIdsBodySchema>;
export type PostClipBody = z.infer<typeof postClipBodySchema>;
export type MintClipBody = z.infer<typeof mintClipBodySchema>;
export type CreateClipBody = z.infer<typeof createClipBodySchema>;
export type BulkExportBody = z.infer<typeof bulkExportBodySchema>;
export type BulkUpdateTagsBody = z.infer<typeof bulkUpdateTagsBodySchema>;
export type BulkUpdateStatusBody = z.infer<typeof bulkUpdateStatusBodySchema>;
