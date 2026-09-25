/**
 * Content moderation domain types (Issue #1063).
 *
 * Kept separate from the provider and the API routes so the client components
 * can import the shapes without pulling in a server-only module.
 */

/** Where a piece of content stands. */
export type ModerationStatus =
  /** Submitted, automated check not finished. */
  | "pending"
  /** Cleared — may publish. */
  | "approved"
  /** Automated check was not confident enough to decide; a human must look. */
  | "flagged"
  /** Refused — may not publish. Appealable. */
  | "rejected";

/** Policy categories the automated provider reports on. */
export type ModerationCategory =
  | "sexual"
  | "violence"
  | "hate"
  | "harassment"
  | "self_harm"
  | "illegal"
  | "spam"
  | "copyright";

export const MODERATION_CATEGORIES: readonly ModerationCategory[] = [
  "sexual",
  "violence",
  "hate",
  "harassment",
  "self_harm",
  "illegal",
  "spam",
  "copyright",
];

/** Human-readable labels, used by the review queue and the appeal form. */
export const CATEGORY_LABELS: Record<ModerationCategory, string> = {
  sexual: "Sexual content",
  violence: "Violence or gore",
  hate: "Hate speech",
  harassment: "Harassment",
  self_harm: "Self-harm",
  illegal: "Illegal activity",
  spam: "Spam or deceptive",
  copyright: "Copyright",
};

/** Per-category confidence, 0–1. Absent categories did not fire. */
export type CategoryScores = Partial<Record<ModerationCategory, number>>;

export interface ModerationDecision {
  id: string;
  contentId: string;
  contentType: string;
  userId: string;
  status: ModerationStatus;
  categories: CategoryScores | null;
  score: number | null;
  source: "automated" | "manual" | "appeal";
  provider: string | null;
  reason: string | null;
  reviewerId: string | null;
  supersedesId: string | null;
  createdAt: string;
}

export interface ModerationAppeal {
  id: string;
  decisionId: string;
  userId: string;
  statement: string;
  status: "open" | "upheld" | "overturned";
  resolution: string | null;
  reviewerId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** What the caller may publish. */
export function canPublish(status: ModerationStatus): boolean {
  return status === "approved";
}

/** Whether a creator may challenge this outcome. */
export function isAppealable(status: ModerationStatus): boolean {
  return status === "rejected" || status === "flagged";
}
