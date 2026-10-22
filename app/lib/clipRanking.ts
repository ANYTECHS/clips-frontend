/**
 * Configurable clip ranking.
 *
 * Each clip is scored on four criteria, every one normalised to 0–1 before
 * weighting so that no criterion dominates just because of its units:
 *
 * - `virality`        the AI quality score (0–100)
 * - `duration`        fit to the short-form sweet spot (15–60 s scores 1)
 * - `captionQuality`  caption/hook quality (0–100)
 * - `engagement`      predicted engagement, e.g. retention + emotional pull (0–100)
 *
 * The final rank score is the weighted mean of the components, so it is also
 * 0–1 regardless of how large the weights are. Missing inputs score a neutral
 * 0.5 rather than penalising clips the backend hasn't analysed yet.
 *
 * Shared by app/workers/clipRanking.worker.ts and the synchronous fallback in
 * app/hooks/useClipRanking.ts so both always agree.
 */

export interface RankingWeights {
  virality: number;
  duration: number;
  captionQuality: number;
  engagement: number;
}

export type RankingCriterion = keyof RankingWeights;

export const RANKING_CRITERIA: readonly RankingCriterion[] = [
  "virality",
  "duration",
  "captionQuality",
  "engagement",
];

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  virality: 0.4,
  duration: 0.2,
  captionQuality: 0.2,
  engagement: 0.2,
};

export interface RankableClip {
  id: string;
  /** AI virality/quality score, 0–100. Also used for the recommendation threshold. */
  score: number;
  /** Clip length in seconds. */
  durationSeconds?: number | null;
  /** Caption quality, 0–100. */
  captionQuality?: number | null;
  /** Predicted engagement, 0–100. */
  engagement?: number | null;
}

export interface ClipRankingDetails {
  id: string;
  /** 1-based position in the ranked list. */
  rank: number;
  /** Weighted rank score, 0–1. */
  rankScore: number;
  /** Normalised component scores, each 0–1. */
  components: Record<RankingCriterion, number>;
  /** Share of `rankScore` contributed by each component (sums to `rankScore`). */
  contributions: Record<RankingCriterion, number>;
}

export interface ClipRankingResult {
  /** Every clip id, best rank first. */
  rankedIds: string[];
  /** Clips at or above the threshold, best rank first. */
  recommendedIds: string[];
  /** Per-clip breakdown keyed by id, for "Why this rank?" explanations. */
  details: Record<string, ClipRankingDetails>;
}

const NEUTRAL = 0.5;
const IDEAL_MIN_SECONDS = 15;
const IDEAL_MAX_SECONDS = 60;
/** Beyond this length a clip no longer reads as short-form at all. */
const MAX_USEFUL_SECONDS = 180;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Normalise a 0–100 percentage to 0–1, or neutral when unknown. */
export function normalizePercent(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return NEUTRAL;
  return clamp01(value / 100);
}

/** Score how well a clip length fits short-form platforms, 0–1. */
export function normalizeDuration(seconds: number | null | undefined): number {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return NEUTRAL;
  }
  if (seconds < IDEAL_MIN_SECONDS) return clamp01(seconds / IDEAL_MIN_SECONDS);
  if (seconds <= IDEAL_MAX_SECONDS) return 1;
  return clamp01(
    1 - (seconds - IDEAL_MAX_SECONDS) / (MAX_USEFUL_SECONDS - IDEAL_MAX_SECONDS),
  );
}

/**
 * Parse a display duration such as "0:45", "1:02:03", "45s" or "45" into
 * seconds. Returns null when it can't be parsed.
 */
export function parseDurationSeconds(duration: string | number | null | undefined): number | null {
  if (typeof duration === "number") return Number.isFinite(duration) ? duration : null;
  if (!duration) return null;
  const trimmed = duration.trim();

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.some((p) => !Number.isFinite(p))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(trimmed);
  return match ? Number(match[1]) : null;
}

/**
 * Fill missing weights with defaults and drop invalid (negative / non-finite)
 * values, so callers can pass partial or user-edited objects.
 */
export function resolveRankingWeights(weights?: Partial<RankingWeights> | null): RankingWeights {
  const resolved = { ...DEFAULT_RANKING_WEIGHTS };
  for (const criterion of RANKING_CRITERIA) {
    const value = weights?.[criterion];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      resolved[criterion] = value;
    }
  }
  return resolved;
}

/** Normalised 0–1 component scores for one clip. */
export function clipComponents(clip: RankableClip): Record<RankingCriterion, number> {
  return {
    virality: normalizePercent(clip.score),
    duration: normalizeDuration(clip.durationSeconds),
    captionQuality: normalizePercent(clip.captionQuality),
    engagement: normalizePercent(clip.engagement),
  };
}

/**
 * Rank clips by the weighted mean of their normalised components.
 *
 * Ties fall back to the raw score, then to the original order, so the result
 * is stable and deterministic. When every weight is zero the ranking reduces
 * to raw virality, matching the previous score-only behaviour.
 */
export function rankClips(
  clips: RankableClip[],
  weights?: Partial<RankingWeights> | null,
  threshold: number = 0,
): ClipRankingResult {
  const resolved = resolveRankingWeights(weights);
  const totalWeight = RANKING_CRITERIA.reduce((sum, c) => sum + resolved[c], 0);
  const effective: RankingWeights =
    totalWeight > 0 ? resolved : { virality: 1, duration: 0, captionQuality: 0, engagement: 0 };
  const divisor = totalWeight > 0 ? totalWeight : 1;

  const scored = clips.map((clip, index) => {
    const components = clipComponents(clip);
    const contributions = {} as Record<RankingCriterion, number>;
    let rankScore = 0;
    for (const criterion of RANKING_CRITERIA) {
      const contribution = (components[criterion] * effective[criterion]) / divisor;
      contributions[criterion] = contribution;
      rankScore += contribution;
    }
    return { clip, index, components, contributions, rankScore };
  });

  scored.sort(
    (a, b) => b.rankScore - a.rankScore || b.clip.score - a.clip.score || a.index - b.index,
  );

  const details: Record<string, ClipRankingDetails> = {};
  scored.forEach((entry, position) => {
    details[entry.clip.id] = {
      id: entry.clip.id,
      rank: position + 1,
      rankScore: entry.rankScore,
      components: entry.components,
      contributions: entry.contributions,
    };
  });

  const rankedIds = scored.map((entry) => entry.clip.id);
  const recommendedIds = scored
    .filter((entry) => entry.clip.score >= threshold)
    .map((entry) => entry.clip.id);

  return { rankedIds, recommendedIds, details };
}
