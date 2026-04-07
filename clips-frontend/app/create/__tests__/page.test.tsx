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
    expect(screen.getByText("Auto-generate clips")).toBeInTheDocument();
    expect(screen.getByText(/estimated processing time/i)).toBeInTheDocument();
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

  it("disables the URL input when a file is selected", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    const file = new File(["video"], "test.mp4", { type: "video/mp4" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    if (!fileInput) {
      throw new Error("Expected hidden file input to exist");
    }
    await user.upload(fileInput, file);
    
    const urlInput = screen.getByLabelText("Video URL");
    expect(urlInput).toBeDisabled();
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

  it("toggles auto-generate switch with keyboard support", async () => {
    const user = userEvent.setup();
    render(<CreateClipsPage />);
    
    const autoGenerateToggle = screen.getByRole("switch", { name: /auto-generate clips/i });
    expect(autoGenerateToggle).toHaveAttribute("aria-checked", "false");

    await user.click(autoGenerateToggle);
    expect(autoGenerateToggle).toHaveClass("bg-[#00E68A]");
    expect(autoGenerateToggle).toHaveAttribute("aria-checked", "true");

    autoGenerateToggle.focus();
    await user.keyboard("[Space]");
    expect(autoGenerateToggle).toHaveAttribute("aria-checked", "false");
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
