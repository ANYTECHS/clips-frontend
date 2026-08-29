"use client";

import { useEffect } from "react";
import OfflineBanner from "@/components/OfflineBanner";
import { startAutomaticSync } from "@/app/lib/data-layer";
import { useDataSyncStatus } from "@/app/hooks/useDataSyncStatus";

export default function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, syncStatus, pendingCount, retrySync } = useDataSyncStatus();

  useEffect(() => {
    return startAutomaticSync();
  }, []);

  return (
    <>
      {children}
      <OfflineBanner
        isOnline={isOnline}
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        onRetry={retrySync}
      />
    </>
  );
}
