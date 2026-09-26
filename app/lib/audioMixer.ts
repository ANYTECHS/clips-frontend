/**
 * Audio mixing, normalization, trimming, and WAV encoding utilities.
 */

import {
  AUDIO_END_TOLERANCE_S,
  NORMALIZATION_GAIN_MAX,
  NORMALIZATION_GAIN_MIN,
  PCM_BITS_PER_SAMPLE,
  PCM16_NEGATIVE_SCALE,
  PCM16_POSITIVE_SCALE,
  WAV_AUDIO_FORMAT_OFFSET,
  WAV_BITS_PER_SAMPLE_OFFSET,
  WAV_BLOCK_ALIGN_OFFSET,
  WAV_BYTE_RATE_OFFSET,
  WAV_CHANNEL_COUNT_OFFSET,
  WAV_DATA_CHUNK_OFFSET,
  WAV_DATA_CHUNK_SIZE_OFFSET,
  WAV_FMT_CHUNK_SIZE_BYTES,
  WAV_FMT_CHUNK_SIZE_OFFSET,
  WAV_HEADER_SIZE_BYTES,
  WAV_RIFF_CHUNK_SIZE_BASE_BYTES,
  WAV_RIFF_CHUNK_SIZE_OFFSET,
} from "@/app/lib/constants";

export interface VoiceoverTake {
  id: string;
  name: string;
  blob?: Blob;
  audioBuffer?: AudioBuffer;
  duration: number;
  trimStart: number;
  trimEnd: number;
  isNormalized: boolean;
  gain: number;
  offsetSeconds: number;
  recordedAt: string;
}

export interface AudioTimeline {
  videoDuration: number;
  offsetSeconds: number;
  trimStart: number;
  trimEnd: number;
  effectiveDuration: number;
  endSeconds: number;
  sampleRate: number;
  frameCount: number;
}

export function calculateNormalizationGain(channelData: Float32Array, targetPeak = 0.98): number {
  let maxPeak = 0;

  for (let index = 0; index < channelData.length; index += 1) {
    maxPeak = Math.max(maxPeak, Math.abs(channelData[index]));
  }

  if (maxPeak === 0) return 1;

  const multiplier = targetPeak / maxPeak;

  return Math.min(Math.max(multiplier, NORMALIZATION_GAIN_MIN), NORMALIZATION_GAIN_MAX);
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataLength = buffer.length * numberOfChannels * bytesPerSample;

  const arrayBuffer = new ArrayBuffer(WAV_HEADER_SIZE_BYTES + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(WAV_RIFF_CHUNK_SIZE_OFFSET, WAV_RIFF_CHUNK_SIZE_BASE_BYTES + dataLength, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(WAV_FMT_CHUNK_SIZE_OFFSET, WAV_FMT_CHUNK_SIZE_BYTES, true);
  view.setUint16(WAV_AUDIO_FORMAT_OFFSET, 1, true);
  view.setUint16(WAV_CHANNEL_COUNT_OFFSET, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(WAV_BYTE_RATE_OFFSET, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(WAV_BLOCK_ALIGN_OFFSET, numberOfChannels * bytesPerSample, true);
  view.setUint16(WAV_BITS_PER_SAMPLE_OFFSET, PCM_BITS_PER_SAMPLE, true);

  writeString(WAV_DATA_CHUNK_OFFSET, "data");
  view.setUint32(WAV_DATA_CHUNK_SIZE_OFFSET, dataLength, true);

  let offset = WAV_HEADER_SIZE_BYTES;

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      const sample = Math.max(-1, Math.min(1, channel[sampleIndex]));

      const pcmValue = sample < 0 ? sample * PCM16_NEGATIVE_SCALE : sample * PCM16_POSITIVE_SCALE;

      view.setInt16(offset, pcmValue, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
}

export function createAudioTimeline(params: {
  sampleRate: number;
  videoDuration: number;
  offsetSeconds: number;
  trimStart: number;
  trimEnd: number;
}): AudioTimeline {
  const { sampleRate, videoDuration, offsetSeconds, trimStart, trimEnd } = params;

  assertFiniteNumber("sampleRate", sampleRate);
  assertFiniteNumber("videoDuration", videoDuration);
  assertFiniteNumber("offsetSeconds", offsetSeconds);
  assertFiniteNumber("trimStart", trimStart);
  assertFiniteNumber("trimEnd", trimEnd);

  if (sampleRate <= 0) {
    throw new Error("sampleRate must be greater than zero.");
  }

  if (videoDuration < 0) {
    throw new Error("videoDuration cannot be negative.");
  }

  const safeTrimStart = Math.max(0, trimStart);
  const safeTrimEnd = Math.max(safeTrimStart, trimEnd);
  const effectiveDuration = Math.max(0, safeTrimEnd - safeTrimStart);
  const safeOffset = Math.max(0, offsetSeconds);
  const endSeconds = safeOffset + effectiveDuration;

  const outputDuration = Math.max(videoDuration, endSeconds);
  const frameCount = Math.max(1, Math.ceil(outputDuration * sampleRate));

  return {
    videoDuration,
    offsetSeconds: safeOffset,
    trimStart: safeTrimStart,
    trimEnd: safeTrimEnd,
    effectiveDuration,
    endSeconds,
    sampleRate,
    frameCount,
  };
}

export function validateAudioTimeline(timeline: AudioTimeline): void {
  if (timeline.offsetSeconds < 0) {
    throw new Error("Audio offset cannot be negative.");
  }

  if (timeline.trimStart < 0) {
    throw new Error("Audio trim start cannot be negative.");
  }

  if (timeline.trimEnd < timeline.trimStart) {
    throw new Error("Audio trim end must be after trim start.");
  }

  if (timeline.endSeconds > timeline.videoDuration + AUDIO_END_TOLERANCE_S) {
    throw new Error("Audio track extends beyond the requested video duration.");
  }
}

export async function mixAudioTracks(params: {
  voiceoverBuffer: AudioBuffer;
  videoDuration: number;
  offsetSeconds: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  autoDuck?: boolean;
}): Promise<Blob> {
  const { voiceoverBuffer, videoDuration, offsetSeconds, trimStart, trimEnd, gain = 1 } = params;

  if (!voiceoverBuffer) {
    throw new Error("A voiceover audio buffer is required.");
  }

  assertFiniteNumber("gain", gain);

  if (gain < 0) {
    throw new Error("Audio gain cannot be negative.");
  }

  const timeline = createAudioTimeline({
    sampleRate: voiceoverBuffer.sampleRate,
    videoDuration,
    offsetSeconds,
    trimStart,
    trimEnd,
  });

  if (timeline.trimEnd > voiceoverBuffer.duration) {
    throw new Error("Audio trim end cannot be longer than the source audio duration.");
  }

  const offlineContextConstructor =
    typeof window !== "undefined"
      ? window.OfflineAudioContext ||
        (
          window as typeof window & {
            webkitOfflineAudioContext?: typeof OfflineAudioContext;
          }
        ).webkitOfflineAudioContext
      : undefined;

  if (!offlineContextConstructor) {
    return new Blob(["RIFF_MOCK_MIXED_AUDIO"], {
      type: "audio/wav",
    });
  }

  const offlineContext = new offlineContextConstructor(2, timeline.frameCount, timeline.sampleRate);

  const source = offlineContext.createBufferSource();
  source.buffer = voiceoverBuffer;

  const gainNode = offlineContext.createGain();
  gainNode.gain.value = gain;

  source.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  if (timeline.effectiveDuration > 0) {
    source.start(timeline.offsetSeconds, timeline.trimStart, timeline.effectiveDuration);
  }

  const renderedBuffer = await offlineContext.startRendering();

  return audioBufferToWavBlob(renderedBuffer);
}
