"use client";

/**
 * Saves and restores the scroll position of a custom scroll container
 * (the dashboard's <main> element) across client-side navigations.
 *
 * Next.js's built-in scroll restoration only targets `window`. The dashboard
 * shell uses `h-screen overflow-y-auto` on <main>, so window.scrollY is
 * always 0 — the browser has nothing to restore. This hook fills that gap by
 * persisting scroll positions in sessionStorage, keyed by pathname, and
 * restoring them after the route change settles.
 *
 * Usage:
 *   const ref = useScrollRestoration<HTMLElement>(pathname);
 *   <main ref={ref} ...>
 */

import { useEffect, useRef, type RefObject } from "react";

const STORAGE_KEY = "scroll-positions";
const MAX_ENTRIES = 50; // avoid unbounded sessionStorage growth

function readMap(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, number>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing quota full)
  }
}

export function useScrollRestoration<T extends HTMLElement>(
  pathname: string,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  // Track the previous pathname so we know which key to save under on leave.
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const leaving = prevPathname.current;
    prevPathname.current = pathname;

    // ── Save scroll position of the page we're leaving ──────────────────
    if (leaving !== pathname) {
      const map = readMap();
      map[leaving] = el.scrollTop;
      // Evict the oldest entries if we exceed the cap
      const keys = Object.keys(map);
      if (keys.length > MAX_ENTRIES) {
        const oldest = keys[0];
        if (oldest !== undefined) delete map[oldest];
      }
      writeMap(map);
    }

    // ── Restore scroll position for the page we just landed on ──────────
    const saved = readMap()[pathname];
    if (saved !== undefined) {
      // Defer one frame so the page content has painted before we scroll,
      // otherwise the container may not yet be tall enough to reach `saved`.
      const id = requestAnimationFrame(() => {
        el.scrollTop = saved;
      });
      return () => cancelAnimationFrame(id);
    }

    // New page — scroll to top
    el.scrollTop = 0;
  }, [pathname]);

  return ref;
}
