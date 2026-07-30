export type UserPlan = "free" | "pro" | "enterprise";
export type ExportQuality = "720p" | "1080p";

const MAX_EXPORT_QUALITY: Record<UserPlan, ExportQuality> = {
  free: "720p",
  pro: "1080p",
  enterprise: "1080p",
};

const QUALITY_RANK: Record<ExportQuality, number> = {
  "720p": 1,
  "1080p": 2,
};

/**
 * Returns the maximum export quality allowed for a plan.
 */
export function getMaxExportQuality(plan: string): ExportQuality {
  return MAX_EXPORT_QUALITY[plan as UserPlan] ?? "720p";
}

/**
 * Whether the requested quality is allowed for the user's plan.
 */
export function isExportQualityAllowed(plan: string, quality: ExportQuality): boolean {
  const max = getMaxExportQuality(plan);
  return QUALITY_RANK[quality] <= QUALITY_RANK[max];
}
