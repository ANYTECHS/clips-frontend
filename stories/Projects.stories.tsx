import type { Meta, StoryObj } from "@storybook/nextjs";
import React, { useState } from "react";
import ClipGrid from "../components/projects/ClipGrid";
import ProjectFilters from "../components/projects/ProjectFilters";
import SelectionFooter from "../components/projects/SelectionFooter";
import ClipEditorModal from "../components/projects/ClipEditorModal";
import ClipPreviewModal from "../components/projects/ClipPreviewModal";

const meta = {
  title: "Projects/Components",
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-8 text-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

const mockClips = [
  { id: "1", title: "Clip #01 - The Big Reveal Hook", thumbnail: "/projects/thumb1.png", score: 94, scoreKey: "high", duration: "00:45", style: "Bold & Dynamic", status: "pending", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { id: "2", title: "Clip #02 - Technical Deep Dive", thumbnail: "/projects/thumb2.png", score: 68, scoreKey: "medium", duration: "00:58", style: "Minimalist", status: "listed", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
  { id: "3", title: "Clip #03 - Audience Reaction", thumbnail: "/projects/thumb3.png", score: 82, scoreKey: "high", duration: "00:32", style: "Emoji-Rich", status: "pending", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
  { id: "4", title: "Clip #04 - Feature Walkthrough", thumbnail: "/projects/thumb1.png", score: 42, scoreKey: "low", duration: "01:12", style: "Subtitles Only", status: "history", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
];

export const GridDefault: StoryObj = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [aiRecommendations, setAiRecommendations] = useState(false);

    return (
      <ClipGrid
        clips={mockClips}
        selectedIds={selectedIds}
        onSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
        onSelectAll={() => setSelectedIds(mockClips.map(c => c.id))}
        onSelectNone={() => setSelectedIds([])}
        onSelectByScore={(min) => setSelectedIds(mockClips.filter(c => c.score >= min).map(c => c.id))}
        aiRecommendations={aiRecommendations}
        recommendedIds={mockClips.filter(c => c.score >= 90).map(c => c.id)}
        recommendationThreshold={90}
        onToggleRecommendations={() => setAiRecommendations(!aiRecommendations)}
        onAutoSelect={() => setSelectedIds(mockClips.filter(c => c.score >= 90).map(c => c.id))}
        onEdit={() => {}}
        onPreview={() => {}}
        loading={false}
        totalClips={mockClips.length}
        loadingNextPage={false}
        onLoadMore={() => {}}
        hasMore={false}
      />
    );
  }
};

export const GridLoading: StoryObj = {
  render: () => (
    <ClipGrid
      clips={[]}
      selectedIds={[]}
      onSelect={() => {}}
      onSelectAll={() => {}}
      onSelectNone={() => {}}
      onSelectByScore={() => {}}
      aiRecommendations={false}
      recommendedIds={[]}
      recommendationThreshold={90}
      onToggleRecommendations={() => {}}
      onAutoSelect={() => {}}
      onEdit={() => {}}
      onPreview={() => {}}
      loading={true}
      totalClips={0}
      loadingNextPage={false}
      onLoadMore={() => {}}
      hasMore={false}
    />
  )
};

export const GridEmpty: StoryObj = {
  render: () => (
    <ClipGrid
      clips={[]}
      selectedIds={[]}
      onSelect={() => {}}
      onSelectAll={() => {}}
      onSelectNone={() => {}}
      onSelectByScore={() => {}}
      aiRecommendations={false}
      recommendedIds={[]}
      recommendationThreshold={90}
      onToggleRecommendations={() => {}}
      onAutoSelect={() => {}}
      onEdit={() => {}}
      onPreview={() => {}}
      loading={false}
      totalClips={0}
      loadingNextPage={false}
      onLoadMore={() => {}}
      hasMore={false}
    />
  )
};

export const Filters: StoryObj = {
  render: () => {
    const [captionsStyle, setCaptionsStyle] = useState("All Styles");
    const [viralityLevels, setViralityLevels] = useState(["high", "medium", "low"]);
    const [vaultFilter, setVaultFilter] = useState("pending");

    return (
      <div className="w-64 bg-background p-6">
        <ProjectFilters
          captionsStyle={captionsStyle}
          onCaptionsStyleChange={setCaptionsStyle}
          viralityLevels={viralityLevels}
          onViralityLevelToggle={(level) => setViralityLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level])}
          activeFilterCount={3}
          onResetFilters={() => {
            setCaptionsStyle("All Styles");
            setViralityLevels(["high", "medium", "low"]);
            setVaultFilter("pending");
          }}
          vaultFilter={vaultFilter}
          onVaultFilterChange={setVaultFilter}
        />
      </div>
    );
  }
};

export const SelectionFooterActive: StoryObj = {
  render: () => (
    <div className="relative min-h-[200px] w-full">
      <SelectionFooter
        count={2}
        selectedIds={["1", "2"]}
        onMint={() => {}}
        isMinting={false}
        undo={() => {}}
        redo={() => {}}
        canUndo={true}
        canRedo={false}
      />
    </div>
  )
};

export const EditorModal: StoryObj = {
  render: () => (
    <ClipEditorModal
      clip={mockClips[0]}
      onClose={() => {}}
      onSave={() => {}}
    />
  )
};

export const PreviewModal: StoryObj = {
  render: () => (
    <ClipPreviewModal
      clip={mockClips[0]}
      onClose={() => {}}
    />
  )
};
