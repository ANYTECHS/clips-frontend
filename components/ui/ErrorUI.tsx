"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorUI({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = error.digest || Sentry.captureException(error);

  useEffect(() => {
    if (!error.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          An unexpected error occurred. Please try again, or contact support if
          the problem persists.
        </p>
      </div>
      {errorId && (
        <p className="text-xs text-muted-foreground">
          Error ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{errorId}</code>
        </p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}
