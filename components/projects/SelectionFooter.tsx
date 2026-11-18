"use client";

import React, { useState } from "react";
import { Trash2, MoveRight, Loader2, CheckCircle2, AlertCircle, X, ChevronDown } from "lucide-react";

interface SelectionFooterProps {
  count: number;
  selectedIds: string[];
  onDelete: (ids: string[]) => Promise<void>;
  onClearSelection: () => void;
}

type Toast = { type: "success" | "error"; message: string } | null;

const POST_PLATFORMS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
];

export default function SelectionFooter({ count, selectedIds, onDelete, onClearSelection }: SelectionFooterProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["tiktok"]);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  if (count === 0) return null;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    setAction("delete");
    setConfirmDelete(false);
    try {
      await onDelete(selectedIds);
      onClearSelection();
      showToast("success", `${count} clip${count > 1 ? "s" : ""} deleted.`);
    } catch {
      showToast("error", "Failed to delete clips. Please try again.");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handlePost = async () => {
    showToast(
      "error",
      "Direct Auto-Posting is coming soon! Use the 'Post Kit' button on individual clips to download HD and publish natively with maximum reach."
    );
  };

  return (
    <>
      {/* In-app toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-right-5 fade-in duration-300 max-w-md ${
          toast.type === "success"
            ? "bg-[#B6FF4A]/10 border-[#B6FF4A]/30 text-[#B6FF4A]"
            : "bg-red-400/10 border-red-400/30 text-red-400"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="text-[13px] font-medium leading-relaxed">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="w-full py-6 animate-in slide-in-from-bottom-5 fade-in duration-500 border-t border-[#0e4d2a] bg-[#020D08]/80 backdrop-blur-md">
        <div className="relative bg-[#06351C] border border-[#0e4d2a] rounded-[32px] px-8 py-4 flex flex-col lg:flex-row items-center justify-between gap-6 w-full shadow-2xl">
          {/* Left: count */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#B6FF4A] flex items-center justify-center text-[#020D08] font-black text-[16px]">
              {count}
            </div>
            <div className="space-y-0.5">
              <p className="text-[16px] font-extrabold text-[#F4F7EF]">Clips selected</p>
              <p className="text-[12px] font-medium text-[#90A89C]">Ready for Post Kit download or deletion</p>
            </div>
          </div>

          {/* Middle: actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[#90A89C]">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-red-400 font-medium">Delete {count} clip{count > 1 ? "s" : ""}?</span>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[13px] font-bold hover:bg-red-500/20 transition-all"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-xl border border-[#0e4d2a] text-[#90A89C] text-[13px] font-bold hover:text-[#F4F7EF] transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl border border-[#0e4d2a] bg-[#042413] text-[13px] font-bold text-[#90A89C] hover:text-red-400 hover:border-red-400/20 transition-all disabled:opacity-50"
              >
                {loading && action === "delete" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete</span>
              </button>
            )}
          </div>

          {/* Right: platform picker + auto-post */}
          <div className="flex flex-col sm:flex-row items-center gap-4 relative">
            {/* Auto-posting badge indicator */}
            {/* <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#042413] border border-[#0e4d2a] text-[#B6FF4A] font-black text-[12px] select-none">
              <Zap className="w-4 h-4 fill-[#B6FF4A]" />
              <span>AUTO-POSTING</span>
              <span className="px-2 py-0.5 rounded-full bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[9px] font-black uppercase tracking-wider">
                Coming Soon
              </span>
            </div> */}

            {/* Platform selector */}
            <div className="relative z-[100]">
              <button
                onClick={() => setShowPlatformPicker(v => !v)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] font-bold text-[12px] hover:border-[#39FF14]/40 transition-all"
              >
                <span>
                  {selectedPlatforms.length === 0
                    ? "Select platforms"
                    : selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#90A89C]" />
              </button>

              {showPlatformPicker && (
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-[#042413] border border-[#0e4d2a] rounded-2xl p-4 shadow-2xl min-w-[180px] animate-in slide-in-from-bottom-3 fade-in duration-200">
                  <p className="text-[10px] font-black text-[#90A89C] uppercase tracking-widest mb-3">Post to</p>
                  <div className="flex flex-col gap-2">
                    {POST_PLATFORMS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => togglePlatform(key)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                          selectedPlatforms.includes(key)
                            ? "bg-[#B6FF4A]/12 border border-[#B6FF4A]/30 text-[#B6FF4A]"
                            : "border border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF] hover:border-[#39FF14]/40"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                          selectedPlatforms.includes(key) ? "bg-[#B6FF4A] border-[#B6FF4A]" : "border-[#0e4d2a]"
                        }`}>
                          {selectedPlatforms.includes(key) && (
                            <CheckCircle2 className="w-3 h-3 text-[#020D08]" />
                          )}
                        </div>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPlatformPicker(false)}
                    className="mt-3 w-full py-2 rounded-xl bg-[#B6FF4A] text-[#020D08] font-black text-[12px] hover:bg-[#c6ff6b] transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Auto-Post CTA Button with Coming Soon badge */}
            <button
              onClick={handlePost}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 rounded-3xl bg-[#B6FF4A] text-[#020D08] font-black text-[14px] sm:text-[15px] transition-all hover:bg-[#c6ff6b] hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(57,255,20,0.25)]"
            >
              <span>Auto-Post Selected</span>
              <span className="px-2 py-0.5 rounded-full bg-[#020D08]/20 text-[#020D08] text-[9px] font-black uppercase tracking-wider">
                Coming Soon
              </span>
              <MoveRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
