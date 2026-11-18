"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Video } from "lucide-react";

interface ProjectCardProps {
  id?: string | number;
  title: string;
  clipsCount: number;
  status: "processing" | "completed" | string;
  thumbnail?: string | null;
  videoUrl?: string | null;
  clips?: any[];
}

/**
 * Derives the best thumbnail image or video frame from video metadata
 */
function resolveMedia(
  thumbnail?: string | null,
  videoUrl?: string | null,
  clips?: any[]
): { imageUrl: string | null; videoSrc: string | null } {
  const toCloudinaryThumb = (url: string) => {
    return url
      .replace(/\/video\/upload\/(?:v\d+\/)?/, "/video/upload/so_1,w_400,h_400,c_fill,q_auto,f_auto/")
      .replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, ".jpg");
  };

  const toYouTubeThumb = (url: string) => {
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    return ytMatch?.[1] ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : null;
  };

  if (thumbnail && typeof thumbnail === "string" && thumbnail.trim()) {
    const trimmed = thumbnail.trim();
    if (trimmed.includes("cloudinary.com") && trimmed.includes("/video/upload/")) {
      return { imageUrl: toCloudinaryThumb(trimmed), videoSrc: null };
    }
    const yt = toYouTubeThumb(trimmed);
    if (yt) return { imageUrl: yt, videoSrc: null };
    return { imageUrl: trimmed, videoSrc: null };
  }

  if (Array.isArray(clips) && clips.length > 0) {
    for (const c of clips) {
      if (c?.thumbnail && typeof c.thumbnail === "string" && c.thumbnail.trim()) {
        return { imageUrl: c.thumbnail.trim(), videoSrc: null };
      }
      if (c?.clipUrl && typeof c.clipUrl === "string" && c.clipUrl.includes("cloudinary.com")) {
        return { imageUrl: toCloudinaryThumb(c.clipUrl.trim()), videoSrc: null };
      }
    }
  }

  if (videoUrl && typeof videoUrl === "string" && videoUrl.trim()) {
    const trimmed = videoUrl.trim();

    const yt = toYouTubeThumb(trimmed);
    if (yt) return { imageUrl: yt, videoSrc: null };

    if (trimmed.includes("cloudinary.com") && trimmed.includes("/video/upload/")) {
      return { imageUrl: toCloudinaryThumb(trimmed), videoSrc: null };
    }

    if (/\.(mp4|webm|mov|m4v)/i.test(trimmed) || trimmed.startsWith("http")) {
      return { imageUrl: null, videoSrc: trimmed };
    }
  }

  if (Array.isArray(clips) && clips.length > 0 && clips[0]?.clipUrl) {
    return { imageUrl: null, videoSrc: clips[0].clipUrl };
  }

  return { imageUrl: null, videoSrc: null };
}

export default function ProjectCard({ 
  id,
  title, 
  clipsCount, 
  status, 
  thumbnail,
  videoUrl,
  clips
}: ProjectCardProps) {
  const { imageUrl, videoSrc } = useMemo(
    () => resolveMedia(thumbnail, videoUrl, clips),
    [thumbnail, videoUrl, clips]
  );

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl, videoSrc]);

  const cardContent = (
    <div className="group bg-[#06351C] border border-[#0e4d2a] rounded-[28px] p-5 hover:border-[#39FF14]/40 transition-all duration-500 hover:shadow-[0_0_35px_rgba(57,255,20,0.12)] cursor-pointer">
      <div className="flex items-center gap-5">
        <div className="w-24 h-24 rounded-[18px] overflow-hidden relative shrink-0 bg-[#031d0f] border border-[#0e4d2a] flex items-center justify-center">
          {imageUrl && !imgError ? (
            <Image 
              src={imageUrl} 
              alt={title} 
              fill 
              sizes="96px" 
              className="object-cover group-hover:scale-110 transition-transform duration-500" 
              onError={() => setImgError(true)}
            />
          ) : videoSrc ? (
            <video
              src={`${videoSrc}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#06351C] to-[#031d0f] text-[#B6FF4A]/40 group-hover:text-[#B6FF4A]/80 transition-colors">
              <Video className="w-8 h-8 stroke-[1.5]" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h4 className="text-[15px] font-bold text-[#F4F7EF] truncate group-hover:text-[#B6FF4A] transition-colors">
            {title}
          </h4>
          <p className="text-[12px] text-[#90A89C] font-medium">
            {clipsCount} {clipsCount === 1 ? "clip" : "clips"} generated
          </p>
          
          <div className="flex">
            <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
              status === "processing" 
                ? "bg-[#B6FF4A]/12 text-[#B6FF4A] border border-[#B6FF4A]/30 shadow-[0_0_10px_rgba(57,255,20,0.2)]" 
                : "bg-[#042413] text-[#90A89C] border border-[#0e4d2a]"
            }`}>
              {status}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (id) {
    return (
      <Link href={`/projects?videoId=${id}`} className="block focus:outline-none">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
