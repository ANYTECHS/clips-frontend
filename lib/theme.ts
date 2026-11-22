"use client";

// Issue #1382 — theme management for the dashboard.
// Persists the user's choice in localStorage ("clipcash_theme"), respects the
// OS prefers-color-scheme by default, and toggles a `light` class on <html>.
// The app ships dark-first; the light theme is applied via .light overrides
// in globals.css scoped to dashboard surfaces.

export type Theme = "dark" | "light";

const STORAGE_KEY = "clipcash_theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  applyTheme(theme);
  window.dispatchEvent(new Event("clipcash_theme_changed"));
}

/** Initialise from storage/system preference — call once on mount. */
export function initTheme(): void {
  applyTheme(getTheme());
}
