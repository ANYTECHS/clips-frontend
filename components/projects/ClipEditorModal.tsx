"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, Crop, Type, MonitorPlay, Smartphone, Loader2, Sparkles } from "lucide-react";
import type { Clip } from "./ClipGrid";
import {
  CAPTION_LANGUAGES,
  type CaptionSegment,
  type CaptionStyle,
} from "@/app/api/schemas/captions.schema";
import {
  DEFAULT_BLUR_PLACEHOLDER,
  SIZES_EDITOR_PREVIEW,
  SIZES_TRIM_TIMELINE,
} from "@/app/lib/imageUtils";

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

const CAPTION_STYLES = [
  "Bold & Dynamic",
  "Minimalist",
  "Emoji-Rich",
  "Subtitles Only",
];

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

type EditorTab = "edit" | "captions";

export default function ClipEditorModal({ clip, onClose, onSave }: ClipEditorModalProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("edit");
  const [edits, setEdits] = useState<ClipEdits>({
    trimStart: 0,
    trimEnd: 100,
    captionStyle: clip.style,
    aspectRatio: clip.resolution === "1080x1920" ? "9:16" : "16:9",
  });

  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({
    fontStyle: "bold",
    position: "bottom",
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
      if (data.style) setCaptionStyle(data.style);
      if (data.language) setLanguage(data.language);
      setBurnIntoExport(data.burnIntoExport ?? true);
    } finally {
      setCaptionLoading(false);
    }
  }, [clip.id]);

  useEffect(() => {
    if (activeTab === "captions") loadCaptions();
  }, [activeTab, loadCaptions]);

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
    try {
      const res = await fetch(`/api/clips/${clip.id}/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (res.ok) {
        setCaptionStatus("queued");
        if (captionsPollTimeoutRef.current) clearTimeout(captionsPollTimeoutRef.current);
        captionsPollTimeoutRef.current = setTimeout(() => {
          captionsPollTimeoutRef.current = null;
          loadCaptions();
        }, 1500);
      }
    } finally {
      setCaptionGenerating(false);
    }
  };

  const handleSave = () => {
    onSave(clip.id, {
      ...edits,
      captions: segments.length
        ? { segments, style: captionStyle, language, burnIntoExport }
        : undefined,
    });
  };

  const updateSegment = (id: string, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
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
              alt={clip.title}
              fill
              sizes={SIZES_EDITOR_PREVIEW}
              placeholder="blur"
              blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
              className="object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/50 font-medium">Preview Area</span>
            </div>
            <div className={captionPreviewClass()}>
              <span>{previewText}</span>
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
                      const Icon = format.icon;
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
                          <Icon className="w-5 h-5 mb-1" />
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
                          <span className={`text-sm font-medium ${isActive ? "text-white" : "text-white/70"}`}>
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
                      <label className="text-sm font-medium text-white/90">Word-level timing</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {segments.map((seg) => (
                          <div key={seg.id} className="bg-white/5 rounded-lg p-2 space-y-1">
                            <input
                              value={seg.text}
                              onChange={(e) => updateSegment(seg.id, e.target.value)}
                              className="w-full bg-transparent text-sm text-white border-none outline-none"
                            />
                            <span className="text-[10px] text-white/40">
                              {(seg.startMs / 1000).toFixed(1)}s – {(seg.endMs / 1000).toFixed(1)}s
                            </span>
                          </div>
                        ))}
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
