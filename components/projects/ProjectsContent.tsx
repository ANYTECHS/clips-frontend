"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteClip, ReadyToPostKit } from "@/lib/queries";
import DashboardLayout from "@/components/shared/DashboardLayout";
import ClipGrid from "@/components/projects/ClipGrid";
import SelectionFooter from "@/components/projects/SelectionFooter";
import { markFreeJobAsClaimed } from "@/lib/freeJobStore";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";

interface Project {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  style?: string;
  readyToPostKit?: ReadyToPostKit | null;
}

interface ProjectsContentProps {
  clips: Project[];
}

export default function ProjectsContent({ clips }: ProjectsContentProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { address } = useWallet();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Since user is in projects with clips, permanently seal the free offer
  useEffect(() => {
    if (clips && clips.length > 0) {
      markFreeJobAsClaimed([user?.id, user?.email, address]);
    }
  }, [clips, user?.id, user?.email, address]);

  const handleDeleteClip = async (id: string) => {
    try {
      // Ensure claimed state is permanently marked so deleting clips NEVER revives the free welcome offer
      markFreeJobAsClaimed([user?.id, user?.email, address]);
      await deleteClip(id);
      queryClient.invalidateQueries({ queryKey: ["projectsData"] });
      queryClient.invalidateQueries({ queryKey: ["userClipCount"] });
      queryClient.invalidateQueries({ queryKey: ["userVideoCount"] });
      queryClient.invalidateQueries({ queryKey: ["userHasEverClipped"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["sidebarClipCount"] });
    } catch (error) {
      console.error("Failed to delete clip:", error);
      throw error;
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    try {
      markFreeJobAsClaimed([user?.id, user?.email, address]);
      await Promise.all(ids.map((id) => deleteClip(id)));
      queryClient.invalidateQueries({ queryKey: ["projectsData"] });
      queryClient.invalidateQueries({ queryKey: ["userClipCount"] });
      queryClient.invalidateQueries({ queryKey: ["userVideoCount"] });
      queryClient.invalidateQueries({ queryKey: ["userHasEverClipped"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["sidebarClipCount"] });
    } catch (error) {
      console.error("Failed to batch delete clips:", error);
      throw error;
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === clips.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(clips.map((c: Project) => c.id));
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col relative z-10 px-4 sm:px-6 lg:px-8 overflow-hidden pt-4 sm:pt-6 w-full">
        <div className="flex-1 flex flex-col overflow-hidden w-full max-w-[1400px] mx-auto">
          {/* Grid Content - scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide pb-10">
            <ClipGrid
              clips={clips}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onDelete={handleDeleteClip}
            />
          </div>

          {/* Docked Actions Footer */}
          <SelectionFooter
            count={selectedIds.length}
            selectedIds={selectedIds}
            onDelete={handleBatchDelete}
            onClearSelection={() => setSelectedIds([])}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
