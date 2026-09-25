import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ClipComparisonView from "@/components/projects/ClipComparisonView";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";
import type { Clip } from "@/components/projects/ClipGrid";

const mockClips: Clip[] = [
  {
    id: "clip-1",
    title: "Viral Alpha Hook",
    thumbnail: "/thumb1.jpg",
    score: 90,
    scoreKey: "high",
    duration: "0:30",
    style: "Bold & Dynamic",
    status: "ready",
    resolution: "1080x1920",
    videoUrl: "/video1.mp4",
  },
  {
    id: "clip-2",
    title: "Viral Beta Hook",
    thumbnail: "/thumb2.jpg",
    score: 82,
    scoreKey: "high",
    duration: "0:35",
    style: "Minimalist",
    status: "ready",
    resolution: "1080x1920",
    videoUrl: "/video2.mp4",
  },
  {
    id: "clip-3",
    title: "Viral Gamma Hook",
    thumbnail: "/thumb3.jpg",
    score: 78,
    scoreKey: "medium",
    duration: "0:25",
    style: "Anime",
    status: "ready",
    resolution: "1080x1920",
    videoUrl: "/video3.mp4",
  },
];

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("ClipComparisonView component", () => {
  beforeEach(() => {
    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it("renders 3 clips side-by-side with synchronized control bar", () => {
    renderWithI18n(
      <ClipComparisonView clips={mockClips} onClose={jest.fn()} />
    );

    expect(screen.getByText("Viral Alpha Hook")).toBeInTheDocument();
    expect(screen.getByText("Viral Beta Hook")).toBeInTheDocument();
    expect(screen.getByText("Viral Gamma Hook")).toBeInTheDocument();
    expect(screen.getByText("3 Clips Selected")).toBeInTheDocument();
  });

  it("handles master synchronized play/pause toggle", () => {
    renderWithI18n(
      <ClipComparisonView clips={mockClips} onClose={jest.fn()} />
    );

    const playBtn = screen.getByLabelText("Play All");
    expect(playBtn).toBeInTheDocument();

    fireEvent.click(playBtn);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("allows scoring clips and toggling winner badge", () => {
    const handleWinner = jest.fn();
    renderWithI18n(
      <ClipComparisonView
        clips={mockClips}
        onClose={jest.fn()}
        onSelectWinner={handleWinner}
      />
    );

    const winnerBtns = screen.getAllByLabelText("Mark as Winner");
    expect(winnerBtns.length).toBeGreaterThan(0);

    fireEvent.click(winnerBtns[0]);
    expect(handleWinner).toHaveBeenCalledWith("clip-1");
  });

  it("filters by winner when Winner Only filter is clicked", () => {
    renderWithI18n(
      <ClipComparisonView clips={mockClips} onClose={jest.fn()} />
    );

    // Mark clip-1 as winner
    const winnerBtns = screen.getAllByLabelText("Mark as Winner");
    fireEvent.click(winnerBtns[0]);

    // Click Winners Only filter
    const winnersOnlyBtn = screen.getByText("Winners Only");
    fireEvent.click(winnersOnlyBtn);

    // Only clip 1 should be displayed now
    expect(screen.getByText("Viral Alpha Hook")).toBeInTheDocument();
    expect(screen.queryByText("Viral Beta Hook")).not.toBeInTheDocument();
  });

  it("displays fallback message if less than 2 clips provided", () => {
    renderWithI18n(
      <ClipComparisonView clips={[mockClips[0]]} onClose={jest.fn()} />
    );

    expect(
      screen.getByText("Select at least 2 clips to compare")
    ).toBeInTheDocument();
  });
});
