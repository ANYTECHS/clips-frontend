"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Download,
  Scissors,
  Volume2,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  Layers,
  Sliders,
  Music,
} from "lucide-react";
import {
  type VoiceoverTake,
  calculateNormalizationGain,
  audioBufferToWavBlob,
  mixAudioTracks,
} from "@/app/lib/audioMixer";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { sanitize } from "@/app/lib/sanitize";

export interface VoiceoverRecorderProps {
  videoUrl?: string;
  videoDuration?: number; // in seconds
  onSaveVoiceover?: (take: VoiceoverTake) => void;
  onExportMix?: (mixedBlob: Blob) => void;
}

export default function VoiceoverRecorder({
  videoUrl,
  videoDuration = 30,
  onSaveVoiceover,
  onExportMix,
}: VoiceoverRecorderProps) {
  const { t } = useI18n();

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Audio & Hardware Devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // MediaRecorder & Web Audio references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Multiple Takes
  const [takes, setTakes] = useState<VoiceoverTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);

  // Take Preview Playback State
  const [isPlayingTake, setIsPlayingTake] = useState(false);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Timeline Sync & Mixing State
  const [timelineOffset, setTimelineOffset] = useState<number>(0);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [isExportingMix, setIsExportingMix] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Active Take Reference
  const activeTake = useMemo(
    () => takes.find((t) => t.id === activeTakeId) || takes[takes.length - 1],
    [takes, activeTakeId]
  );

  // Enumerate input audio devices
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const inputs = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(inputs);
          if (inputs[0] && !selectedDeviceId) {
            setSelectedDeviceId(inputs[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, [selectedDeviceId]);

  // Real-time canvas waveform visualizer
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isRecording ? "#00E68A" : "#71717A";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording, drawWaveform]);

  // Start Recording
  const startRecording = async () => {
    setPermissionError(null);
    recordedChunksRef.current = [];
    setRecordingTime(0);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await audioBlob.arrayBuffer();

        try {
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWavBlob(decoded);
          const takeNumber = takes.length + 1;

          const newTake: VoiceoverTake = {
            id: `take-${Date.now()}`,
            name: `Take ${takeNumber}`,
            blob: wavBlob,
            audioBuffer: decoded,
            duration: parseFloat(decoded.duration.toFixed(2)),
            trimStart: 0,
            trimEnd: parseFloat(decoded.duration.toFixed(2)),
            isNormalized: false,
            gain: 1.0,
            offsetSeconds: timelineOffset,
            recordedAt: new Date().toISOString(),
          };

          setTakes((prev) => [...prev, newTake]);
          setActiveTakeId(newTake.id);
          if (onSaveVoiceover) onSaveVoiceover(newTake);
        } catch {
          // Fallback if decoding fails
          const takeNumber = takes.length + 1;
          const fallbackTake: VoiceoverTake = {
            id: `take-${Date.now()}`,
            name: `Take ${takeNumber}`,
            blob: audioBlob,
            duration: recordingTime,
            trimStart: 0,
            trimEnd: recordingTime,
            isNormalized: false,
            gain: 1.0,
            offsetSeconds: timelineOffset,
            recordedAt: new Date().toISOString(),
          };
          setTakes((prev) => [...prev, fallbackTake]);
          setActiveTakeId(fallbackTake.id);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      setPermissionError(t("voiceover.permission_denied"));
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  // Basic Audio Editing: Normalize Active Take
  const handleNormalizeActiveTake = () => {
    if (!activeTake || !activeTake.audioBuffer) return;

    const channelData = activeTake.audioBuffer.getChannelData(0);
    const calculatedGain = calculateNormalizationGain(channelData, 0.98);

    setTakes((prev) =>
      prev.map((take) =>
        take.id === activeTake.id
          ? {
              ...take,
              isNormalized: true,
              gain: calculatedGain,
            }
          : take
      )
    );
  };

  // Basic Audio Editing: Trim Slider updates
  const handleUpdateTrim = (start: number, end: number) => {
    if (!activeTake) return;
    setTakes((prev) =>
      prev.map((take) =>
        take.id === activeTake.id
          ? {
              ...take,
              trimStart: Math.max(0, start),
              trimEnd: Math.min(take.duration, end),
            }
          : take
      )
    );
  };

  // Preview Active Take Playback
  const handleTogglePlayTake = () => {
    if (!activeTake?.blob) return;

    if (isPlayingTake && activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      setIsPlayingTake(false);
      return;
    }

    const audioUrl = URL.createObjectURL(activeTake.blob);
    const audio = new Audio(audioUrl);
    activeAudioElementRef.current = audio;
    audio.currentTime = activeTake.trimStart;

    audio.ontimeupdate = () => {
      if (audio.currentTime >= activeTake.trimEnd) {
        audio.pause();
        setIsPlayingTake(false);
      }
    };

    audio.onended = () => setIsPlayingTake(false);
    audio.play();
    setIsPlayingTake(true);
  };

  // Download Standalone Voiceover Take (WAV)
  const handleDownloadTake = () => {
    if (!activeTake?.blob) return;
    const url = URL.createObjectURL(activeTake.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTake.name.toLowerCase().replace(/\s+/g, "-")}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export with Mixed Audio
  const handleExportMixedAudio = async () => {
    if (!activeTake?.audioBuffer) return;
    setIsExportingMix(true);
    setExportComplete(false);

    try {
      const mixedBlob = await mixAudioTracks({
        voiceoverBuffer: activeTake.audioBuffer,
        videoDuration,
        offsetSeconds: timelineOffset,
        trimStart: activeTake.trimStart,
        trimEnd: activeTake.trimEnd,
        gain: activeTake.gain,
        autoDuck: autoDucking,
      });

      if (onExportMix) {
        onExportMix(mixedBlob);
      }

      // Trigger client download of mixed WAV
      const url = URL.createObjectURL(mixedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip-voiceover-mix-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch {
      // Error handling
    } finally {
      setIsExportingMix(false);
    }
  };

  // Delete a take
  const handleDeleteTake = (takeId: string) => {
    const filtered = takes.filter((t) => t.id !== takeId);
    setTakes(filtered);
    if (activeTakeId === takeId) {
      setActiveTakeId(filtered[0]?.id || null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#121316] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {t("voiceover.title")}
            </h2>
            <p className="text-xs text-zinc-400">
              {t("voiceover.subtitle")}
            </p>
          </div>
        </div>

        {/* Input Microphone Device Selector */}
        {audioDevices.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-zinc-400 font-medium">Mic:</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand max-w-xs truncate"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-[#18191c]">
                  {d.label || `Microphone ${d.deviceId.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {permissionError && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Recording Stage & Live Waveform Canvas */}
      <div className="p-6 rounded-2xl bg-[#121316] border border-white/10 flex flex-col items-center justify-center space-y-4">
        {/* Real-time Oscillating Waveform Visualizer */}
        <div className="w-full max-w-xl h-24 rounded-xl bg-[#0b0c0e] border border-white/5 overflow-hidden flex items-center justify-center relative shadow-inner">
          <canvas
            ref={canvasRef}
            width={600}
            height={96}
            className="w-full h-full"
            aria-label={t("voiceover.waveform")}
          />
          {!isRecording && takes.length === 0 && (
            <span className="absolute text-xs text-zinc-500 font-mono">
              Ready to record voiceover
            </span>
          )}
        </div>

        {/* Recording Controls & Timer */}
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm font-bold text-white px-3 py-1 rounded-lg bg-white/5 border border-white/10">
            {Math.floor(recordingTime / 60)
              .toString()
              .padStart(2, "0")}
            :
            {(recordingTime % 60).toString().padStart(2, "0")}
          </span>

          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              aria-label={t("voiceover.record")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00E68A] text-black font-bold text-xs hover:brightness-95 transition shadow-[0_4px_16px_rgba(0,230,138,0.3)] active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>{t("voiceover.record")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              aria-label={t("voiceover.stop")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition shadow-[0_4px_16px_rgba(244,63,94,0.3)] animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{t("voiceover.stop")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Multiple Recording Takes Section */}
      {takes.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#121316] border border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" />
              {t("voiceover.takes")} ({takes.length})
            </h3>
            <span className="text-xs text-zinc-400">
              Select a take to edit and sync with video
            </span>
          </div>

          {/* Takes list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {takes.map((take) => {
              const isActive = take.id === activeTake?.id;
              return (
                <div
                  key={take.id}
                  onClick={() => setActiveTakeId(take.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? "bg-brand/10 border-brand text-brand ring-1 ring-brand/30"
                      : "bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {sanitize(take.name)}
                    </span>
                    {isActive && (
                      <span className="rounded bg-brand text-black font-extrabold text-[9px] px-1.5 py-0.5 uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-400">
                    <span>{take.duration}s</span>
                    <span>{take.isNormalized ? "Normalized" : "Raw"}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTake(take.id);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition"
                      aria-label="Delete take"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Take Editing Controls */}
          {activeTake && (
            <div className="pt-4 border-t border-white/10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlayTake}
                    aria-label={isPlayingTake ? "Pause preview" : "Play preview"}
                    className="p-2.5 rounded-xl bg-brand text-black font-bold hover:brightness-95 transition"
                  >
                    {isPlayingTake ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {sanitize(activeTake.name)} Preview
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Trimmed: {activeTake.trimStart}s - {activeTake.trimEnd}s
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Normalize Audio Button */}
                  <button
                    type="button"
                    onClick={handleNormalizeActiveTake}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      activeTake.isNormalized
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand" />
                    <span>
                      {activeTake.isNormalized
                        ? t("voiceover.normalized_success")
                        : t("voiceover.normalize")}
                    </span>
                  </button>

                  {/* Download Standalone WAV */}
                  <button
                    type="button"
                    onClick={handleDownloadTake}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("voiceover.download_audio")}</span>
                  </button>
                </div>
              </div>

              {/* Trim Audio Sliders */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-brand" />
                    {t("voiceover.trim")}
                  </span>
                  <span className="font-mono text-zinc-400">
                    Duration: {(activeTake.trimEnd - activeTake.trimStart).toFixed(1)}s
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      {t("voiceover.trim_start")}: {activeTake.trimStart}s
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={activeTake.trimEnd - 0.5}
                      step={0.1}
                      value={activeTake.trimStart}
                      onChange={(e) =>
                        handleUpdateTrim(parseFloat(e.target.value), activeTake.trimEnd)
                      }
                      className="w-full accent-brand h-1.5 bg-white/10 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      {t("voiceover.trim_end")}: {activeTake.trimEnd}s
                    </label>
                    <input
                      type="range"
                      min={activeTake.trimStart + 0.5}
                      max={activeTake.duration}
                      step={0.1}
                      value={activeTake.trimEnd}
                      onChange={(e) =>
                        handleUpdateTrim(activeTake.trimStart, parseFloat(e.target.value))
                      }
                      className="w-full accent-brand h-1.5 bg-white/10 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Timeline Sync & Ducking Controls */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    {t("voiceover.sync_timeline")}
                  </span>
                  <span className="font-mono text-brand">
                    Starts at: {timelineOffset.toFixed(1)}s
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(1, videoDuration - 1)}
                  step={0.5}
                  value={timelineOffset}
                  onChange={(e) => setTimelineOffset(parseFloat(e.target.value))}
                  className="w-full accent-brand h-1.5 bg-white/10 rounded cursor-pointer"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-zinc-300">
                    {t("voiceover.auto_ducking")}
                  </span>
                  <input
                    type="checkbox"
                    checked={autoDucking}
                    onChange={(e) => setAutoDucking(e.target.checked)}
                    className="w-4 h-4 accent-brand rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Export Mixed Audio Button Bar */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-zinc-400">
                  Ready to mix voiceover with video background audio
                </div>

                <div className="flex items-center gap-3">
                  {exportComplete && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {t("voiceover.mix_complete")}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleExportMixedAudio}
                    disabled={isExportingMix}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#00E68A] hover:brightness-95 transition disabled:opacity-50 shadow-[0_4px_16px_rgba(0,230,138,0.3)]"
                  >
                    <Music className="w-4 h-4" />
                    <span>
                      {isExportingMix
                        ? t("voiceover.mix_exporting")
                        : t("voiceover.export_mix")}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
