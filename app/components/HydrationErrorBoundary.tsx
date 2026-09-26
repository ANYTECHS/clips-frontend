"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface HydrationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface HydrationErrorBoundaryProps {
  children: React.ReactNode;
  /** Short label identifying the island, used in the fallback message and error tags. */
  sectionName: string;
  fallback?: React.ReactNode;
}

/**
 * Scoped error boundary for a progressively-hydrated island.
 *
 * Deferring hydration (see ProgressiveHydrate) means a section mounts well
 * after the initial page render, often triggered by scroll or idle time —
 * an error there should never take down content the user is already reading.
 * Reports to Sentry tagged with `section` so hydration failures can be
 * distinguished from top-level render errors, and offers an inline retry
 * that only remounts the failed section.
 *
 * @example
 * <HydrationErrorBoundary sectionName="wallet-health-card">
 *   <ProgressiveHydrate strategy="visible" fallback={<Skeleton />}>
 *     <WalletHealthCard publicKey={publicKey} />
 *   </ProgressiveHydrate>
 * </HydrationErrorBoundary>
 */
export default class HydrationErrorBoundary extends React.Component<
  HydrationErrorBoundaryProps,
  HydrationErrorBoundaryState
> {
  state: HydrationErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): Partial<HydrationErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag("section", this.props.sectionName);
      scope.setTag("errorType", "hydration");
      scope.setExtras({ componentStack: errorInfo.componentStack });
      Sentry.captureException(error);
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-surface border border-error/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="w-6 h-6 text-error" />
          <p className="text-sm text-muted-foreground">
            This section ({this.props.sectionName}) failed to load.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 rounded-lg bg-error/10 hover:bg-error/20 text-error border border-error/20 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
