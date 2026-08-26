import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StylePicker } from "@/components/transform/StylePicker";
import { TRANSFORM_STYLES } from "@/app/lib/transformStyles";

describe("StylePicker (issue #802)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches from GET /api/transform/styles and renders every returned style", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: TRANSFORM_STYLES, error: null }),
    }) as unknown as typeof fetch;

    render(<StylePicker />);

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /select a transformation style/i })).toBeInTheDocument();
    });

    for (const style of TRANSFORM_STYLES) {
      expect(screen.getByText(style.label)).toBeInTheDocument();
    }

    expect(fetch).toHaveBeenCalledWith("/api/transform/styles");
    expect(screen.getAllByRole("button")).toHaveLength(TRANSFORM_STYLES.length);
  });

  it("shows an error state with a retry button when the request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    render(<StylePicker />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/failed to load styles/i)).toBeInTheDocument();
  });

  it("shows an empty state when the API returns no styles", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], error: null }),
    }) as unknown as typeof fetch;

    render(<StylePicker />);

    await waitFor(() => {
      expect(screen.getByText(/no styles available/i)).toBeInTheDocument();
    });
  });
});
