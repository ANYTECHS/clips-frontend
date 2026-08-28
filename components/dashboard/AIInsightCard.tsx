"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";

interface Insight {
  id: string;
  text: string;
  createdAt: string;
}

/**
 * Displays AI-generated insights for the user's content.
 * Handles loading, empty, error, and API-not-available states gracefully.
 * Falls back to a "Coming soon" message if the insights API returns 404.
 */
export default function AIInsightCard() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiExists, setApiExists] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch("/api/insights");
        
        if (response.status === 404) {
          setApiExists(false);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch insights");
        }

        const data = await response.json();
        setInsights(data.insights || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            AI Insights
          </span>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!apiExists) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            AI Insights
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            AI Insights
          </span>
        </div>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load insights</span>
        </div>
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            AI Insights
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No insights yet — upload a video to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-brand" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          AI Insights
        </span>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-3 bg-white/5 rounded-lg border border-white/5"
          >
            <p className="text-sm text-white">{sanitize(insight.text)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
