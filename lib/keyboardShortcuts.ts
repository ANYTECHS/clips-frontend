/**
 * Issue #1377 — keyboard shortcuts registry.
 * Single source of truth for discoverable shortcuts, grouped by category for
 * the "?" help overlay (components/shared/KeyboardShortcutsHelp.tsx).
 */

export interface ShortcutDef {
  keys: string;
  description: string;
}

export interface ShortcutCategory {
  category: string;
  shortcuts: ShortcutDef[];
}

export const SHORTCUTS: ShortcutCategory[] = [
  {
    category: "General",
    shortcuts: [
      { keys: "?", description: "Open this keyboard shortcuts help" },
      { keys: "Esc", description: "Close dialogs and overlays" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { keys: "G then D", description: "Go to Dashboard" },
      { keys: "G then C", description: "Go to Clips" },
      { keys: "G then P", description: "Go to Projects" },
    ],
  },
  {
    category: "Actions",
    shortcuts: [
      { keys: "N", description: "New clip / upload (on supported pages)" },
      { keys: "Ctrl/⌘ + Enter", description: "Submit the active form" },
    ],
  },
];
