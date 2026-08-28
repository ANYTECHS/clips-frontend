"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertCircle, RefreshCw } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";

interface DataErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export interface DataErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback component or render function. */
  fallback?:
    | React.ReactNode
    | ((props: { error: Error; resetErrorBoundary: () => void }) => React.ReactNode);
  /** Callback triggered when the user clicks 'Try Again' or when resetKeys change. */
  onReset?: () => void;
  /** Custom error handler callback. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Array of values (e.g. [page, filter]) that trigger a automatic boundary reset when modified. */
  resetKeys?: Array<unknown>;
}

/**
 * Sanitize an error message to prevent accidental exposure of credentials, tokens, or stack traces.
 */
function getSanitizedErrorMessage(error: Error | null): string {
  if (!error) return "An error occurred while loading data.";
  let msg = error.message || "An unexpected error occurred.";

  // Strip potential tokens, secrets, or internal server paths
  if (msg.includes("Bearer ") || msg.includes("token=") || msg.includes("secret")) {
    msg = "A security error occurred while processing the request.";
  }

  // Remove potential internal file paths or stack references
  msg = msg.split("\n")[0];
  return sanitize(msg);
}

/**
 * DataErrorBoundary catches data fetching errors during component rendering,
 * logs structured error details to Sentry, and presents a recovery UI.
 */
export default class DataErrorBoundary extends React.Component<
  DataErrorBoundaryProps,
  DataErrorBoundaryState
> {
  state: DataErrorBoundaryState = {
    hasError: false,
    error: null,
    errorId: null,
  };

  static getDerivedStateFromError(error: Error): Partial<DataErrorBoundaryState> {
    const errorId = Sentry.captureException(error, {
      tags: { category: "data-fetching" },
    });
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    Sentry.withScope((scope) => {
      scope.setTag("category", "data-fetching");
      scope.setExtra("componentStack", errorInfo.componentStack);
      Sentry.captureException(error);
    });
  }

  componentDidUpdate(prevProps: DataErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys ?? [];
      const currentKeys = this.props.resetKeys;
      const keysChanged =
        prevKeys.length !== currentKeys.length ||
        currentKeys.some((key, idx) => key !== prevKeys[idx]);

      if (keysChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const safeMessage = getSanitizedErrorMessage(this.state.error);

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center p-6 text-center rounded-xl bg-surface/50 border border-white/10 backdrop-blur-md shadow-lg my-4 gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div className="space-y-1 max-w-md">
            <h3 className="text-base font-semibold text-foreground">
              Unable to load data
            </h3>
            <p className="text-xs text-muted-foreground">{safeMessage}</p>
            {this.state.errorId && (
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                Error Reference: {this.state.errorId}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={this.resetErrorBoundary}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
