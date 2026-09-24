import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { applyCustomRateLimit } from "@/app/lib/customRateLimit";
import { withApiAnalytics } from "@/app/lib/withApiAnalytics";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { earningsStore } from "@/app/api/earnings/earningsStore";
import type { ApiResponse } from "@/app/api/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchResultType = "clip" | "project" | "earning";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  relevance: number;
  matchType: "exact" | "prefix" | "substring" | "fuzzy";
  /** Client-side route to navigate to when this result is selected. */
  href: string;
}

export interface SearchResponse {
  clips: SearchResult[];
  projects: SearchResult[];
  earnings: SearchResult[];
  suggestions: string[];
}

const ALL_TYPES = ["clips", "projects", "earnings"] as const;
type SearchType = (typeof ALL_TYPES)[number];

const RESULTS_PER_TYPE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MatchScore {
  matched: boolean;
  relevance: number;
  matchType: SearchResult["matchType"];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function scoreField(query: string, field?: string): MatchScore {
  const q = normalize(query);
  const value = normalize(field ?? "");
  if (!q || !value) return { matched: false, relevance: 0, matchType: "fuzzy" };

  if (value === q) return { matched: true, relevance: 100, matchType: "exact" };
  if (value.startsWith(q)) return { matched: true, relevance: 90, matchType: "prefix" };
  if (value.includes(q)) return { matched: true, relevance: 75, matchType: "substring" };

  const queryWords = q.split(" ");
  const fieldWords = value.split(" ");
  const typoMatches = queryWords.filter((queryWord) =>
    fieldWords.some((fieldWord) => {
      const distance = levenshtein(queryWord, fieldWord);
      const maxDistance = queryWord.length <= 4 ? 1 : 2;
      return distance <= maxDistance;
    }),
  );

  if (typoMatches.length === queryWords.length) {
    return {
      matched: true,
      relevance: Math.max(45, 70 - queryWords.length * 5),
      matchType: "fuzzy",
    };
  }

  return { matched: false, relevance: 0, matchType: "fuzzy" };
}

function bestMatch(query: string, ...fields: Array<string | undefined>): MatchScore {
  return fields.reduce<MatchScore>(
    (best, field) => {
      const candidate = scoreField(query, field);
      return candidate.relevance > best.relevance ? candidate : best;
    },
    { matched: false, relevance: 0, matchType: "fuzzy" },
  );
}

function deriveProjectTitle(job: { id: string; filename?: string }): string {
  return job.filename ? job.filename.replace(/\.[^/.]+$/, "") : `Project ${job.id.slice(0, 6)}`;
}

// ─── GET /api/search?q=&types=clips,projects,earnings ────────────────────────

/**
 * Global search across the authenticated user's clips, projects (upload
 * jobs), and earnings transactions (issue #798). Backs the Cmd/Ctrl+K
 * command palette's search mode.
 *
 * Each result type is capped at RESULTS_PER_TYPE — this is a substring
 * match over in-memory/per-request store reads, not a search index, so it
 * intentionally stays cheap per request rather than trying to page through
 * a user's full history.
 */
async function handleGet(request: NextRequest) {
  const rateLimited = await applyCustomRateLimit(request, "/api/search");
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const typesParam = url.searchParams.get("types");
  const requestedTypes = new Set<SearchType>(
    typesParam
      ? (typesParam.split(",").filter((t): t is SearchType => (ALL_TYPES as readonly string[]).includes(t)))
      : ALL_TYPES,
  );

  const empty: SearchResponse = { clips: [], projects: [], earnings: [], suggestions: [] };
  if (!q) {
    return NextResponse.json({ data: empty, error: null });
  }

  const [clips, jobs, transactions] = await Promise.all([
    requestedTypes.has("clips") ? Promise.resolve(clipsStore.getClipsForUser(userId)) : Promise.resolve([]),
    requestedTypes.has("projects") ? jobStore.getUserJobs(userId) : Promise.resolve([]),
    requestedTypes.has("earnings") ? Promise.resolve(earningsStore.getTransactions(userId)) : Promise.resolve([]),
  ]);

  const clipResults: SearchResult[] = clips
    .map((clip) => ({ clip, match: bestMatch(q, clip.title, clip.style, ...(clip.tags ?? [])) }))
    .filter(({ match }) => match.matched)
    .sort((a, b) => b.match.relevance - a.match.relevance)
    .slice(0, RESULTS_PER_TYPE)
    .map(({ clip, match }) => ({
      type: "clip" as const,
      id: clip.id,
      title: clip.title,
      subtitle: clip.style,
      relevance: match.relevance,
      matchType: match.matchType,
      href: "/projects",
    }));

  const projectResults: SearchResult[] = jobs
    .map((job) => ({ job, title: deriveProjectTitle(job) }))
    .map(({ job, title }) => ({ job, title, match: bestMatch(q, title, job.status) }))
    .filter(({ match }) => match.matched)
    .sort((a, b) => b.match.relevance - a.match.relevance)
    .slice(0, RESULTS_PER_TYPE)
    .map(({ job, title, match }) => ({
      type: "project" as const,
      id: job.id,
      title,
      subtitle: job.status,
      relevance: match.relevance,
      matchType: match.matchType,
      href: `/dashboard/transform/${job.id}`,
    }));

  const earningResults: SearchResult[] = transactions
    .map((tx) => ({ tx, match: bestMatch(q, tx.description, tx.platform, tx.status) }))
    .filter(({ match }) => match.matched)
    .sort((a, b) => b.match.relevance - a.match.relevance)
    .slice(0, RESULTS_PER_TYPE)
    .map(({ tx, match }) => ({
      type: "earning" as const,
      id: tx.id,
      title: tx.description,
      subtitle: `$${tx.amount.toFixed(2)} · ${tx.status}`,
      relevance: match.relevance,
      matchType: match.matchType,
      href: "/earnings",
    }));

  const suggestions = [
    ...clips.map((clip) => clip.title),
    ...jobs.map(deriveProjectTitle),
    ...transactions.map((tx) => tx.description),
  ]
    .map((title) => ({ title, match: scoreField(q, title) }))
    .filter(({ match }) => match.matched && match.matchType !== "exact")
    .sort((a, b) => b.match.relevance - a.match.relevance)
    .map(({ title }) => title)
    .filter((title, index, all) => all.indexOf(title) === index)
    .slice(0, 5);

  return NextResponse.json({
    data: { clips: clipResults, projects: projectResults, earnings: earningResults, suggestions },
    error: null,
  });
}

export const GET = withApiAnalytics("/api/search", handleGet);
