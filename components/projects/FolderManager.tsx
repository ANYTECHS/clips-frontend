"use client";

import React, { useState } from "react";
import { Folder, FolderPlus, MoreVertical, Trash2, Edit2, FolderOpen, Move } from "lucide-react";

export interface ProjectFolder {
  id: string;
  name: string;
  clipCount: number;
  createdAt: string;
  color?: string;
}

interface FolderManagerProps {
  folders?: ProjectFolder[];
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateFolder?: (name: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveClipsToFolder?: (folderId: string, clipIds: string[]) => void;
  selectedClipIds?: string[];
}

export default function FolderManager({
  folders: initialFolders = [
    { id: "f-1", name: "TikTok Shorts", clipCount: 14, createdAt: "2026-03-01", color: "#00E58F" },
    { id: "f-2", name: "YouTube Viral", clipCount: 8, createdAt: "2026-03-05", color: "#3B82F6" },
    { id: "f-3", name: "Gaming Highlights", clipCount: 22, createdAt: "2026-03-10", color: "#A855F7" },
  ],
  selectedFolderId = null,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onMoveClipsToFolder,
  selectedClipIds = [],
}: FolderManagerProps) {
  const [folders, setFolders] = useState<ProjectFolder[]>(initialFolders);
  const [activeFolder, setActiveFolder] = useState<string | null>(selectedFolderId);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: ProjectFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      clipCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      color: "#00E58F",
    };

    setFolders((prev) => [...prev, newFolder]);
    onCreateFolder?.(newFolderName.trim());
    setNewFolderName("");
    setIsCreating(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (activeFolder === id) {
      setActiveFolder(null);
      onSelectFolder?.(null);
    }
    onDeleteFolder?.(id);
  };

  const handleSelect = (id: string | null) => {
    setActiveFolder(id);
    onSelectFolder?.(id);
  };

  return (
    <div className="w-full bg-surface/50 border border-white/5 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-brand" />
          <h3 className="text-white font-bold text-sm tracking-wide">Project Folders</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5 text-brand" />
          New Folder
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="flex items-center gap-2 mb-4 bg-white/5 p-2 rounded-xl">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name (e.g. Highlights)"
            className="flex-1 bg-input px-3 py-1.5 rounded-lg text-xs text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:border-brand"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-brand text-black rounded-lg text-xs font-bold hover:bg-brand-hover transition-colors"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="px-2 py-1.5 text-xs text-white/50 hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
            activeFolder === null
              ? "border-brand/40 bg-brand/10 text-white"
              : "border-white/5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Folder className="w-4 h-4 text-brand shrink-0" />
            <span className="text-xs font-medium truncate">All Clips</span>
          </div>
        </button>

        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => handleSelect(folder.id)}
            className={`group relative flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              activeFolder === folder.id
                ? "border-brand/40 bg-brand/10 text-white"
                : "border-white/5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Folder className="w-4 h-4 shrink-0" style={{ color: folder.color || "#00E58F" }} />
              <div className="truncate">
                <span className="block text-xs font-medium truncate">{folder.name}</span>
                <span className="block text-[10px] text-white/40">{folder.clipCount} clips</span>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {selectedClipIds.length > 0 && (
                <button
                  type="button"
                  title="Move selected clips here"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveClipsToFolder?.(folder.id, selectedClipIds);
                  }}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white"
                >
                  <Move className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleDelete(folder.id, e)}
                className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
