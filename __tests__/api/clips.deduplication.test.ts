import { clipFingerprint, type Clip } from "@/app/api/clips/clipsStore";

const baseClip: Clip = {
  id: "clip-1",
  userId: "user-1",
  title: "Same Moment",
  thumbnail: "/thumb.png",
  score: 90,
  scoreKey: "high",
  duration: "00:30",
  style: "Bold",
  status: "pending",
  resolution: "1080x1920",
  videoUrl: "https://example.com/video.mp4",
  createdAt: "2026-09-24T00:00:00.000Z",
};

describe("clip deduplication fingerprint", () => {
  it("matches clips with identical generation output", () => {
    expect(clipFingerprint(baseClip)).toBe(
      clipFingerprint({
        ...baseClip,
        id: "clip-2",
        title: "  same   moment  ",
      }),
    );
  });

  it("changes when source output differs", () => {
    expect(clipFingerprint(baseClip)).not.toBe(
      clipFingerprint({
        ...baseClip,
        id: "clip-3",
        duration: "00:31",
      }),
    );
  });
});
