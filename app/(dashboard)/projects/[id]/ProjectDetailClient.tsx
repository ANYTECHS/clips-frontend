"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Play, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import type { Clip } from "@/components/projects/ClipGrid";

interface ProjectDetail {
  id: string;
  name: string;
  thumbnailUrl: string;
  videoUrl: string;
  clipCount: number;
}

export default function ProjectDetailClient({
  initialProject,
  initialClips,
}: {
  initialProject: ProjectDetail;
  initialClips: Clip[];
}) {
  const router = useRouter();
  const { showToast, ToastEl } = useToast();

  const [project, setProject] = useState<ProjectDetail>(initialProject);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(initialProject.name);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === project.name) {
      setRenaming(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Rename failed");
      
      setProject(prev => ({ ...prev, name: newName.trim() }));
      setRenaming(false);
      showToast("Project renamed", "success");
      router.refresh();
    } catch {
      showToast("Failed to rename project", "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project and all its clips?")) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showToast("Project deleted", "success");
      router.push("/projects");
      router.refresh();
    } catch {
      showToast("Failed to delete project", "error");
    }
  };

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
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <button onClick={handleRename} className="px-4 py-2 bg-brand text-black rounded-xl text-sm font-bold hover:bg-brand/90 transition-colors">
                Save
              </button>
              <button onClick={() => { setRenaming(false); setNewName(project.name); }} className="px-4 py-2 bg-white/5 text-white rounded-xl text-sm hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white">{project.name}</h1>
              <button
                onClick={() => setRenaming(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Rename project"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors"
                aria-label="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-muted-foreground text-sm mt-1">{initialClips.length} clips</p>
        </div>
      </div>

      <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden bg-black group">
        <Image src={project.thumbnailUrl} alt={project.name} fill className="object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center">
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-16 h-16 rounded-full bg-brand/90 flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-brand/20"
          >
            <Play className="w-8 h-8 text-black ml-1" />
          </a>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Project Clips</h2>
        {initialClips.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No clips in this project yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {initialClips.map((clip) => (
              <div key={clip.id} className="group rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:shadow-lg hover:shadow-black/20">
                <div className="aspect-[9/16] relative overflow-hidden">
                  <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 left-3 bg-brand text-black px-2 py-0.5 rounded text-xs font-bold shadow-lg">
                    {clip.score}
                  </div>
                </div>
                <div className="p-3 bg-white/5 group-hover:bg-white/10 transition-colors">
                  <h4 className="text-white font-bold text-sm truncate">{clip.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{clip.duration} · {clip.style}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
