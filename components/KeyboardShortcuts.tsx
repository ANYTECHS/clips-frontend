"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts, SHORTCUT_REGISTRY } from "@/app/hooks/useKeyboardShortcuts";
import { useGlobalSearch } from "@/app/hooks/useGlobalSearch";
import type { SearchResult, SearchResponse } from "@/app/api/search/route";
import { sanitize } from "@/app/lib/sanitize";
import { X, Keyboard, Search, Upload, DollarSign, Folder, Lock, Command, Film, Loader2 } from "lucide-react";

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  const commands = [
    { id: "upload", label: "Go to Upload", icon: Upload, action: () => router.push("/upload") },
    { id: "earnings", label: "Go to Earnings", icon: DollarSign, action: () => router.push("/earnings") },
    { id: "projects", label: "Go to Projects", icon: Folder, action: () => router.push("/projects") },
    { id: "vault", label: "Go to Vault", icon: Lock, action: () => router.push("/vault") },
  ];

  const filteredCommands = commandSearch
    ? commands.filter(cmd => cmd.label.toLowerCase().includes(commandSearch.toLowerCase()))
    : commands;

  // Global search across clips/projects/earnings (issue #798) — runs
  // alongside the static command filter above; results render in their own
  // grouped section below the matched commands.
  const { results: searchResults, loading: searchLoading } = useGlobalSearch(commandSearch);

  const handleResultSelect = (result: SearchResult) => {
    router.push(result.href);
    setShowCommandPalette(false);
    setCommandSearch("");
  };

  useKeyboardShortcuts({
    onOpenSearch: () => {
      setShowCommandPalette(true);
      setCommandSearch("");
    },
    onOpenUpload: () => router.push("/upload"),
    onNavigateEarnings: () => router.push("/earnings"),
    onNavigateProjects: () => router.push("/projects"),
    onNavigateVault: () => router.push("/vault"),
    onCloseModals: () => {
      setShowShortcuts(false);
      setShowCommandPalette(false);
      setCommandSearch("");
    },
    onOpenShortcuts: () => setShowShortcuts(true),
  });

  const groupedShortcuts = SHORTCUT_REGISTRY.reduce((acc, shortcut) => {
    if (!acc[shortcut.section]) {
      acc[shortcut.section] = [];
    }
    acc[shortcut.section].push(shortcut);
    return acc;
  }, {} as Record<string, typeof SHORTCUT_REGISTRY>);

  const formatShortcut = (shortcut: typeof SHORTCUT_REGISTRY[0]) => {
    const parts = [];
    if (shortcut.meta) {
      parts.push(<Command key="meta" className="w-3 h-3" />);
    }
    parts.push(<span key="key" className="font-mono">{shortcut.key}</span>);
    return parts;
  };

  return (
    <>
      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-brand" />
                <h2 id="shortcuts-title" className="text-xl font-bold text-white">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Close shortcuts"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {Object.entries(groupedShortcuts).map(([section, shortcuts]) => (
                <div key={section}>
                  <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                    {section}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.key + (shortcut.meta ? "-meta" : "")}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
                      >
                        <span className="text-sm text-white/90">{shortcut.description}</span>
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/10">
                          {formatShortcut(shortcut)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 text-center">
              <p className="text-xs text-white/50">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Escape</kbd> to close</p>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
          >
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <Search className="w-5 h-5 text-white/50" />
              <input
                type="text"
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-white placeholder:text-white/50 outline-none text-lg"
                autoFocus
                id="command-palette-title"
              />
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/10">
                <Command className="w-3 h-3" />
                <span className="font-mono text-xs">K</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {filteredCommands.length > 0 && (
                <div className="p-2">
                  {filteredCommands.map((command) => {
                    const Icon = command.icon;
                    return (
                      <button
                        key={command.id}
                        onClick={() => {
                          command.action();
                          setShowCommandPalette(false);
                          setCommandSearch("");
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-white/70" />
                        <span className="text-white">{command.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {commandSearch.trim() && (
                <SearchResultsSection
                  loading={searchLoading}
                  results={searchResults}
                  onSelect={handleResultSelect}
                />
              )}

              {filteredCommands.length === 0 &&
                commandSearch.trim() === "" && (
                  <div className="p-8 text-center text-white/50">
                    No commands found
                  </div>
                )}

              {filteredCommands.length === 0 &&
                commandSearch.trim() !== "" &&
                !searchLoading &&
                searchResults &&
                searchResults.clips.length === 0 &&
                searchResults.projects.length === 0 &&
                searchResults.earnings.length === 0 && (
                  <div className="p-8 text-center text-white/50">
                    No results for &ldquo;{commandSearch}&rdquo;
                  </div>
                )}
            </div>

            <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">↵</kbd> Select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Search results section (issue #798) ──────────────────────────────────────

interface SearchResultsSectionProps {
  loading: boolean;
  results: SearchResponse | null;
  onSelect: (result: SearchResult) => void;
}

function SearchResultsSection({ loading, results, onSelect }: SearchResultsSectionProps) {
  if (loading && !results) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-white/50 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Searching…
      </div>
    );
  }

  if (!results) return null;

  const groups: Array<{ label: string; items: SearchResult[] }> = [
    { label: "Clips", items: results.clips },
    { label: "Projects", items: results.projects },
    { label: "Earnings", items: results.earnings },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="p-2 border-t border-white/10">
      {groups.map((group) => (
        <div key={group.label} className="mb-2 last:mb-0">
          <div className="px-3 py-1 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
            {group.label}
          </div>
          {group.items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onSelect(item)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <Film className="w-4 h-4 text-white/50 shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-white text-sm truncate">{sanitize(item.title)}</span>
                {item.subtitle && (
                  <span className="block text-white/40 text-xs truncate">{sanitize(item.subtitle)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
