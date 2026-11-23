"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  TrendingUp,
  Smartphone,
  Info,
  FileVideo,
} from "lucide-react";
import { triggerDownload } from "@/lib/download";
import { useToast } from "@/components/shared/ToastProvider";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import {
  ReadyToPostKit,
  getClipReadyToPostKit,
} from "@/lib/queries";
import Button from "@/components/shared/Button";

interface ReadyToPostClip {
  id: string;
  title: string;
  thumbnail?: string | null;
  clipUrl?: string | null;
  duration?: string;
  caption?: string;
  hashtags?: string[];
  platform?: string;
  readyToPostKit?: ReadyToPostKit | null;
}

interface ReadyToPostModalProps {
  clip: ReadyToPostClip;
  onClose: () => void;
}

const FALLBACK_THUMB =
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800";

function resolvePlatformUrl(platform: "tiktok" | "shorts" | "reels" | "x", rawUrl?: string): string {
  if (platform === "tiktok") {
    if (!rawUrl || rawUrl.startsWith("intent:") || rawUrl.includes("af_deeplink") || rawUrl.includes("creator-center")) {
      return "https://www.tiktok.com/upload";
    }
    return rawUrl;
  }
  if (platform === "shorts") {
    if (!rawUrl || rawUrl.includes("/channel/UC/") || rawUrl.includes("/channel/UC")) {
      return "https://www.youtube.com/upload";
    }
    return rawUrl;
  }
  if (platform === "reels") {
    return rawUrl || "https://www.instagram.com/";
  }
  if (platform === "x") {
    return rawUrl || "https://x.com/compose/post";
  }
  return rawUrl || "#";
}

export default function ReadyToPostModal({ clip, onClose }: ReadyToPostModalProps) {
  const [kit, setKit] = useState<ReadyToPostKit | null>(clip.readyToPostKit || null);
  const [_loadingKit, setLoadingKit] = useState(!clip.readyToPostKit);

  const fallbackCaption =
    clip.caption ||
    `${clip.title}\n\nWatch till the end for the best takeaway! 👀 What's your take on this?\n\n#viral #shorts #trending #contentcreator #reels #tiktok`;

  const [caption, setCaption] = useState(
    clip.readyToPostKit?.copyTemplates?.readyToPost || fallbackCaption
  );
  const [userEdited, setUserEdited] = useState(false);
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [downloading, setDownloading] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (clip.readyToPostKit) {
      setKit(clip.readyToPostKit);
      if (clip.readyToPostKit.copyTemplates?.readyToPost && !userEdited) {
        setCaption(clip.readyToPostKit.copyTemplates.readyToPost);
      }
      setLoadingKit(false);
      return;
    }

    let active = true;
    setLoadingKit(true);
    getClipReadyToPostKit(clip.id)
      .then((data) => {
        if (!active) return;
        setKit(data);
        if (data.copyTemplates?.readyToPost && !userEdited) {
          setCaption(data.copyTemplates.readyToPost);
        }
      })
      .catch((err) => {
        console.warn("[ReadyToPostModal] Could not fetch kit:", err);
      })
      .finally(() => {
        if (active) setLoadingKit(false);
      });

    return () => {
      active = false;
    };
  }, [clip.id, clip.readyToPostKit, userEdited]);

  const effectiveDownloadUrl =
    kit?.downloadUrl ||
    clip.readyToPostKit?.downloadUrl ||
    clip.clipUrl ||
    "";

  const handleDownload = () => {
    if (!effectiveDownloadUrl) return;
    setDownloading(true);
    try {
      triggerDownload(effectiveDownloadUrl, clip.title);
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const handleCopyCaption = async (textToCopy?: string) => {
    const text = textToCopy || caption;
    if (await copy(text)) toast("Caption copied to clipboard", "success");
    else toast("Couldn't copy to clipboard", "error");
  };

  const platformLinks = [
    {
      name: "TikTok",
      url: resolvePlatformUrl("tiktok", kit?.platformLinks?.tiktok),
      icon: "🎵",
      color: "hover:border-[#00f2fe]/50 hover:bg-[#00f2fe]/10",
      desc: "Web Upload & Post",
    },
    {
      name: "YouTube Shorts",
      url: resolvePlatformUrl("shorts", kit?.platformLinks?.shorts || kit?.platformLinks?.youtube),
      icon: "▶️",
      color: "hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10",
      desc: "Creator Studio Upload",
    },
    {
      name: "Instagram Reels",
      url: resolvePlatformUrl("reels", kit?.platformLinks?.reels || kit?.platformLinks?.instagram),
      icon: "📸",
      color: "hover:border-[#E1306C]/50 hover:bg-[#E1306C]/10",
      desc: "Web Uploader & Reels",
    },
    {
      name: "X / Twitter",
      url: resolvePlatformUrl("x", kit?.platformLinks?.twitter || kit?.platformLinks?.x),
      icon: "𝕏",
      color: "hover:border-white/40 hover:bg-white/10",
      desc: "Compose New Post",
    },
  ];

  const qrTargetUrl = effectiveDownloadUrl || (typeof window !== "undefined" ? window.location.href : "");
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&color=B6FF4A&bgcolor=06351C&data=${encodeURIComponent(
    qrTargetUrl
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[680px] bg-[#06351C] border border-[#0e4d2a] rounded-[28px] overflow-hidden shadow-[0_10px_60px_rgba(0,0,0,0.8),0_0_50px_rgba(57,255,20,0.12)] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#39FF14] to-transparent opacity-80" />

        {/* Modal Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-[#0e4d2a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-black text-[#F4F7EF] tracking-tight">
                  Ready-to-Post Kit
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[10px] font-black uppercase tracking-wider">
                  3-Click Publish
                </span>
                {kit && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#042413] border border-[#0e4d2a] text-[#90A89C] text-[10px] font-bold">
                    HD Kit Linked
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#90A89C] font-medium">
                Download HD, copy AI caption, and open TikTok, Shorts, & Reels with 100% organic reach
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] hover:text-[#F4F7EF] hover:bg-[#084223] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto scrollbar-hide">
          {/* Clip summary card */}
          <div className="bg-[#042413] border border-[#0e4d2a] rounded-2xl p-3.5 flex items-center gap-4">
            <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-[#020D08] shrink-0 border border-[#0e4d2a]">
              <Image
                src={clip.thumbnail || FALLBACK_THUMB}
                alt={clip.title}
                fill
                className="object-cover"
              />
              {clip.duration && (
                <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[8px] font-bold text-[#F4F7EF]">
                  {clip.duration}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-[14px] font-bold text-[#F4F7EF] truncate mb-1">
                {clip.title}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-[#90A89C]">
                <span className="text-[#B6FF4A] font-bold flex items-center gap-1">
                  <FileVideo className="w-3 h-3 inline" /> 9:16 Vertical HD
                </span>
                <span>•</span>
                <span>Algorithm Optimized</span>
              </div>
            </div>

            <button
              onClick={() => setShowQr(!showQr)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                showQr
                  ? "bg-[#B6FF4A]/15 border-[#B6FF4A] text-[#B6FF4A]"
                  : "bg-[#06351C] border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF]"
              }`}
              title="Scan with phone"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send to Phone</span>
            </button>
          </div>

          {/* QR Code Phone Handoff Dropdown */}
          {showQr && (
            <div className="bg-[#042413] border border-[#B6FF4A]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 animate-in slide-in-from-top-2 duration-300">
              <div className="w-32 h-32 rounded-xl bg-[#06351C] border border-[#0e4d2a] p-2 shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeImageUrl}
                  alt="QR Code to Download on Phone"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[#B6FF4A] text-[13px] font-bold">
                  <QrCode className="w-4 h-4" />
                  <span>Scan to Download Directly to Mobile</span>
                </div>
                <p className="text-[12px] text-[#90A89C] leading-relaxed">
                  Open your phone&apos;s camera and scan the QR code. You can save the video directly to
                  your camera roll to add trending TikTok sounds, stickers, and hashtags natively!
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Download HD */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#90A89C] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#B6FF4A]/15 text-[#B6FF4A] flex items-center justify-center text-[10px] font-black">
                  1
                </span>
                Download High-Definition Clip
              </span>
              <span className="text-[11px] text-[#90A89C]">MP4 • 1080×1920 (HD)</span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="lg" onClick={handleDownload}
                disabled={!effectiveDownloadUrl || downloading}
                className="flex-1"
              >
                <Download className={`w-5 h-5 ${downloading ? "animate-bounce" : ""}`} />
                {downloading ? "Starting HD Download…" : "⬇️ Download HD Clip"}
              </Button>

              {effectiveDownloadUrl && (
                <a
                  href={effectiveDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-4 rounded-2xl bg-[#042413] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#90A89C] hover:text-[#F4F7EF] transition-all flex items-center justify-center"
                  title="Open video link in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Step 2: Copy Caption & Hashtags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#90A89C] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#B6FF4A]/15 text-[#B6FF4A] flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                AI Caption & Curated Hashtags
              </span>
              <button
                onClick={() => handleCopyCaption()}
                aria-label="Copy caption and hashtags"
                className="text-[11px] font-bold text-[#B6FF4A] hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "📋 Copy"}
              </button>
            </div>

            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setUserEdited(true);
                }}
                rows={3}
                className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 text-[#F4F7EF] rounded-2xl p-4 text-[13px] leading-relaxed focus:outline-none resize-none font-sans transition-colors placeholder-[#90A89C]"
                placeholder="Writing caption & hashtags..."
              />
              <button
                onClick={() => handleCopyCaption()}
                aria-label="Copy caption and hashtags"
                className={`absolute bottom-3 right-3 px-3.5 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                  copied
                    ? "bg-[#B6FF4A] text-[#020D08] font-black"
                    : "bg-[#06351C] hover:bg-[#084223] text-[#F4F7EF] border border-[#0e4d2a]"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Copied" : ""}
          </span>

          {/* Step 3: Platform links */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#90A89C] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#B6FF4A]/15 text-[#B6FF4A] flex items-center justify-center text-[10px] font-black">
                  3
                </span>
                Quick Action Links (Launch & Upload)
              </span>
              <span className="text-[11px] text-[#90A89C] flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#B6FF4A]" />
                100% Native Algorithm Reach
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {platformLinks.map((p) => (
                <a
                  key={p.name}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3.5 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex flex-col items-center justify-center text-center gap-1.5 transition-all group ${p.color}`}
                >
                  <span className="text-[20px]">{p.icon}</span>
                  <div className="flex items-center gap-1 text-[13px] font-bold text-[#F4F7EF] group-hover:text-[#B6FF4A]">
                    <span>{p.name}</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                  </div>
                  <span className="text-[10px] text-[#90A89C] leading-tight">
                    {p.desc}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Strategy Tip Banner */}
          <div className="p-3.5 rounded-xl bg-[#042413] border border-[#00C853]/30 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#B6FF4A] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#90A89C] leading-relaxed">
              <strong className="text-[#F4F7EF]">Why Ready-to-Post Kit?</strong> Uploading manually through these
              official links allows you to use trending audio & native stickers, which gives{" "}
              <strong className="text-[#B6FF4A]">3x to 5x higher reach</strong> than bot automated posting!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
