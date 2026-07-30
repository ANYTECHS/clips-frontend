"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, ChevronDown } from "lucide-react";

interface ProjectItem {
  id: string;
  name: string;
}

export default function ProjectSelector() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeProjectId = pathname.match(/^\/projects\/([^/]+)$/)?.[1];

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.projects) {
          setProjects(json.data.projects.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || projects.length === 0) return null;

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="px-3 mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="truncate">{activeProject?.name ?? "All Projects"}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-1 bg-surface border border-border rounded-xl overflow-hidden shadow-lg">
          <Link
            href="/projects"
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
              !activeProjectId ? "text-brand font-medium" : "text-white/70"
            }`}
          >
            All Projects
          </Link>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm hover:bg-white/5 transition-colors truncate ${
                activeProjectId === project.id ? "text-brand font-medium" : "text-white/70"
              }`}
            >
              {project.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
