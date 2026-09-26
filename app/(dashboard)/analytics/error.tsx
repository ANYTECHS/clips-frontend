"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import React, { useEffect } from "react";

import { FAILURE_MESSAGES } from "@/app/lib/errorMessages";
import { logger } from "@/app/lib/logger";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Analytics streaming error:", error);
  }, [error]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-error/30 rounded-2xl">
        <AlertCircle className="w-12 h-12 text-error mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Failed to load analytics</h2>
        <p className="text-muted text-sm max-w-md mb-6">{FAILURE_MESSAGES.loadAnalytics}</p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-error/10 text-error font-bold hover:bg-error/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    </div>
  );
}
