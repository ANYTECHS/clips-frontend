"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import type { SearchResponse } from "@/app/api/search/route";
import type { ApiResponse } from "@/app/api/types";
import { FAILURE_MESSAGES, safeErrorMessage } from "@/app/lib/errorMessages";

const DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RECENT_SEARCHES_KEY = "recent_searches";
const MAX_RECENT_SEARCHES = 5;

export interface UseGlobalSearchResult {
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

const EMPTY: SearchResponse = { clips: [], projects: [], earnings: [], suggestions: [] };

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: SearchResponse; timestamp: number }>();

/**
 * Get recent searches from localStorage
 */
function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a query to recent searches
 */
function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentSearches();
    const filtered = recent.filter((q) => q !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear recent searches
 */
function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Debounced global search across clips, projects, and earnings (issue
 * #798), backing the command palette's search mode. Returns null results
 * (not an empty state) for a blank query so callers can distinguish "no
 * query yet" from "query returned nothing".
 *
 * Enhanced with:
 * - Request cancellation for stale searches
 * - Result caching with TTL
 * - Loading indicators
 * - Recent searches in localStorage
 * - Keyboard navigation support
 */
export function useGlobalSearch(query: string): UseGlobalSearchResult {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleAddRecentSearch = useCallback((q: string) => {
    addRecentSearch(q);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = trimmed.toLowerCase();
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      setResults(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&types=clips,projects,earnings`,
          { signal }
        );
        if (!res.ok) {
          throw new Error(`Search failed (HTTP ${res.status})`);
        }
        const body = (await res.json()) as ApiResponse<SearchResponse>;
        const data = body.data ?? EMPTY;

        // Cache the results
        searchCache.set(cacheKey, { data, timestamp: now });

        // Clean up old cache entries
        searchCache.forEach((value, key) => {
          if (now - value.timestamp > CACHE_TTL_MS) {
            searchCache.delete(key);
          }
        });

        setResults(data);

        // Add to recent searches on successful search
        if (data.clips.length > 0 || data.projects.length > 0 || data.earnings.length > 0) {
          handleAddRecentSearch(trimmed);
        }
      } catch (err) {
        if (signal.aborted) {
          // Request was cancelled, don't show error
          return;
        }
        setError(safeErrorMessage(err, FAILURE_MESSAGES.searchFailed, "global search"));
        setResults(EMPTY);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, handleAddRecentSearch]);

  return {
    results,
    loading,
    error,
    recentSearches,
    addRecentSearch: handleAddRecentSearch,
    clearRecentSearches: handleClearRecentSearches,
  };
}
