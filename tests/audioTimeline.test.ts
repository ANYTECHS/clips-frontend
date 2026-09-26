import {
  createAudioTimeline,
  validateAudioTimeline,
} from "@/app/lib/audioMixer";

describe("audio timeline synchronization", () => {
  it("keeps the offset and trim values in seconds", () => {
    const timeline = createAudioTimeline({
      sampleRate: 48_000,
      videoDuration: 60,
      offsetSeconds: 5,
      trimStart: 2,
      trimEnd: 12,
    });

    expect(timeline.offsetSeconds).toBe(5);
    expect(timeline.trimStart).toBe(2);
    expect(timeline.trimEnd).toBe(12);
    expect(timeline.effectiveDuration).toBe(10);
    expect(timeline.endSeconds).toBe(15);
    expect(timeline.frameCount).toBe(2_880_000);
  });

  it("clamps negative offsets and trim starts", () => {
    const timeline = createAudioTimeline({
      sampleRate: 44_100,
      videoDuration: 10,
      offsetSeconds: -5,
      trimStart: -2,
      trimEnd: 3,
    });

    expect(timeline.offsetSeconds).toBe(0);
    expect(timeline.trimStart).toBe(0);
    expect(timeline.trimEnd).toBe(3);
  });

  it("rejects an invalid timeline", () => {
    expect(() =>
      validateAudioTimeline({
        videoDuration: 10,
        offsetSeconds: 11,
        trimStart: 0,
        trimEnd: 2,
        effectiveDuration: 2,
        endSeconds: 13,
        sampleRate: 48_000,
        frameCount: 624_000,
      }),
    ).toThrow("extends beyond");
  });
});
