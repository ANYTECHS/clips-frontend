'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function BrandHeader() {
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 bg-surface/50 backdrop-blur-sm border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="text-white font-semibold text-lg">ClipCash</span>
      </div>
    </header>
  );
}

export default function RootError({ error, reset }: RootErrorProps) {
  const errorId = error.digest || Sentry.captureException(error);

  React.useEffect(() => {
    if (!error.digest) {
      Sentry.captureException(error);
    }
  }, [error, error.digest]);

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col relative overflow-hidden">
      <BrandHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative z-10">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              An unexpected error occurred. Please try again, or contact support if the problem persists.
            </p>
          </div>

          {errorId && (
            <p className="text-xs text-muted-foreground">
              Error ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{errorId}</code>
            </p>
          )}

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </main>
    </div>
  );
}
