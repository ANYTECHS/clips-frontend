"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ClipGrid, { type Clip } from "@/components/projects/ClipGrid";
import SelectionFooter from "@/components/projects/SelectionFooter";
import ClipEditorModal, { type ClipEdits } from "@/components/projects/ClipEditorModal";
import ClipPreviewModal from "@/components/projects/ClipPreviewModal";
import { BatchTransformModal } from "@/components/transform/BatchTransformModal";
import { BatchTransformQueue } from "@/components/transform/BatchTransformQueue";
import { X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useFilterQueryState } from "@/hooks/useFilterQueryState";
import { useBatchTransform } from "@/app/hooks/useBatchTransform";
import { useUserStore, selectUserPlan } from "@/app/store/userStore";

const RECOMMENDATION_THRESHOLD = 90;

export default function ProjectsPage() {
  const { showToast, ToastEl } = useToast();
  const userPlan = useUserStore(selectUserPlan);
  const { 
    state: selectedIds, 
    set: setSelectedIds, 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    clear 
  } = useUndoRedo<string[]>([], 50, {
    undoMessage: "Selection undone",
    redoMessage: "Selection redone"
  });
  
  const [loading, setLoading] = useState(true);
  const [isMinting, setIsMinting] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);

  const {
    batch: transformBatch,
    isSubmitting: isTransformSubmitting,
    submitError: transformSubmitError,
    completedCount: transformCompletedCount,
    totalCount: transformTotalCount,
    startBatch: startTransformBatch,
    cancelJob: cancelTransformJob,
    clearBatch: clearTransformBatch,
  } = useBatchTransform();

  const [fetchedClips, setFetchedClips] = useState<Clip[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { filters, updateFilters, resetFilters } = useFilterQueryState({
    style: "All Styles",
    virality: ["high", "medium", "low"],
    vault: "pending",
    page: 1,
  });

  const captionsStyle = filters.style;
  const viralityLevels = filters.virality;
  const vaultFilter = filters.vault;
  const currentPage = filters.page;
  const PAGE_SIZE = 20;
  const [loadingNextPage, setLoadingNextPage] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(false);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);

  // Fetch clips from API
  const fetchClips = useCallback(async (page: number, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingNextPage(true);
      
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", PAGE_SIZE.toString());
      if (vaultFilter !== "all") params.append("status", vaultFilter);
      if (captionsStyle !== "All Styles") params.append("style", captionsStyle);
      viralityLevels.forEach(v => params.append("virality", v));
      
      const res = await fetch(`/api/clips?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clips");
      
      const { data } = await res.json();
      
      if (append) {
        setFetchedClips(prev => [...prev, ...data.clips]);
      } else {
        setFetchedClips(data.clips);
      }
      setTotalClips(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setLoadingNextPage(false);
    }
  }, [vaultFilter, captionsStyle, viralityLevels, PAGE_SIZE]);

  useEffect(() => {
    fetchClips(1);
  }, [fetchClips]);

  // Clear undo/redo stack on navigate away
  useEffect(() => {
    return () => clear();
  }, [clear]);

  // Reset page to 1 whenever filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      updateFilters({ page: 1 });
    }
  }, [captionsStyle, viralityLevels, vaultFilter, updateFilters, currentPage]);

  const handleLoadMore = useCallback(() => {
    if (fetchedClips.length < totalClips && !loadingNextPage) {
      const nextPage = currentPage + 1;
      updateFilters({ page: nextPage });
      fetchClips(nextPage, true);
    }
  }, [fetchedClips.length, totalClips, loadingNextPage, currentPage, updateFilters, fetchClips]);

  const activeFilterCount = useMemo(() => {
    return (captionsStyle !== "All Styles" ? 1 : 0) + 
           (viralityLevels.length < 3 ? 1 : 0) + 
           (vaultFilter !== "pending" ? 1 : 0);
  }, [captionsStyle, viralityLevels, vaultFilter]);

  // Clips that score at or above the recommendation threshold
  const recommendedIds = useMemo(
    () => fetchedClips.filter(c => c.score >= RECOMMENDATION_THRESHOLD).map(c => c.id),
    [fetchedClips]
  );

  const handleAutoSelect = useCallback(() => {
    setSelectedIds(recommendedIds);
  }, [recommendedIds]);

  const handleToggleRecommendations = useCallback(() => {
    setAiRecommendations(prev => !prev);
  }, []);

  const handleViralityToggle = useCallback((level: string) => {
    const next = viralityLevels.includes(level)
      ? viralityLevels.filter(l => l !== level)
      : [...viralityLevels, level];
    updateFilters({ virality: next });
  }, [viralityLevels, updateFilters]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, [setSelectedIds]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.length === fetchedClips.length) {
        return [];
      } else {
        return fetchedClips.map(c => c.id);
      }
    });
  }, [fetchedClips, setSelectedIds]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  const handleSelectByScore = useCallback((minScore: number) => {
    const ids = fetchedClips.filter(c => c.score >= minScore).map(c => c.id);
    setSelectedIds(ids);
    showToast(`Selected ${ids.length} clip${ids.length !== 1 ? "s" : ""} with score ≥ ${minScore}`, "success");
  }, [fetchedClips, showToast, setSelectedIds]);

  const handleEdit = useCallback((id: string) => {
    const clip = fetchedClips.find(c => c.id === id);
    if (clip) setEditingClip(clip);
  }, [fetchedClips]);

  const handleSaveEdits = useCallback(async (id: string, edits: ClipEdits) => {
    if (edits.captions) {
      try {
        await fetch(`/api/clips/${id}/captions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: edits.captions.segments,
            style: edits.captions.style,
            language: edits.captions.language,
            burnIntoExport: edits.captions.burnIntoExport,
          }),
        });
      } catch {
        showToast("Failed to save captions", "error");
        return;
      }
    }
    showToast(`Edits saved for clip ${id}`, "success");
    setEditingClip(null);
  }, [showToast]);

  const handlePreview = useCallback((id: string) => {
    const clip = fetchedClips.find(c => c.id === id);
    if (clip) setPreviewClip(clip);
  }, [fetchedClips]);

  const handleMint = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    setIsMinting(true);
    try {
      const res = await fetch("/api/clips/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: selectedIds })
      });
      if (!res.ok) throw new Error("Failed to mint clips");
      
      showToast(`Successfully queued ${selectedIds.length} clip(s) for minting!`, "success");
      setSelectedIds([]); // Clear selection after successful mint
    } catch (error) {
      console.error("Minting failed", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to mint clips";
      showToast(errorMessage, "error");
    } finally {
      setIsMinting(false);
    }
  }, [selectedIds, setSelectedIds, showToast]);

  const handleOpenTransformModal = useCallback(() => {
    if (selectedIds.length === 0) return;
    setShowTransformModal(true);
  }, [selectedIds]);

  const handleTransformConfirm = useCallback(
    async (style: string) => {
      await startTransformBatch(selectedIds, style);
      setShowTransformModal(false);
      if (!transformSubmitError) {
        showToast(
          `Started ${selectedIds.length} AI transform job${selectedIds.length !== 1 ? "s" : ""}`,
          "success",
        );
        setSelectedIds([]);
      }
    },
    [selectedIds, startTransformBatch, transformSubmitError, showToast, setSelectedIds],
  );

  const handlePost = useCallback(async (clipIds: string[], platforms: string[]) => {
    setIsPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/clips/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Posting failed");
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        setPostError(`${data.failed.length} post${data.failed.length > 1 ? "s" : ""} failed`);
        data.failed.forEach((f: unknown) => console.warn(f));
      }
      if (Array.isArray(data.posted) && data.posted.length > 0) {
        showToast(`Posted ${data.posted.length} clip${data.posted.length > 1 ? "s" : ""} successfully`, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Posting failed";
      setPostError(msg);
      showToast(msg, "error");
    } finally {
      setIsPosting(false);
    }
  }, [showToast]);

  const handleDelete = useCallback(async (clipIds: string[]) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/clips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      const count = data?.data?.deletedCount ?? clipIds.length;
      showToast(`Deleted ${count} clip${count !== 1 ? "s" : ""}`, "success");
      setSelectedIds([]);
      // Deleted clips are filtered out server-side, so refetch rather than
      // trying to reconcile the list locally.
      await fetchClips(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setDeleteError(msg);
      showToast(msg, "error");
    } finally {
      setIsDeleting(false);
    }
  }, [fetchClips, setSelectedIds, showToast]);

  const handleArchive = useCallback(async (clipIds: string[]) => {
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch("/api/clips/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");

      const count = data?.data?.archivedCount ?? clipIds.length;
      showToast(`Archived ${count} clip${count !== 1 ? "s" : ""}`, "success");
      setSelectedIds([]);
      await fetchClips(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Archive failed";
      setArchiveError(msg);
      showToast(msg, "error");
    } finally {
      setIsArchiving(false);
    }
  }, [fetchClips, setSelectedIds, showToast]);

  return (
    <>
      {/* Mobile Filter Drawer Overlay */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Mobile Filter Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-background border-r border-white/5 py-10 pl-8 transition-transform duration-300 lg:hidden ${
        mobileFiltersOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <button
          onClick={() => setMobileFiltersOpen(false)}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white transition-colors"
          aria-label="Close filters"
        >
          <X className="w-5 h-5" />
        </button>
        <ProjectFilters
          captionsStyle={captionsStyle}
          onCaptionsStyleChange={(style) => updateFilters({ style })}
          viralityLevels={viralityLevels}
          onViralityLevelToggle={handleViralityToggle}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          vaultFilter={vaultFilter}
          onVaultFilterChange={(vault) => updateFilters({ vault })}
          mobile
        />
      </div>

      {/* Desktop Sidebar + Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex flex-col sticky top-0 self-start py-10 pl-10 shrink-0">
          <ProjectFilters
            captionsStyle={captionsStyle}
            onCaptionsStyleChange={(style) => updateFilters({ style })}
            viralityLevels={viralityLevels}
            onViralityLevelToggle={handleViralityToggle}
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetFilters}
            vaultFilter={vaultFilter}
            onVaultFilterChange={(vault) => updateFilters({ vault })}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-10 xl:px-16 min-w-0">
          <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1400px] mx-auto pt-6">
            <div key={vaultFilter} className="flex-1 overflow-y-auto pr-1 scrollbar-hide pb-4 animate-in fade-in duration-500">
              <ClipGrid
                clips={fetchedClips}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
                onSelectByScore={handleSelectByScore}
                aiRecommendations={aiRecommendations}
                recommendedIds={recommendedIds}
                recommendationThreshold={RECOMMENDATION_THRESHOLD}
                onToggleRecommendations={handleToggleRecommendations}
                onAutoSelect={handleAutoSelect}
                onEdit={handleEdit}
                onPreview={handlePreview}
                loading={loading}
                totalClips={totalClips}
                loadingNextPage={loadingNextPage}
                onLoadMore={handleLoadMore}
                hasMore={fetchedClips.length < totalClips}
                userPlan={userPlan}
              />
            </div>
            
            {/* Docked Actions Footer - Single instance with all required props */}
            <SelectionFooter 
              count={selectedIds.length}
              selectedIds={selectedIds}
              onMint={handleMint}
              isMinting={isMinting}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onPost={handlePost}
              isPosting={isPosting}
              postError={postError}
              onDelete={handleDelete}
              isDeleting={isDeleting}
              deleteError={deleteError}
              onArchive={handleArchive}
              isArchiving={isArchiving}
              archiveError={archiveError}
            />
          </div>
        </div>
      </div>
      {ToastEl}
      {editingClip && (
        <ClipEditorModal
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onSave={handleSaveEdits}
        />
      )}
      {previewClip && (
        <ClipPreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
        />
      )}
      {/* Batch Transform Modal */}
      {showTransformModal && (
        <BatchTransformModal
          clipCount={selectedIds.length}
          isSubmitting={isTransformSubmitting}
          submitError={transformSubmitError}
          onConfirm={handleTransformConfirm}
          onClose={() => setShowTransformModal(false)}
        />
      )}
      {/* Batch Transform Queue */}
      {transformBatch && (
        <BatchTransformQueue
          batch={transformBatch}
          completedCount={transformCompletedCount}
          totalCount={transformTotalCount}
          onCancelJob={cancelTransformJob}
          onDismiss={clearTransformBatch}
        />
      )}
    </>
  );
}
