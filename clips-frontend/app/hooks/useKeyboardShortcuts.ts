import { useEffect, useCallback } from "react";

interface KeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onOpenUpload: () => void;
  onNavigateEarnings: () => void;
  onNavigateProjects: () => void;
  onNavigateVault: () => void;
  onCloseModals: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const { onOpenSearch, onOpenUpload, onNavigateEarnings, onNavigateProjects, onNavigateVault, onCloseModals } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      
      if (isMeta && e.key === "k") {
        e.preventDefault();
        onOpenSearch();
      }
      
      if (isMeta && e.key === "u") {
        e.preventDefault();
        onOpenUpload();
      }
      
      if (isMeta && e.key === "e") {
        e.preventDefault();
        onNavigateEarnings();
      }
      
      if (isMeta && e.key === "p") {
        e.preventDefault();
        onNavigateProjects();
      }
      
      if (isMeta && e.key === "v") {
        e.preventDefault();
        onNavigateVault();
      }
      
      if (e.key === "Escape") {
        onCloseModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenSearch, onOpenUpload, onNavigateEarnings, onNavigateProjects, onNavigateVault, onCloseModals]);
}
