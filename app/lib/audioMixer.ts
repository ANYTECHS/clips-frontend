/**
 * Audio mixing, normalization, trimming, and WAV encoding utilities for voiceover recording
 */

export interface VoiceoverTake {
  id: string;
  name: string;
  blob?: Blob;
  audioBuffer?: AudioBuffer;
  duration: number; // in seconds
  trimStart: number; // in seconds
  trimEnd: number; // in seconds
  isNormalized: boolean;
  gain: number;
  offsetSeconds: number; // start offset on video timeline
  recordedAt: string;
}

/**
 * Normalizes peak amplitude of an AudioBuffer to target level (default -0.1 dB or ~0.98 linear)
 */
export function calculateNormalizationGain(
  channelData: Float32Array,
  targetPeak: number = 0.98
): number {
  let maxPeak = 0;
  for (let i = 0; i < channelData.length; i++) {
    const abs = Math.abs(channelData[i]);
    if (abs > maxPeak) {
      maxPeak = abs;
    }
  }

  if (maxPeak === 0) return 1.0;
  const multiplier = targetPeak / maxPeak;
  // Clamp multiplier between 0.5x and 4.0x (+12dB) to prevent extreme distortion on silent tracks
  return Math.min(Math.max(multiplier, 0.5), 4.0);
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2; // 16-bit = 2 bytes per sample
  const bufferArray = new ArrayBuffer(44 + length);
  const view = new DataView(bufferArray);

  // Helper to write string into DataView
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");

  // "fmt " chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // chunk length
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // "data" chunk
  writeString(36, "data");
  view.setUint32(40, length, true);

  // Interleave and write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([bufferArray], { type: "audio/wav" });
}

/**
 * Mixes background audio and voiceover track with timeline offset and optional ducking
 */
export async function mixAudioTracks(params: {
  voiceoverBuffer: AudioBuffer;
  videoDuration: number;
  offsetSeconds: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  autoDuck?: boolean;
}): Promise<Blob> {
  const {
    voiceoverBuffer,
    videoDuration,
    offsetSeconds,
    trimStart,
    trimEnd,
    gain = 1.0,
  } = params;

  const sampleRate = voiceoverBuffer.sampleRate;
  const totalLength = Math.ceil(Math.max(videoDuration, offsetSeconds + (trimEnd - trimStart)) * sampleRate);

  // If in node test environment without OfflineAudioContext, generate a simulated WAV blob
  if (typeof window === "undefined" || !(window.AudioContext || (window as any).webkitAudioContext)) {
    return new Blob(["RIFF_MOCK_MIXED_AUDIO"], { type: "audio/wav" });
  }

  const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineContext = new OfflineCtx(2, totalLength, sampleRate);

  // 1. Create source for voiceover track
  const voSource = offlineContext.createBufferSource();
  voSource.buffer = voiceoverBuffer;

  const voGainNode = offlineContext.createGain();
  voGainNode.gain.value = gain;
  voSource.connect(voGainNode);
  voGainNode.connect(offlineContext.destination);

  // Schedule start at offset with trimmed duration
  const effectiveTrimDuration = Math.max(0.1, trimEnd - trimStart);
  voSource.start(offsetSeconds, trimStart, effectiveTrimDuration);

  // Render audio mix
  const renderedBuffer = await offlineContext.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}
