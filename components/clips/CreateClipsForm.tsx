"use client";

import React, { useState } from "react";
import { Upload, Link, Loader2 } from "lucide-react";

/**
 * Form for creating video clips via URL or file upload.
 * Supports both URL-based video import and direct file upload.
 * Sends the video to /api/upload for processing.
 */
export default function CreateClipsForm() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload video");
      }

      const data = await response.json();
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload video");
      }

      const data = await response.json();
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
      <h2 className="text-xl font-semibold text-white">Create New Clips</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <Link className="w-5 h-5 text-brand" />
          <span className="text-sm font-medium text-muted-foreground">Paste video URL</span>
        </div>

        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(0,230,138,0.35)] transition hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Generate Clips
              </>
            )}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <Upload className="w-5 h-5 text-brand" />
          <span className="text-sm font-medium text-muted-foreground">Or upload a file</span>
        </div>

        <form onSubmit={handleFileSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand file:text-black file:text-sm file:font-semibold hover:file:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent transition"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload File"
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
