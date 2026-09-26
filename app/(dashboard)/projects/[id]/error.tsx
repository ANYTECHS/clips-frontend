"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import React, { useEffect } from "react";

import { FAILURE_MESSAGES } from "@/app/lib/errorMessages";
import { logger } from "@/app/lib/logger";

export default function ProjectDetailError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Project streaming error:", error);
  }, [error]);

  return (
    <div className="text-center py-20 max-w-[1400px] mx-auto w-full">
      <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Project not found or failed to load</h2>
      <p className="text-muted text-sm mb-6">{FAILURE_MESSAGES.loadProject}</p>
      <Link
        href="/projects"
        className="inline-block px-5 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors"
      >
        Back to Projects
      </Link>
    </div>
  );
}
