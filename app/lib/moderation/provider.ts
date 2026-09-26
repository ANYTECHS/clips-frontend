import "server-only";

/**
 * Automated moderation provider (Issue #1063).
 *
 * # Why an interface rather than a direct SDK call
 *
 * Moderation vendors get swapped — on price, on coverage, on a policy team
 * deciding the false-positive rate is wrong. Everything downstream (the
 * decision records, the review queue, the appeal flow) is vendor-independent,
 * so the vendor is confined to this file.
 *
 * # Why there is a fallback
 *
 * With no provider configured the check still has to return something, and the
 * only safe something is `flagged` — "a human must look" — not `approved`.
 * A missing API key must never become an implicit publish approval, which is
 * what returning `approved` on a misconfiguration would do.
 *
 * # Thresholds
 *
 * Two, not one. Above `REJECT_THRESHOLD` the content is refused outright;
 * between `FLAG_THRESHOLD` and that it goes to a human. A single threshold
 * forces a choice between over-refusing creators and under-catching violations,
 * and the band between the two is exactly where human review earns its cost.
 */

import type { CategoryScores, ModerationCategory, ModerationStatus } from "./types";
import { MODERATION_CATEGORIES } from "./types";
import { logger } from "@/app/lib/logger";

/** At or above this on any category, content is refused. */
export const REJECT_THRESHOLD = 0.9;
/** At or above this on any category, a human reviews it. */
export const FLAG_THRESHOLD = 0.4;

export interface ModerationCheckInput {
  contentId: string;
  contentType: string;
  /** Title, description, captions — whatever text accompanies the clip. */
  text?: string;
  /** Publicly reachable media URL for providers that inspect frames. */
  mediaUrl?: string;
}

export interface ModerationCheckResult {
  status: ModerationStatus;
  categories: CategoryScores;
  /** Highest category score, the one that drove the decision. */
  score: number;
  provider: string;
  reason: string | null;
}

/** Map category scores onto a decision using the two thresholds. */
export function classify(categories: CategoryScores): {
  status: ModerationStatus;
  score: number;
  reason: string | null;
} {
  const entries = Object.entries(categories) as [ModerationCategory, number][];
  if (entries.length === 0) {
    return { status: "approved", score: 0, reason: null };
  }

  const [topCategory, topScore] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));

  if (topScore >= REJECT_THRESHOLD) {
    return {
      status: "rejected",
      score: topScore,
      reason: `Automated check scored ${topCategory} at ${topScore.toFixed(2)}`,
    };
  }

  if (topScore >= FLAG_THRESHOLD) {
    return {
      status: "flagged",
      score: topScore,
      reason: `Automated check was uncertain about ${topCategory} (${topScore.toFixed(2)})`,
    };
  }

  return { status: "approved", score: topScore, reason: null };
}

interface RemoteCategoryResponse {
  categories?: Record<string, number>;
  category_scores?: Record<string, number>;
}

/** Keep only the categories the platform has a policy for. */
function normaliseCategories(raw: Record<string, number> | undefined): CategoryScores {
  if (!raw) return {};

  const known = new Set<string>(MODERATION_CATEGORIES);
  const result: CategoryScores = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) || typeof value !== "number") continue;
    // Providers occasionally return out-of-range values; clamp rather than
    // letting a 1.4 silently clear the reject threshold for everything.
    result[key as ModerationCategory] = Math.min(Math.max(value, 0), 1);
  }

  return result;
}

/**
 * Call the configured provider.
 *
 * Any failure — unset config, non-2xx, timeout, malformed body — resolves to
 * `flagged` rather than throwing. A moderation outage must degrade to human
 * review, not to blocking every upload and not to waving them through.
 */
export async function runModerationCheck(
  input: ModerationCheckInput,
): Promise<ModerationCheckResult> {
  const endpoint = process.env.MODERATION_API_URL;
  const apiKey = process.env.MODERATION_API_KEY;
  const providerName = process.env.MODERATION_PROVIDER ?? "unconfigured";

  if (!endpoint || !apiKey) {
    logger.warn(
      "[moderation] MODERATION_API_URL/MODERATION_API_KEY unset — routing to human review",
    );
    return {
      status: "flagged",
      categories: {},
      score: 0,
      provider: providerName,
      reason: "No moderation provider configured; queued for manual review",
    };
  }

  // A moderation call sits in the publish path, so it gets a hard ceiling
  // rather than inheriting the platform default.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        content_id: input.contentId,
        content_type: input.contentType,
        text: input.text,
        media_url: input.mediaUrl,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error(`[moderation] provider returned ${response.status}`);
      return {
        status: "flagged",
        categories: {},
        score: 0,
        provider: providerName,
        reason: `Provider error (${response.status}); queued for manual review`,
      };
    }

    const body = (await response.json()) as RemoteCategoryResponse;
    const categories = normaliseCategories(body.category_scores ?? body.categories);
    const { status, score, reason } = classify(categories);

    return { status, categories, score, provider: providerName, reason };
  } catch (error) {
    logger.error("[moderation] provider call failed", error);
    return {
      status: "flagged",
      categories: {},
      score: 0,
      provider: providerName,
      reason: "Provider unreachable; queued for manual review",
    };
  } finally {
    clearTimeout(timeout);
  }
}
