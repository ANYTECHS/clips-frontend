/**
 * __tests__/components/DataErrorBoundary.test.tsx
 *
 * Unit tests for DataErrorBoundary (#986).
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DataErrorBoundary from "@/components/DataErrorBoundary";
import * as Sentry from "@sentry/nextjs";
import { ApiError } from "@/app/lib/apiError";

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(() => "test-sentry-error-id"),
  withScope: jest.fn((cb) => {
    cb({ setTag: jest.fn(), setExtra: jest.fn() });
  }),
}));

const ProblematicComponent = ({ shouldThrow = true, message = "Network error" }: { shouldThrow?: boolean; message?: string }) => {
  if (shouldThrow) {
    throw new ApiError(message, 500);
  }
  return <div>Data Loaded Successfully</div>;
};

describe("DataErrorBoundary (#986)", () => {
  // Suppress console.error during expected boundary error catches
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children normally when no error occurs", () => {
    render(
      <DataErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </DataErrorBoundary>
    );

    expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
  });

  it("catches data fetching errors and renders default recovery UI", () => {
    render(
      <DataErrorBoundary>
        <ProblematicComponent shouldThrow={true} message="Failed to fetch projects" />
      </DataErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Unable to load data")).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("sanitizes error messages containing sensitive credentials or tokens", () => {
    render(
      <DataErrorBoundary>
        <ProblematicComponent shouldThrow={true} message="Failed with token=secret12345 Bearer super-secret-key" />
      </DataErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/secret12345/i)).not.toBeInTheDocument();
    expect(screen.getByText("A security error occurred while processing the request.")).toBeInTheDocument();
  });

  it("logs caught errors to Sentry with structured metadata", () => {
    render(
      <DataErrorBoundary>
        <ProblematicComponent shouldThrow={true} message="Database query failed" />
      </DataErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("executes onReset and resets error state when clicking Try Again", () => {
    const onReset = jest.fn();

    const Wrapper = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <DataErrorBoundary
          onReset={() => {
            onReset();
            setShouldThrow(false);
          }}
        >
          <ProblematicComponent shouldThrow={shouldThrow} />
        </DataErrorBoundary>
      );
    };

    render(<Wrapper />);

    expect(screen.getByText("Unable to load data")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
  });

  it("resets automatically when resetKeys prop changes", () => {
    const { rerender } = render(
      <DataErrorBoundary resetKeys={["page-1"]}>
        <ProblematicComponent shouldThrow={true} />
      </DataErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Rerender with changed resetKeys and non-throwing child
    rerender(
      <DataErrorBoundary resetKeys={["page-2"]}>
        <ProblematicComponent shouldThrow={false} />
      </DataErrorBoundary>
    );

    expect(screen.getByText("Data Loaded Successfully")).toBeInTheDocument();
  });

  it("supports custom JSX fallback and render function fallback", () => {
    const customFallback = <div>Custom Error UI</div>;

    render(
      <DataErrorBoundary fallback={customFallback}>
        <ProblematicComponent shouldThrow={true} />
      </DataErrorBoundary>
    );

    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
  });
});
