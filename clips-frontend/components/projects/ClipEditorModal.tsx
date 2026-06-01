"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Scissors, Type, Monitor, Check } from "lucide-react";

interface ClipEditorModalProps {
  clip: { id: string; title: string; thumbnail: string; duration: string };
  onClose: () => void;
  onSave: (id: string, edits: ClipEdits) => void;
}

export interface ClipEdits {
  trimStart: number; // seconds
  trimEnd: number;   // seconds
  captionsStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
}

const ASPECT_RATIOS: { label: string; value: ClipEdits["aspectRatio"]; desc: string }[] = [
  { label: "16:9", value: "16:9", desc: "YouTube / Landscape" },
  { label: "9:16", value: "9:16", desc: "TikTok / Reels" },
  { label: "1:1",  value: "1:1",  desc: "Instagram Square" },
  { label: "4:5",  value: "4:5",  desc: "Instagram Portrait" },
];

const CAPTIONS_STYLES = ["None", "Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];

function parseDuration(d: string): number {
  const [mm, ss] = d.split(":").map(Number);
  return (mm || 0) * 60 + (ss || 0);
}

export default function ClipEditorModal({ clip, onClose, onSave }: ClipEditorModalProps) {
  const totalDuration = parseDuration(clip.duration);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(totalDuration);
  const [captionsStyle, setCaptionsStyle] = useState("None");
  const [aspectRatio, setAspectRatio] = useState<ClipEdits["aspectRatio"]>("9:16");
  const [activeTab, setActiveTab] = useState<"trim" | "captions" | "ratio">("trim");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Draw preview on canvas whenever settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [w, h] = (() => {
      switch (aspectRatio) {
        case "9:16": return [270, 480];
        case "1:1":  return [360, 360];
        case "4:5":  return [288, 360];
        default:     return [480, 270]; // 16:9
      }
    })();
    canvas.width = w;
    canvas.height = h;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (imgRef.current) {
        ctx.drawImage(imgRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#0C120F";
        ctx.fillRect(0, 0, w, h);
      }

      // Overlay: trim indicator
      const trimmedPct = (trimEnd - trimStart) / totalDuration;
      ctx.fillStyle = "rgba(0,229,143,0.12)";
      ctx.fillRect(0, h - 6, w * trimmedPct, 6);
      ctx.fillStyle = "#00E58F";
      ctx.fillRect(0, h - 6, w * trimmedPct, 6);

      // Captions preview
      if (captionsStyle !== "None") {
        ctx.save();
        ctx.fillStyle = captionsStyle === "Bold & Dynamic" ? "#00E58F" : "rgba(255,255,255,0.9)";
        ctx.font = `bold ${captionsStyle === "Bold & Dynamic" ? 18 : 14}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Sample caption text", w / 2, h - 24);
        ctx.restore();
      }
    };

    if (!imgRef.current) {
      const img = new Image();
      img.src = clip.thumbnail;
      img.onload = () => { imgRef.current = img; draw(); };
    } else {
      draw();
    }
  }, [aspectRatio, captionsStyle, trimStart, trimEnd, totalDuration, clip.thumbnail]);

  const handleSave = useCallback(() => {
    onSave(clip.id, { trimStart, trimEnd, captionsStyle, aspectRatio });
    onClose();
  }, [clip.id, trimStart, trimEnd, captionsStyle, aspectRatio, onSave, onClose]);

  const trimmedDuration = trimEnd - trimStart;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-[#0C120F] border border-white/10 rounded-[28px] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-[16px] font-extrabold text-white">{clip.title}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Clip Editor</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-all" aria-label="Close editor">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Canvas Preview */}
          <div className="flex items-center justify-center bg-black/40 p-6 md:w-[320px] shrink-0">
            <canvas
              ref={canvasRef}
              className="rounded-xl max-w-full max-h-[300px] object-contain"
              style={{ imageRendering: "auto" }}
            />
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/5 px-4">
              {([
                { id: "trim",     label: "Trim",       icon: Scissors },
                { id: "captions", label: "Captions",   icon: Type },
                { id: "ratio",    label: "Aspect Ratio", icon: Monitor },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold border-b-2 transition-all ${
                    activeTab === id
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === "trim" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="text-brand font-black">{fmt(trimmedDuration)}</span>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                      Trim Start — {fmt(trimStart)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={totalDuration - 1}
                      step={1}
                      value={trimStart}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTrimStart(Math.min(v, trimEnd - 1));
                      }}
                      className="w-full accent-brand"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                      Trim End — {fmt(trimEnd)}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={totalDuration}
                      step={1}
                      value={trimEnd}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTrimEnd(Math.max(v, trimStart + 1));
                      }}
                      className="w-full accent-brand"
                    />
                  </div>

                  {/* Timeline visual */}
                  <div className="relative h-10 bg-white/5 rounded-xl overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-brand/20 border-x-2 border-brand rounded-xl"
                      style={{
                        left: `${(trimStart / totalDuration) * 100}%`,
                        width: `${((trimEnd - trimStart) / totalDuration) * 100}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                      {fmt(trimStart)} → {fmt(trimEnd)}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "captions" && (
                <div className="space-y-3">
                  <p className="text-[12px] text-muted-foreground">Choose a captions style to overlay on your clip.</p>
                  {CAPTIONS_STYLES.map((style) => (
                    <button
                      key={style}
                      onClick={() => setCaptionsStyle(style)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-[13px] font-bold transition-all ${
                        captionsStyle === style
                          ? "bg-brand/10 border-brand/40 text-brand"
                          : "bg-white/[0.02] border-white/5 text-muted-foreground hover:text-white hover:border-white/10"
                      }`}
                    >
                      {style}
                      {captionsStyle === style && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "ratio" && (
                <div className="grid grid-cols-2 gap-3">
                  {ASPECT_RATIOS.map(({ label, value, desc }) => (
                    <button
                      key={value}
                      onClick={() => setAspectRatio(value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all ${
                        aspectRatio === value
                          ? "bg-brand/10 border-brand/40 text-brand"
                          : "bg-white/[0.02] border-white/5 text-muted-foreground hover:text-white hover:border-white/10"
                      }`}
                    >
                      <span className="text-[18px] font-black">{label}</span>
                      <span className="text-[11px]">{desc}</span>
                      {aspectRatio === value && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-white/10 text-[13px] font-bold text-muted-foreground hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-brand text-black text-[13px] font-black hover:shadow-[0_0_20px_rgba(0,229,143,0.3)] transition-all">
                Save Edits
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
