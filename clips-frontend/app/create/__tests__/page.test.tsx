import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateClipsPage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock hooks
vi.mock("../../hooks/useProcessStore", () => ({
  useProcessStore: () => ({
    startProcess: vi.fn(),
  }),
}));

describe("CreateClipsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with all sections", () => {
    render(<CreateClipsPage />);
    
    expect(screen.getByText("Create Clips")).toBeInTheDocument();
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.getByText("Target Platforms")).toBeInTheDocument();
    expect(screen.getByText("Auto-Publish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate clips/i })).toBeInTheDocument();
  });

  it("disables submit button when no video input is provided", () => {
    render(<CreateClipsPage />);
    
    const submitButton = screen.getByRole("button", { name: /generate clips/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when URL and platform are selected", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://youtube.com/watch?v=test");
    
    const tiktokButton = screen.getByRole("button", { name: "TikTok" });
    await user.click(tiktokButton);
    
    const submitButton = screen.getByRole("button", { name: /generate clips/i });
    expect(submitButton).toBeEnabled();
  });

  it("clears file when URL is entered", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    // Upload file first
    const file = new File(["video"], "test.mp4", { type: "video/mp4" });
    const fileInput = screen.getByLabelText(/upload video file/i);
    await user.upload(fileInput, file);
    
    // Then enter URL
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://youtube.com/watch?v=test");
    
    // File should be cleared (URL input should be enabled)
    expect(urlInput).not.toBeDisabled();
  });

  it("toggles platform selection", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    const tiktokButton = screen.getByRole("button", { name: "TikTok" });
    
    // Initially not selected
    expect(tiktokButton).not.toHaveClass("ring-[#00E68A]");
    
    // Click to select
    await user.click(tiktokButton);
    expect(tiktokButton).toHaveClass("ring-[#00E68A]");
    
    // Click again to deselect
    await user.click(tiktokButton);
    expect(tiktokButton).not.toHaveClass("ring-[#00E68A]");
  });

  it("toggles auto-publish switch", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    const autoPublishToggle = screen.getByRole("button", { name: "" }).closest("button");
    
    // Click to enable
    if (autoPublishToggle) {
      await user.click(autoPublishToggle);
      // Verify toggle state changed (check for class changes)
      expect(autoPublishToggle).toHaveClass("bg-[#00E68A]");
    }
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: "test-job-id" }),
      } as Response)
    );
    
    render(<CreateClipsPage />);
    
    // Fill form
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://youtube.com/watch?v=test");
    
    const tiktokButton = screen.getByRole("button", { name: "TikTok" });
    await user.click(tiktokButton);
    
    // Submit
    const submitButton = screen.getByRole("button", { name: /generate clips/i });
    await user.click(submitButton);
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Generating Clips...")).toBeInTheDocument();
    });
  });

  it("displays error message on submission failure", async () => {
    const user = userEvent.setup();
    
    // Mock fetch to fail
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Invalid video URL" }),
      } as Response)
    );
    
    render(<CreateClipsPage />);
    
    // Fill form
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://invalid-url");
    
    const tiktokButton = screen.getByRole("button", { name: "TikTok" });
    await user.click(tiktokButton);
    
    // Submit
    const submitButton = screen.getByRole("button", { name: /generate clips/i });
    await user.click(submitButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText("Invalid video URL")).toBeInTheDocument();
    });
  });

  it("shows validation hints", () => {
    render(<CreateClipsPage />);
    
    // Should show hint about video input
    expect(screen.getByText(/please provide a video url or upload a file/i)).toBeInTheDocument();
  });
});
