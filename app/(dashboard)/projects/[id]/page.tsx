import React, { Suspense } from "react";
import { getProjectDetail } from "@/app/lib/projectService";
import ProjectDetailClient from "./ProjectDetailClient";
import ProjectDetailLoading from "./loading";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Play, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import type { Clip } from "@/components/projects/ClipGrid";
import {
  DEFAULT_BLUR_PLACEHOLDER,
  SIZES_PROJECT_HERO,
  SIZES_CLIP_GRID,
} from "@/app/lib/imageUtils";

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { project, clips } = await getProjectDetail(params.id);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto w-full">
      {ToastEl}

      <div className="flex items-center gap-4">
        <Link
          href="/projects"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xl font-bold"
                autoFocus
              />
              <button onClick={handleRename} className="px-4 py-2 bg-brand text-black rounded-xl text-sm font-bold">
                Save
              </button>
              <button onClick={() => setRenaming(false)} className="px-4 py-2 bg-white/5 text-white rounded-xl text-sm">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white">{project.name}</h1>
              <button
                onClick={() => setRenaming(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                aria-label="Rename project"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400"
                aria-label="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-muted-foreground text-sm mt-1">{clips.length} clips</p>
        </div>
      </div>

      <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden bg-black">
        <Image
          src={project.thumbnailUrl}
          alt={project.name}
          fill
          sizes={SIZES_PROJECT_HERO}
          placeholder="blur"
          blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-16 h-16 rounded-full bg-brand/90 flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Play className="w-8 h-8 text-black ml-1" />
          </a>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Project Clips</h2>
        {clips.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No clips in this project yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {clips.map((clip) => (
              <div key={clip.id} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                <div className="aspect-[9/16] relative">
                  <Image
                    src={clip.thumbnail}
                    alt={clip.title}
                    fill
                    sizes={SIZES_CLIP_GRID}
                    placeholder="blur"
                    blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-brand text-black px-2 py-0.5 rounded text-xs font-bold">
                    {clip.score}
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="text-white font-bold text-sm truncate">{clip.title}</h4>
                  <p className="text-xs text-muted-foreground">{clip.duration} · {clip.style}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
