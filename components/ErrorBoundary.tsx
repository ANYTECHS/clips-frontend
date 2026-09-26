"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import ErrorUI from "./ui/ErrorUI";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  private reportError = (
    error: unknown,
    errorInfo?: React.ErrorInfo,
    source = "ErrorBoundary",
  ) => {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown error");

    Sentry.withScope((scope) => {
      scope.setTag("boundary", source);
      if (errorInfo?.componentStack) {
        scope.setExtra("componentStack", errorInfo.componentStack);
      }
      Sentry.captureException(err);
    });
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.reportError(error, errorInfo, "componentDidCatch");
  }

  componentDidMount() {
    if (typeof window === "undefined") return;

    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;

    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );
  }

  handleWindowError = (event: ErrorEvent) => {
    if (event.error) {
      this.reportError(event.error, undefined, "window.error");
    }
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    this.reportError(reason, undefined, "unhandledrejection");
  };

  handleReset = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
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
