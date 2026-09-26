/**
 * Web worker for ranking/filtering clips by score (#921).
 *
 * Scoring a large clip list (filtering by threshold, sorting for "top
 * picks") is the kind of computation that scales with library size and has
 * no reason to run on the main thread, where it competes with rendering and
 * input handling. This worker takes the raw `{ id, score }` pairs and a
 * threshold, and returns the ids that qualify as recommended, sorted
 * highest-score first.
 */

export interface ClipRankingRequest {
  requestId: number;
  clips: { id: string; score: number }[];
  threshold: number;
}

export interface ClipRankingResponse {
  requestId: number;
  recommendedIds: string[];
}

self.onmessage = (event: MessageEvent<ClipRankingRequest>) => {
  const { requestId, clips, threshold } = event.data;

  const recommendedIds = clips
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.id);

  const response: ClipRankingResponse = { requestId, recommendedIds };
  (self as unknown as Worker).postMessage(response);
};

export {};
