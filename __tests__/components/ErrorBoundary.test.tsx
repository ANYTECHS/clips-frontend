import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import * as Sentry from "@sentry/nextjs";

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  withScope: jest.fn((callback) => callback({ setExtras: jest.fn() })),
}));

class ThrowError extends React.Component {
  componentDidMount() {
    throw new Error("Test error");
  }

  render() {
    return <div>Should not render</div>;
  }
}

function FailingComponent() {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("catches errors thrown in child components and renders fallback", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("catches errors thrown in componentDidMount and renders fallback", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("displays error ID when Sentry returns one", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (Sentry.captureException as jest.Mock).mockReturnValue("test-error-id-123");

    render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error ID:")).toBeInTheDocument();
    expect(screen.getByText("test-error-id-123")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("resets error state when retry button is clicked", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    const retryButton = screen.getByText("Try Again");
    retryButton.click();

    // After reset, children should render again
    rerender(
      <ErrorBoundary>
        <div>Recovered content</div>
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
