import {
  calculateWeightedScore,
  generateComparisonCSV,
  generateComparisonMarkdown,
  generateComparisonJSON,
} from "@/app/lib/comparisonReport";
import type { Clip } from "@/components/projects/ClipGrid";

describe("comparisonReport utils", () => {
  const mockClips: Clip[] = [
    {
      id: "clip-1",
      title: "Hook Mastery Clip",
      thumbnail: "/thumb1.jpg",
      score: 85,
      scoreKey: "high",
      duration: "0:30",
      style: "Anime",
      status: "ready",
      resolution: "1080x1920",
      videoUrl: "/video1.mp4",
    },
    {
      id: "clip-2",
      title: "Pacing Expert Clip",
      thumbnail: "/thumb2.jpg",
      score: 75,
      scoreKey: "medium",
      duration: "0:45",
      style: "Cinematic",
      status: "ready",
      resolution: "1080x1920",
      videoUrl: "/video2.mp4",
    },
  ];

  const mockEvaluations = {
    "clip-1": {
      clipId: "clip-1",
      rating: 5,
      hookScore: 10,
      visualScore: 8,
      pacingScore: 8,
      isWinner: true,
      notes: "Exceptional hook, keeps audience locked in.",
    },
    "clip-2": {
      clipId: "clip-2",
      rating: 3,
      hookScore: 6,
      visualScore: 7,
      pacingScore: 7,
      isWinner: false,
      notes: "Average start, strong ending.",
    },
  };

  describe("calculateWeightedScore", () => {
    it("should return base score when no evaluation provided", () => {
      expect(calculateWeightedScore(85, undefined)).toBe(85);
    });

    it("should calculate correct weighted score from user evaluation", () => {
      // 35% hook(10) = 35, 25% visual(8) = 20, 20% pacing(8) = 16, 20% rating(5) = 20 => total = 91
      const score = calculateWeightedScore(85, mockEvaluations["clip-1"]);
      expect(score).toBe(91);
    });
  });

  describe("generateComparisonCSV", () => {
    it("should generate CSV with header and all clip rows", () => {
      const csv = generateComparisonCSV(mockClips, mockEvaluations);
      expect(csv).toContain("Clip ID,Title,Duration");
      expect(csv).toContain("Hook Mastery Clip");
      expect(csv).toContain("Pacing Expert Clip");
      expect(csv).toContain("YES"); // winner column
      expect(csv).toContain("Exceptional hook");
    });
  });

  describe("generateComparisonMarkdown", () => {
    it("should generate formatted markdown table with winner declaration", () => {
      const md = generateComparisonMarkdown(mockClips, mockEvaluations);
      expect(md).toContain("# Clip Comparison Report");
      expect(md).toContain("Top Pick / Winner:** Hook Mastery Clip");
      expect(md).toContain("| Hook Mastery Clip |");
      expect(md).toContain("⭐ YES");
      expect(md).toContain("Exceptional hook, keeps audience locked in.");
    });
  });

  describe("generateComparisonJSON", () => {
    it("should generate valid JSON string containing metadata and evaluations", () => {
      const jsonStr = generateComparisonJSON(mockClips, mockEvaluations);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.clipCount).toBe(2);
      expect(parsed.winnerClipId).toBe("clip-1");
      expect(parsed.evaluations["clip-1"].rating).toBe(5);
    });
  });
});
