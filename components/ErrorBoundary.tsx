"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import ErrorUI from "./ui/ErrorUI";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Catches rendering errors in its child tree and displays a fallback UI.
 * Reports errors to Sentry automatically.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <DashboardContent />
 * </ErrorBoundary>
 * ```
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setExtras({ componentStack: errorInfo.componentStack });
      Sentry.captureException(error);
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorUI
          error={this.state.error ?? new Error("Unknown error")}
          reset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
