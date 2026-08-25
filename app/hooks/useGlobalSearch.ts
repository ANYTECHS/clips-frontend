"use client";

import { useEffect, useState, useRef } from "react";
import type { SearchResponse } from "@/app/api/search/route";
import type { ApiResponse } from "@/app/api/types";

const DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface UseGlobalSearchResult {
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: SearchResponse = { clips: [], projects: [], earnings: [] };

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: SearchResponse; timestamp: number }>();

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
 */
export function useGlobalSearch(query: string): UseGlobalSearchResult {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = searchCache.get(trimmed);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
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
        searchCache.set(trimmed, { data, timestamp: now });
        
        // Clean up old cache entries
        searchCache.forEach((value, key) => {
          if (now - value.timestamp > CACHE_TTL_MS) {
            searchCache.delete(key);
          }
        });
        
        setResults(data);
      } catch (err) {
        if (signal.aborted) {
          // Request was cancelled, don't show error
          return;
        }
        setError(err instanceof Error ? err.message : "Search failed");
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
  }, [query]);

  return { results, loading, error };
}
