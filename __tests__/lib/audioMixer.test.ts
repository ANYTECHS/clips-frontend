import {
  calculateNormalizationGain,
  audioBufferToWavBlob,
  mixAudioTracks,
} from "@/app/lib/audioMixer";

describe("AudioMixer library", () => {
  describe("calculateNormalizationGain", () => {
    it("should calculate correct multiplier for quiet audio", () => {
      // Audio with peak of 0.25 (linear) -> target 0.98 => 0.98 / 0.25 = ~3.92
      const channelData = new Float32Array([0.05, 0.1, 0.25, -0.2, 0.0]);
      const gain = calculateNormalizationGain(channelData, 0.98);
      expect(gain).toBeCloseTo(3.92, 1);
    });

    it("should clamp gain to maximum 4.0x on near-silent audio", () => {
      const channelData = new Float32Array([0.001, -0.001]);
      const gain = calculateNormalizationGain(channelData, 0.98);
      expect(gain).toBe(4.0);
    });

    it("should return 1.0 on completely silent buffer", () => {
      const channelData = new Float32Array([0, 0, 0]);
      const gain = calculateNormalizationGain(channelData, 0.98);
      expect(gain).toBe(1.0);
    });

    it("should attenuate loud audio with peaks near 1.0", () => {
      const channelData = new Float32Array([1.5, -1.2, 0.5]);
      const gain = calculateNormalizationGain(channelData, 0.98);
      expect(gain).toBeCloseTo(0.65, 1);
    });
  });

  describe("audioBufferToWavBlob", () => {
    it("should produce a valid WAV blob with RIFF header", () => {
      const mockBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 100,
        getChannelData: () => new Float32Array(100),
      } as unknown as AudioBuffer;

      const blob = audioBufferToWavBlob(mockBuffer);
      expect(blob).toBeDefined();
      expect(blob.type).toBe("audio/wav");
      // 44 bytes header + 100 samples * 2 bytes = 244 bytes
      expect(blob.size).toBe(244);
    });
  });

  describe("mixAudioTracks", () => {
    it("should return a mixed WAV blob without crashing", async () => {
      const mockBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 100,
        getChannelData: () => new Float32Array(100),
      } as unknown as AudioBuffer;

      const blob = await mixAudioTracks({
        voiceoverBuffer: mockBuffer,
        videoDuration: 10,
        offsetSeconds: 2,
        trimStart: 0,
        trimEnd: 2,
        gain: 1.0,
      });

      expect(blob).toBeDefined();
      expect(blob.type).toBe("audio/wav");
    });
  });
});
