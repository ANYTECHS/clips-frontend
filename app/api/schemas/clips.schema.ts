import { z } from "zod";

/**
 * Validation for individual tags:
 * - Max 30 characters per tag
 * - No leading/trailing whitespace
 * - Must be non-empty after trimming
 */
const TAG_MAX_LENGTH = 30;
const TAGS_MAX_PER_CLIP = 10;

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(TAG_MAX_LENGTH, `Tag must be ${TAG_MAX_LENGTH} characters or less`)
  .transform((tag) => tag.toLowerCase());

/**
 * Query parameters for GET /api/clips
 */
export const getClipsQuerySchema = z.object({
  page: z.string().optional().default("1").transform((val) => parseInt(val, 10)),
  pageSize: z.string().optional().default("20").transform((val) => parseInt(val, 10)),
  status: z.string().optional().default(""),
  style: z.string().optional().default(""),
  virality: z.array(z.string()).optional().default(["high", "medium", "low"]),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim().toLowerCase()) : []))
    .refine((tags) => tags.every((t) => t.length > 0), "All tags must be non-empty"),
});

/**
 * Request body for PATCH /api/clips/:id (update clip metadata)
 */
export const updateClipBodySchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  tags: z
    .array(tagSchema)
    .max(TAGS_MAX_PER_CLIP, `Maximum ${TAGS_MAX_PER_CLIP} tags per clip`)
    .optional()
    .transform((tags) => (tags ? [...new Set(tags)] : undefined)), // Remove duplicates
});

/**
 * Request body for DELETE /api/clips (bulk soft delete) and
 * PATCH /api/clips/archive (bulk archive/unarchive).
 */
export const bulkClipIdsBodySchema = z.object({
  clipIds: z
    .array(z.string().min(1))
    .min(1, "At least one clip ID is required")
    .max(100, "At most 100 clips can be modified in one request"),
});

/**
 * Request body for POST /api/clips/post (post clips to platforms)
 */
export const postClipBodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1, "At least one clip ID is required"),
  platforms: z.array(z.enum(["youtube", "instagram", "tiktok", "twitter"])).min(1, "At least one platform is required"),
});

/**
 * Request body for POST /api/clips/mint (mint clip as NFT)
 */
export const mintClipBodySchema = z.object({
  clipId: z.string().min(1, "Clip ID is required"),
});

/**
 * Request body for POST /api/clips (create clip)
 */
export const createClipBodySchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  title: z.string().min(1, "Title is required"),
  style: z.string().optional(),
  virality: z.enum(["high", "medium", "low"]).optional(),
});

export const bulkUpdateTagsBodySchema = z.object({
  clipIds: z
    .array(z.string().min(1))
    .min(1, "At least one clip ID is required")
    .max(100, "At most 100 clips can be modified in one request"),
  tags: z
    .array(tagSchema)
    .max(TAGS_MAX_PER_CLIP, `Maximum ${TAGS_MAX_PER_CLIP} tags per clip`),
  mode: z.enum(["set", "add", "remove"]).default("set"),
});

export const bulkUpdateStatusBodySchema = z.object({
  clipIds: z
    .array(z.string().min(1))
    .min(1, "At least one clip ID is required")
    .max(100, "At most 100 clips can be modified in one request"),
  status: z.enum(["pending", "listed", "history"]),
});

export type GetClipsQuery = z.infer<typeof getClipsQuerySchema>;
export type UpdateClipBody = z.infer<typeof updateClipBodySchema>;
export type BulkClipIdsBody = z.infer<typeof bulkClipIdsBodySchema>;
export type PostClipBody = z.infer<typeof postClipBodySchema>;
export type MintClipBody = z.infer<typeof mintClipBodySchema>;
export type CreateClipBody = z.infer<typeof createClipBodySchema>;
export type BulkUpdateTagsBody = z.infer<typeof bulkUpdateTagsBodySchema>;
export type BulkUpdateStatusBody = z.infer<typeof bulkUpdateStatusBodySchema>;
