/**
 * Web worker for ranking/filtering clips by score (#921).
 *
 * Scoring a large clip list (filtering by threshold, sorting for "top
 * picks") is the kind of computation that scales with library size and has
 * no reason to run on the main thread, where it competes with rendering and
 * input handling. This worker takes the clips, a threshold and the creator's
 * ranking `weights` (`{ virality, duration, captionQuality, engagement }`,
 * defaulting to DEFAULT_RANKING_WEIGHTS), normalises every criterion to 0–1,
 * and returns all ids in weighted rank order, the subset that qualifies as
 * recommended, and the per-clip score components.
 */

import {
  rankClips,
  type ClipRankingDetails,
  type RankableClip,
  type RankingWeights,
} from "@/app/lib/clipRanking";

export interface ClipRankingRequest {
  requestId: number;
  clips: RankableClip[];
  threshold: number;
  /** Ranking criteria weights. Missing fields use DEFAULT_RANKING_WEIGHTS. */
  weights?: Partial<RankingWeights>;
}

export interface ClipRankingResponse {
  requestId: number;
  rankedIds: string[];
  recommendedIds: string[];
  details: Record<string, ClipRankingDetails>;
}

self.onmessage = (event: MessageEvent<ClipRankingRequest>) => {
  const { requestId, clips, threshold, weights } = event.data;

  const result = rankClips(clips, weights, threshold);

  const response: ClipRankingResponse = { requestId, ...result };
  (self as unknown as Worker).postMessage(response);
};

export {};
