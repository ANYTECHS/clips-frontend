/**
 * Shared Clip type used across API routes, the vault, and the clips grid.
 * Transformations are stored as a sub-array so a single clip can have
 * multiple AI-style variants without replacing the original.
 */

export interface ClipTransformation {
  /** The style ID from /api/transform/styles (e.g. "anime", "neon-noir") */
  style: string;
  /** Human-readable style label (e.g. "Neon Noir") */
  styleLabel: string;
  /** Publicly accessible URL of the transformed clip (MP4) */
  resultUrl: string;
  /** Background processing job ID (used for polling status) */
  jobId: string;
  /** ISO-8601 timestamp */
  createdAt: string;
}

export type ClipRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ClipStatus = "ready_to_mint" | "queue" | "minted";

export interface Clip {
  id: string;
  title: string;
  /** URL of the cover thumbnail */
  thumbnail: string;
  /** URL of the original source video (MP4) */
  videoUrl?: string;
  /** Formatted duration string, e.g. "1:23" */
  duration?: string;
  /** AI quality score 0-100 */
  aiScore?: number;
  floorPrice?: number;
  currentValue?: number;
  status: ClipStatus;
  rarity?: ClipRarity;
  mintedDate?: string;
  listedDate?: string;
  queuePosition?: number;
  /** All AI transformations applied to this clip. Empty array = original only. */
  transformations: ClipTransformation[];
}
