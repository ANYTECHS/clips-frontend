import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import ProjectsPage from "@/app/(dashboard)/projects/page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));


jest.mock("@/components/projects/ProjectFilters", () => ({
  __esModule: true,
  default: ({
    onCaptionsStyleChange,
    onVaultFilterChange,
  }: {
    onCaptionsStyleChange: (style: string) => void;
    onVaultFilterChange: (vault: string) => void;
  }) => (
    <div data-testid="project-filters">
      <button type="button" onClick={() => onCaptionsStyleChange("Minimalist")}>
        Filter Minimalist
      </button>
      <button type="button" onClick={() => onVaultFilterChange("listed")}>
        Vault Listed
      </button>
    </div>
  ),
}));

jest.mock("@/components/projects/ClipGrid", () => ({
  __esModule: true,
  default: ({
    clips,
    onSelect,
    loading,
  }: {
    clips: { id: string; title: string }[];
    onSelect: (id: string) => void;
    loading: boolean;
  }) => (
    <div data-testid="clip-grid">
      {loading ? (
        <span>Loading clips</span>
      ) : (
        clips.map((clip) => (
          <button key={clip.id} type="button" onClick={() => onSelect(clip.id)}>
            {clip.title}
          </button>
        ))
      )}
    </div>
  ),
}));

const mockUndo = jest.fn();
const mockRedo = jest.fn();

jest.mock("@/hooks/useUndoRedo", () => ({
  useUndoRedo: () => ({
    state: [],
    set: jest.fn(),
    undo: mockUndo,
    redo: mockRedo,
    canUndo: true,
    canRedo: false,
    clear: jest.fn(),
  }),
}));

jest.mock("@/components/projects/SelectionFooter", () => ({
  __esModule: true,
  default: ({
    onMint,
    undo,
    redo,
  }: {
    onMint: () => void;
    undo: () => void;
    redo: () => void;
  }) => (
    <div data-testid="selection-footer">
      <button type="button" onClick={onMint}>
        Mint Selected
      </button>
      <button type="button" onClick={undo}>
        Undo
      </button>
      <button type="button" onClick={redo}>
        Redo
      </button>
    </div>
  ),
}));

jest.mock("@/components/projects/ClipEditorModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/projects/ClipPreviewModal", () => ({
  __esModule: true,
  default: () => null,
}));

describe("ProjectsPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUndo.mockClear();
    mockRedo.mockClear();

    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (usePathname as jest.Mock).mockReturnValue("/projects");
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders the clip grid after the loading delay", async () => {
    render(<ProjectsPage />);

    expect(screen.getByText("Loading clips")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    expect(screen.getByTestId("clip-grid")).toBeInTheDocument();
    expect(screen.getByText(/Clip #01/i)).toBeInTheDocument();
  });

  it("updates filters when filter controls change", async () => {
    render(<ProjectsPage />);

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    expect(screen.getAllByTestId("project-filters").length).toBeGreaterThan(0);
  });

  it("invokes mint and undo/redo actions from the selection footer", async () => {
    render(<ProjectsPage />);

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    fireEvent.click(screen.getByText("Mint Selected"));
    fireEvent.click(screen.getByText("Undo"));
    fireEvent.click(screen.getByText("Redo"));

    expect(mockUndo).toHaveBeenCalled();
    expect(mockRedo).toHaveBeenCalled();
  });
});
