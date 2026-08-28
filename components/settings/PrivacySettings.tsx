"use client";

import React, { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/useToast";

/**
 * Privacy settings panel for controlling explore visibility and username display.
 * Loads current settings on mount and saves changes via PATCH to /api/user/privacy.
 */
export default function PrivacySettings() {
  const { showToast } = useToast();
  const [exploreOptIn, setExploreOptIn] = useState(false);
  const [showUsername, setShowUsername] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/privacy")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setExploreOptIn(json.data.exploreOptIn);
          setShowUsername(json.data.showUsername);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (update: { exploreOptIn?: boolean; showUsername?: boolean }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Privacy settings updated", "success");
    } catch {
      showToast("Failed to update privacy settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-white">Privacy</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Control how your clips appear on the public Explore page.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-semibold text-white">Show clips on Explore</p>
          <p className="text-xs text-muted-foreground">
            Opt in to have your public clips featured on the trending feed.
          </p>
        </div>
        <input
          type="checkbox"
          checked={exploreOptIn}
          disabled={saving}
          onChange={(e) => {
            setExploreOptIn(e.target.checked);
            save({ exploreOptIn: e.target.checked });
          }}
          className="w-5 h-5 rounded border-white/20 accent-brand"
        />
      </label>

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-semibold text-white">Show username</p>
          <p className="text-xs text-muted-foreground">
            When disabled, your clips appear as &quot;Anonymous Creator&quot; on Explore.
          </p>
        </div>
        <input
          type="checkbox"
          checked={showUsername}
          disabled={saving || !exploreOptIn}
          onChange={(e) => {
            setShowUsername(e.target.checked);
            save({ showUsername: e.target.checked });
          }}
          className="w-5 h-5 rounded border-white/20 accent-brand disabled:opacity-40"
        />
      </label>
    </div>
  );
}
