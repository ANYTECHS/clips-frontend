"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, Crop, Type, MonitorPlay, Smartphone, Loader2, Sparkles } from "lucide-react";
import type { Clip } from "./ClipGrid";
import {
  CAPTION_LANGUAGES,
  DEFAULT_CAPTION_STYLE,
  captionFontFamilies,
  type CaptionSegment,
  type CaptionStyle,
} from "@/app/api/schemas/captions.schema";
import {
  DEFAULT_BLUR_PLACEHOLDER,
  SIZES_EDITOR_PREVIEW,
  SIZES_TRIM_TIMELINE,
} from "@/app/lib/imageUtils";
import { useWillChange } from "@/app/hooks/useWillChange";
import { useAutoSave } from "@/app/hooks/useAutoSave";
import { sanitize } from "@/app/lib/sanitize";

export interface ClipEdits {
  trimStart: number;
  trimEnd: number;
  captionStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  captions?: {
    segments: CaptionSegment[];
    style: CaptionStyle;
    language: string;
    burnIntoExport: boolean;
  };
}

export interface ClipEditorModalProps {
  clip: Clip;
  onClose: () => void;
  onSave: (id: string, edits: ClipEdits) => void;
}

const CAPTION_STYLES = ["Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];

const FONT_STYLES: { id: CaptionStyle["fontStyle"]; label: string }[] = [
  { id: "bold", label: "Bold" },
  { id: "rounded", label: "Rounded" },
  { id: "shadow", label: "Shadow" },
  { id: "gradient", label: "Gradient" },
];

const POSITIONS: { id: CaptionStyle["position"]; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];

function getSegmentTimingError(segments: CaptionSegment[]): string | null {
  const seen = new Set<string>();
  let previous: CaptionSegment | null = null;

  for (const segment of segments) {
    if (seen.has(segment.id)) return "Caption segment ids must be unique.";
    seen.add(segment.id);
    if (segment.endMs <= segment.startMs) {
      return "Caption end time must be after its start time.";
    }
    if (previous && segment.startMs < previous.startMs) {
      return "Captions must be ordered by start time.";
    }
    if (previous && segment.startMs < previous.endMs) {
      return "Caption segments must not overlap.";
    }
    previous = segment;
  }

  return null;
}

const FONT_FAMILY_CSS: Record<NonNullable<CaptionStyle["fontFamily"]>, string> = {
  inter: "Inter, sans-serif",
  poppins: "Poppins, sans-serif",
  montserrat: "Montserrat, sans-serif",
  roboto: "Roboto, sans-serif",
};

type EditorTab = "edit" | "captions";

export default function ClipEditorModal({ clip, onClose, onSave }: ClipEditorModalProps) {
  const panelRef = useWillChange<HTMLDivElement>("transform, opacity");
  const [activeTab, setActiveTab] = useState<EditorTab>("edit");
  const [edits, setEdits] = useState<ClipEdits>({
    trimStart: 0,
    trimEnd: 100,
    captionStyle: clip.style,
    aspectRatio: clip.resolution === "1080x1920" ? "9:16" : "16:9",
  });
  const [draftConflict, setDraftConflict] = useState(false);
  const handleDraftConflict = useCallback(() => setDraftConflict(true), []);
  const autosave = useAutoSave(`clip-editor:${clip.id}`, edits, {
    onRecover: setEdits,
    onConflict: handleDraftConflict,
  });

  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({
    ...DEFAULT_CAPTION_STYLE,
  });
  const [language, setLanguage] = useState("auto");
  const [burnIntoExport, setBurnIntoExport] = useState(true);

  const loadCaptions = useCallback(async () => {
    setCaptionLoading(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}/captions`);
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;
      if (!data) return;
      setCaptionStatus(data.status);
      if (data.segments?.length) setSegments(data.segments);
      if (data.style) {
        setCaptionStyle({ ...DEFAULT_CAPTION_STYLE, ...data.style });
      }
      if (data.language) setLanguage(data.language);
      setBurnIntoExport(data.burnIntoExport ?? true);
    } finally {
      setCaptionLoading(false);
    }
  }, [clip.id]);

  useEffect(() => {
    if (activeTab !== "captions") return undefined;
    void Promise.resolve().then(() => loadCaptions());
    return undefined;
  }, [activeTab, loadCaptions]);

  useEffect(() => {
    if (
      activeTab !== "captions" ||
      (captionStatus !== "queued" && captionStatus !== "processing")
    ) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      void Promise.resolve().then(() => loadCaptions());
    }, 2500);
    return () => clearTimeout(timeout);
  }, [activeTab, captionStatus, loadCaptions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Tracks the "poll again shortly" timer from handleGenerateCaptions so it
  // can be cancelled if the modal closes first — otherwise it fires
  // loadCaptions() (and its setState calls) after unmount.
  const captionsPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (captionsPollTimeoutRef.current) clearTimeout(captionsPollTimeoutRef.current);
    };
  }, []);

  const handleGenerateCaptions = async () => {
    setCaptionGenerating(true);
    setCaptionError(null);
    try {
      const res = await fetch(`/api/clips/${clip.id}/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setCaptionError(sanitize(body.error ?? "Caption generation failed"));
        return;
      }
      setCaptionStatus("queued");
      if (captionsPollTimeoutRef.current) clearTimeout(captionsPollTimeoutRef.current);
      captionsPollTimeoutRef.current = setTimeout(() => {
        captionsPollTimeoutRef.current = null;
        loadCaptions();
      }, 1500);
    } finally {
      setCaptionGenerating(false);
    }
  };

  const handleSave = () => {
    if (segments.length > 0) {
      const timingError = getSegmentTimingError(segments);
      if (timingError) {
        setCaptionError(timingError);
        return;
      }
    }
    setCaptionError(null);
    autosave.saveNow();
    onSave(clip.id, {
      ...edits,
      captions: segments.length
        ? { segments, style: captionStyle, language, burnIntoExport }
        : undefined,
    });
  };

  const updateSegment = (id: string, text: string) => {
    const safeText = sanitize(text);
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text: safeText } : s)));
    setCaptionError(null);
  };

  const updateSegmentTiming = (id: string, field: "startMs" | "endMs", value: number) => {
    const next = segments.map((segment) =>
      segment.id === id
        ? { ...segment, [field]: Number.isFinite(value) ? Math.round(value) : 0 }
        : segment
    );
    setSegments(next);
    setCaptionError(getSegmentTimingError(next));
  };

  const addSegment = () => {
    const last = segments[segments.length - 1];
    const start = last ? last.endMs : 0;
    setSegments((prev) => [
      ...prev,
      {
        id: `segment-${prev.length + 1}-${Date.now()}`,
        text: "New caption",
        startMs: start,
        endMs: start + 1500,
      },
    ]);
    setCaptionError(null);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== id));
    setCaptionError(null);
  };

  const captionPreviewClass = () => {
    const base = "px-3 py-1 text-white font-bold ";
    const pos =
      captionStyle.position === "top"
        ? "absolute top-6 inset-x-4"
        : captionStyle.position === "center"
          ? "absolute inset-0 flex items-center justify-center"
          : "absolute bottom-10 inset-x-4 text-center";
    const font =
      captionStyle.fontStyle === "bold"
        ? "text-xl uppercase"
        : captionStyle.fontStyle === "rounded"
          ? "text-lg rounded-full bg-black/60"
          : captionStyle.fontStyle === "shadow"
            ? "text-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
            : "text-lg bg-gradient-to-r from-brand to-purple-400 bg-clip-text text-transparent";
    return `${pos} ${base} ${font}`;
  };

  const previewText = segments[0]?.text ?? "Example Caption";
  const captionPreviewStyle: React.CSSProperties = {
    color: captionStyle.color ?? "#FFFFFF",
    backgroundColor: captionStyle.backgroundColor ?? "#000000",
    fontFamily: FONT_FAMILY_CSS[captionStyle.fontFamily ?? "inter"],
    fontSize: `${captionStyle.fontSize ?? 48}px`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={panelRef}
        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="flex-1 bg-black p-6 flex flex-col items-center justify-center min-h-[300px] relative border-r border-white/10">
          <div
            className={`relative bg-white/5 rounded-lg overflow-hidden transition-all duration-300 flex items-center justify-center ${
              edits.aspectRatio === "9:16"
                ? "w-[240px] h-[426px]"
                : edits.aspectRatio === "16:9"
                  ? "w-[480px] h-[270px]"
                  : "w-[300px] h-[300px]"
            }`}
          >
            <Image
              src={clip.thumbnail}
              alt={sanitize(clip.title)}
              fill
              sizes={SIZES_EDITOR_PREVIEW}
              placeholder="blur"
              blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
              className="object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/50 font-medium">Preview Area</span>
            </div>
            <div className={captionPreviewClass()} style={captionPreviewStyle}>
              <span>{sanitize(previewText)}</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[380px] flex flex-col max-h-[80vh]">
          <div className="flex border-b border-white/10">
            {(["edit", "captions"] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-brand border-b-2 border-brand"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            <div
              className="mb-4 flex items-center justify-between gap-3 text-xs text-white/50"
              aria-live="polite"
            >
              <span>
                {autosave.status === "saving" && "Saving draft..."}
                {autosave.status === "saved" && "Draft saved"}
                {autosave.status === "unsaved" && "Unsaved changes"}
                {autosave.status === "recovered" && "Recovered saved draft"}
                {autosave.status === "conflict" && "Draft conflict detected"}
                {autosave.status === "error" && "Draft could not be saved"}
              </span>
              <button
                type="button"
                onClick={autosave.saveNow}
                className="text-brand hover:underline"
              >
                Save now
              </button>
            </div>
            {draftConflict && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <span>A newer local draft was recovered for this clip.</span>
                <button
                  type="button"
                  onClick={() => setDraftConflict(false)}
                  className="font-semibold hover:underline"
                >
                  Keep recovered draft
                </button>
              </div>
            )}
            <div
              className="mb-4 flex items-center justify-between text-xs text-white/50"
              aria-live="polite"
            >
              <span>
                {autosave.status === "saving"
                  ? "Saving draft..."
                  : autosave.status === "unsaved"
                    ? "Unsaved changes"
                    : autosave.status === "recovered"
                      ? "Recovered draft"
                      : autosave.status === "error"
                        ? "Draft save failed"
                        : "All changes saved"}
              </span>
              <button type="button" onClick={autosave.saveNow} className="font-semibold text-brand">
                Save now
              </button>
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 id="editor-title" className="text-xl font-bold text-white">
                {activeTab === "edit" ? "Edit Clip" : "Captions"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeTab === "edit" ? (
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/90 font-medium">
                    <Crop className="w-4 h-4" />
                    <h3>Trim Video</h3>
                  </div>
                  <div className="pt-4 px-2">
                    <div className="h-12 bg-white/5 rounded-lg relative">
                      <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-lg">
                        <Image
                          src={clip.thumbnail}
                          alt=""
                          fill
                          sizes={SIZES_TRIM_TIMELINE}
                          placeholder="blur"
                          blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                          className="object-cover opacity-20"
                        />
                      </div>
                      <div className="absolute inset-y-0 left-0 w-1 bg-brand" />
                      <div className="absolute inset-y-0 right-0 w-1 bg-brand" />
                      <div className="absolute inset-y-0 left-0 right-0 border-y-2 border-brand pointer-events-none" />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>00:00</span>
                      <span>{clip.duration}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/90 font-medium">
                    <MonitorPlay className="w-4 h-4" />
                    <h3>Format</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "9:16", icon: Smartphone, label: "Shorts" },
                      { id: "16:9", icon: MonitorPlay, label: "Landscape" },
                      { id: "1:1", icon: Crop, label: "Square" },
                    ].map((format) => {
                      const isActive = edits.aspectRatio === format.id;
                      const formatIcon = format.icon;
                      return (
                        <button
                          key={format.id}
                          onClick={() =>
                            setEdits((prev) => ({
                              ...prev,
                              aspectRatio: format.id as ClipEdits["aspectRatio"],
                            }))
                          }
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                            isActive
                              ? "bg-brand/10 border-brand text-brand"
                              : "bg-white/5 border-transparent text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {React.createElement(formatIcon, { className: "w-5 h-5 mb-1" })}
                          <span className="text-xs font-bold">{format.id}</span>
                          <span className="text-[10px] opacity-70">{format.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/90 font-medium">
                    <Type className="w-4 h-4" />
                    <h3>Caption Style</h3>
                  </div>
                  <div className="space-y-2">
                    {CAPTION_STYLES.map((style) => {
                      const isActive = edits.captionStyle === style;
                      return (
                        <label
                          key={style}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isActive
                              ? "bg-white/10 border-white/20"
                              : "bg-transparent border-transparent hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="radio"
                            name="captionStyle"
                            value={style}
                            checked={isActive}
                            onChange={() => setEdits((prev) => ({ ...prev, captionStyle: style }))}
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isActive ? "border-brand" : "border-white/30"
                            }`}
                          >
                            {isActive && <div className="w-2 h-2 bg-brand rounded-full" />}
                          </div>
                          <span
                            className={`text-sm font-medium ${isActive ? "text-white" : "text-white/70"}`}
                          >
                            {style}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/90">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {CAPTION_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-[#111]">
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleGenerateCaptions}
                  disabled={captionGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-black rounded-xl text-sm font-bold hover:bg-brand-hover disabled:opacity-50"
                >
                  {captionGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {captionGenerating ? "Generating..." : "Generate Captions"}
                </button>

                {captionStatus && (
                  <p className="text-xs text-white/50 capitalize">Status: {captionStatus}</p>
                )}

                {captionError && (
                  <p role="alert" className="text-xs text-red-400">
                    {sanitize(captionError)}
                  </p>
                )}

                {captionLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                  </div>
                ) : segments.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/90">Font Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {FONT_STYLES.map((fs) => (
                          <button
                            key={fs.id}
                            onClick={() => setCaptionStyle((s) => ({ ...s, fontStyle: fs.id }))}
                            className={`py-2 rounded-lg text-xs font-medium ${
                              captionStyle.fontStyle === fs.id
                                ? "bg-brand text-black"
                                : "bg-white/5 text-white/70"
                            }`}
                          >
                            {fs.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-white/90"
                        htmlFor="caption-font-family"
                      >
                        Font Family
                      </label>
                      <select
                        id="caption-font-family"
                        value={captionStyle.fontFamily ?? "inter"}
                        onChange={(e) =>
                          setCaptionStyle((style) => ({
                            ...style,
                            fontFamily: e.target.value as CaptionStyle["fontFamily"],
                          }))
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                      >
                        {captionFontFamilies.map((font) => (
                          <option key={font} value={font} className="bg-[#111]">
                            {font.charAt(0).toUpperCase() + font.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1 text-sm font-medium text-white/90">
                        Text color
                        <input
                          type="color"
                          value={captionStyle.color ?? "#FFFFFF"}
                          onChange={(e) =>
                            setCaptionStyle((style) => ({ ...style, color: e.target.value }))
                          }
                          className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-white/5"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-medium text-white/90">
                        Background
                        <input
                          type="color"
                          value={captionStyle.backgroundColor ?? "#000000"}
                          onChange={(e) =>
                            setCaptionStyle((style) => ({
                              ...style,
                              backgroundColor: e.target.value,
                            }))
                          }
                          className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-white/5"
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/90">Position</label>
                      <div className="flex gap-2">
                        {POSITIONS.map((pos) => (
                          <button
                            key={pos.id}
                            onClick={() => setCaptionStyle((s) => ({ ...s, position: pos.id }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                              captionStyle.position === pos.id
                                ? "bg-brand text-black"
                                : "bg-white/5 text-white/70"
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-white/90">Timing controls</label>
                        <button
                          type="button"
                          onClick={addSegment}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/10"
                        >
                          Add caption
                        </button>
                      </div>

                      <div className="space-y-3 max-h-56 overflow-y-auto">
                        {segments.map((seg) => (
                          <div
                            key={seg.id}
                            className="rounded-lg bg-white/5 p-3 space-y-2 border border-white/10"
                          >
                            <div className="flex items-start gap-2">
                              <input
                                aria-label={`Caption text ${seg.id}`}
                                value={sanitize(seg.text)}
                                onChange={(e) => updateSegment(seg.id, e.target.value)}
                                className="flex-1 bg-transparent text-sm text-white border-none outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => removeSegment(seg.id)}
                                className="rounded p-1 text-white/40 hover:bg-red-500/10 hover:text-red-400"
                                aria-label={`Remove caption ${seg.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[10px] text-white/40">
                                Start (seconds)
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  aria-label={`Start time for caption ${seg.id}`}
                                  value={(seg.startMs / 1000).toFixed(1)}
                                  onChange={(e) =>
                                    updateSegmentTiming(
                                      seg.id,
                                      "startMs",
                                      Number(e.target.value) * 1000
                                    )
                                  }
                                  className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
                                />
                              </label>
                              <label className="text-[10px] text-white/40">
                                End (seconds)
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  aria-label={`End time for caption ${seg.id}`}
                                  value={(seg.endMs / 1000).toFixed(1)}
                                  onChange={(e) =>
                                    updateSegmentTiming(
                                      seg.id,
                                      "endMs",
                                      Number(e.target.value) * 1000
                                    )
                                  }
                                  className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <a
                          href={`/api/clips/${encodeURIComponent(clip.id)}/captions/download?format=srt`}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
                          download
                        >
                          Download SRT
                        </a>
                        <a
                          href={`/api/clips/${encodeURIComponent(clip.id)}/captions/download?format=vtt`}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
                          download
                        >
                          Download VTT
                        </a>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnIntoExport}
                        onChange={(e) => setBurnIntoExport(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      Burn captions into exported videos
                    </label>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-brand text-black hover:bg-brand-hover transition-colors shadow-[0_0_15px_rgba(var(--brand),0.3)]"
            >
              Save Edits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
