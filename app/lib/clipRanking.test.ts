import {
  DEFAULT_RANKING_WEIGHTS,
  RANKING_CRITERIA,
  normalizeDuration,
  normalizePercent,
  parseDurationSeconds,
  rankClips,
  resolveRankingWeights,
  type RankableClip,
} from "./clipRanking";
import { RANKING_WEIGHT_PRESETS } from "./userPreferences";

const clips: RankableClip[] = [
  // Very viral, but far too long and with weak captions.
  { id: "viral", score: 98, durationSeconds: 170, captionQuality: 30, engagement: 40 },
  // Perfect short-form length, middling everything else.
  { id: "short", score: 70, durationSeconds: 30, captionQuality: 50, engagement: 50 },
  // Great captions.
  { id: "captions", score: 65, durationSeconds: 90, captionQuality: 99, engagement: 55 },
  // Highly engaging.
  { id: "engaging", score: 60, durationSeconds: 100, captionQuality: 45, engagement: 99 },
];

describe("clipRanking normalisation", () => {
  it("maps percentages to 0–1 and clamps out-of-range values", () => {
    expect(normalizePercent(0)).toBe(0);
    expect(normalizePercent(50)).toBe(0.5);
    expect(normalizePercent(100)).toBe(1);
    expect(normalizePercent(150)).toBe(1);
    expect(normalizePercent(-10)).toBe(0);
  });

  it("treats missing values as neutral", () => {
    expect(normalizePercent(undefined)).toBe(0.5);
    expect(normalizePercent(null)).toBe(0.5);
    expect(normalizeDuration(undefined)).toBe(0.5);
  });

  it("scores duration by fit to the short-form sweet spot", () => {
    expect(normalizeDuration(30)).toBe(1);
    expect(normalizeDuration(7.5)).toBe(0.5);
    expect(normalizeDuration(120)).toBe(0.5);
    expect(normalizeDuration(600)).toBe(0);
  });

  it("parses display durations", () => {
    expect(parseDurationSeconds("0:45")).toBe(45);
    expect(parseDurationSeconds("1:02:03")).toBe(3723);
    expect(parseDurationSeconds("45s")).toBe(45);
    expect(parseDurationSeconds("abc")).toBeNull();
  });

  it("keeps every component and the rank score within 0–1", () => {
    const { details } = rankClips(clips, { virality: 5, duration: 3, captionQuality: 2, engagement: 9 });
    for (const detail of Object.values(details)) {
      expect(detail.rankScore).toBeGreaterThanOrEqual(0);
      expect(detail.rankScore).toBeLessThanOrEqual(1);
      for (const criterion of RANKING_CRITERIA) {
        expect(detail.components[criterion]).toBeGreaterThanOrEqual(0);
        expect(detail.components[criterion]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("rankClips with different weight configurations", () => {
  it("ranks by virality when only virality is weighted", () => {
    const { rankedIds } = rankClips(clips, { virality: 1, duration: 0, captionQuality: 0, engagement: 0 });
    expect(rankedIds).toEqual(["viral", "short", "captions", "engaging"]);
  });

  it("puts the best-length clip first when duration dominates", () => {
    const { rankedIds } = rankClips(clips, { virality: 0, duration: 1, captionQuality: 0, engagement: 0 });
    expect(rankedIds[0]).toBe("short");
    expect(rankedIds[rankedIds.length - 1]).toBe("viral");
  });

  it("puts the best-captioned clip first when caption quality dominates", () => {
    const { rankedIds } = rankClips(clips, { virality: 0, duration: 0, captionQuality: 1, engagement: 0 });
    expect(rankedIds[0]).toBe("captions");
  });

  it("puts the most engaging clip first when engagement dominates", () => {
    const { rankedIds } = rankClips(clips, { virality: 0, duration: 0, captionQuality: 0, engagement: 1 });
    expect(rankedIds[0]).toBe("engaging");
  });

  it("changes the order when switching presets", () => {
    const viral = rankClips(clips, RANKING_WEIGHT_PRESETS.viral.weights).rankedIds;
    const shortForm = rankClips(clips, RANKING_WEIGHT_PRESETS.shortForm.weights).rankedIds;
    expect(viral[0]).toBe("viral");
    expect(shortForm[0]).toBe("short");
  });

  it("is scale-invariant: multiplying all weights doesn't change the ranking", () => {
    const base = rankClips(clips, DEFAULT_RANKING_WEIGHTS);
    const scaled = rankClips(clips, {
      virality: DEFAULT_RANKING_WEIGHTS.virality * 10,
      duration: DEFAULT_RANKING_WEIGHTS.duration * 10,
      captionQuality: DEFAULT_RANKING_WEIGHTS.captionQuality * 10,
      engagement: DEFAULT_RANKING_WEIGHTS.engagement * 10,
    });
    expect(scaled.rankedIds).toEqual(base.rankedIds);
    expect(scaled.details.short.rankScore).toBeCloseTo(base.details.short.rankScore);
  });

  it("falls back to virality when every weight is zero", () => {
    const { rankedIds } = rankClips(clips, { virality: 0, duration: 0, captionQuality: 0, engagement: 0 });
    expect(rankedIds).toEqual(["viral", "short", "captions", "engaging"]);
  });

  it("uses default weights for missing or invalid values", () => {
    expect(resolveRankingWeights(undefined)).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(resolveRankingWeights({ virality: -1, duration: Number.NaN })).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(resolveRankingWeights({ engagement: 0.9 }).engagement).toBe(0.9);
  });

  it("recommends only clips at or above the threshold, in rank order", () => {
    const { recommendedIds } = rankClips(
      clips,
      { virality: 0, duration: 1, captionQuality: 0, engagement: 0 },
      65
    );
    expect(recommendedIds).toEqual(["short", "captions", "viral"]);
  });

  it("reports contributions that sum to the rank score", () => {
    const { details } = rankClips(clips, DEFAULT_RANKING_WEIGHTS);
    const detail = details.captions;
    const sum = RANKING_CRITERIA.reduce((total, c) => total + detail.contributions[c], 0);
    expect(sum).toBeCloseTo(detail.rankScore);
    expect(detail.rank).toBeGreaterThanOrEqual(1);
  });
});
