import React from "react";
import Image from "next/image";
import Link from "next/link";
import { sanitize } from "@/app/lib/sanitize";
import { DEFAULT_BLUR_PLACEHOLDER, SIZES_PROJECT_CARD_THUMB } from "@/app/lib/imageUtils";

export interface ProjectCardProps {
  id?: string;
  title: string;
  clipsCount?: number;
  status?: string;
  thumbnail: string;
}

function ProjectCard({
  id,
  title,
  clipsCount = 0,
  status = "Completed",
  thumbnail,
}: ProjectCardProps) {
  const content = (
    <div className="bg-surface border border-white/10 rounded-[24px] p-5 flex items-center gap-5 hover:border-brand/50 transition-colors">
      <div className="relative w-24 h-24 rounded-[18px] overflow-hidden shrink-0 bg-input">
        <Image
          src={thumbnail}
          alt={sanitize(title)}
          fill
          sizes={SIZES_PROJECT_CARD_THUMB}
          placeholder="blur"
          blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
          className="object-cover"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h4 className="text-white font-bold text-base truncate">{sanitize(title)}</h4>
        <p className="text-muted text-xs">{clipsCount} clips generated</p>
        {status && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand/10 text-brand border border-brand/20">
            {status}
          </span>
        )}
      </div>
    </div>
  );

  if (id) {
    return (
      <Link href={`/projects/${id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Purely presentational and prop-driven, so a shallow prop comparison keeps it
 * out of re-render cycles triggered by unrelated dashboard state.
 */
export default React.memo(ProjectCard);
