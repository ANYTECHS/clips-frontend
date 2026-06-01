import { useEffect } from "react";

export interface Shortcut {
  key: string;
  meta?: boolean;
  description: string;
  section: "General" | "Navigation" | "Actions";
}

export const SHORTCUT_REGISTRY: Shortcut[] = [
  { key: "k", meta: true, description: "Open Search", section: "General" },
  { key: "u", meta: true, description: "Open Upload", section: "General" },
  { key: "?", description: "Show keyboard shortcuts", section: "General" },
  { key: "e", meta: true, description: "Go to Earnings", section: "Navigation" },
  { key: "p", meta: true, description: "Go to Projects", section: "Navigation" },
  { key: "v", meta: true, description: "Go to Vault", section: "Navigation" },
  { key: "Escape", description: "Close modals", section: "General" },
];

interface KeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onOpenUpload: () => void;
  onNavigateEarnings: () => void;
  onNavigateProjects: () => void;
  onNavigateVault: () => void;
  onCloseModals: () => void;
  onOpenShortcuts: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const { 
    onOpenSearch, 
    onOpenUpload, 
    onNavigateEarnings, 
    onNavigateProjects, 
    onNavigateVault, 
    onCloseModals,
    onOpenShortcuts 
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenSearch();
      }
      
      if (isMeta && e.key.toLowerCase() === "u") {
        e.preventDefault();
        onOpenUpload();
      }
      
      if (isMeta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        onNavigateEarnings();
      }
      
      if (isMeta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        onNavigateProjects();
      }
      
      if (isMeta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        onNavigateVault();
      }
      
      if (e.key === "Escape") {
        onCloseModals();
      }

      if (e.key === "?" && !isMeta) {
        e.preventDefault();
        onOpenShortcuts();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onOpenSearch, 
    onOpenUpload, 
    onNavigateEarnings, 
    onNavigateProjects, 
    onNavigateVault, 
    onCloseModals,
    onOpenShortcuts
  ]);
}
