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
  /** Client-side route to navigate to when this result is selected. */
  href: string;
}

export interface SearchResponse {
  clips: SearchResult[];
  projects: SearchResult[];
  earnings: SearchResult[];
}

const ALL_TYPES = ["clips", "projects", "earnings"] as const;
type SearchType = (typeof ALL_TYPES)[number];

const RESULTS_PER_TYPE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matches(query: string, ...fields: Array<string | undefined>): boolean {
  const q = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(q));
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

  const empty: SearchResponse = { clips: [], projects: [], earnings: [] };
  if (!q) {
    return NextResponse.json({ data: empty, error: null });
  }

  const [clips, jobs, transactions] = await Promise.all([
    requestedTypes.has("clips") ? Promise.resolve(clipsStore.getClipsForUser(userId)) : Promise.resolve([]),
    requestedTypes.has("projects") ? jobStore.getUserJobs(userId) : Promise.resolve([]),
    requestedTypes.has("earnings") ? Promise.resolve(earningsStore.getTransactions(userId)) : Promise.resolve([]),
  ]);

  const clipResults: SearchResult[] = clips
    .filter((clip) => matches(q, clip.title))
    .slice(0, RESULTS_PER_TYPE)
    .map((clip) => ({
      type: "clip" as const,
      id: clip.id,
      title: clip.title,
      subtitle: clip.style,
      href: "/projects",
    }));

  const projectResults: SearchResult[] = jobs
    .map((job) => ({ job, title: deriveProjectTitle(job) }))
    .filter(({ title }) => matches(q, title))
    .slice(0, RESULTS_PER_TYPE)
    .map(({ job, title }) => ({
      type: "project" as const,
      id: job.id,
      title,
      subtitle: job.status,
      href: `/dashboard/transform/${job.id}`,
    }));

  const earningResults: SearchResult[] = transactions
    .filter((tx) => matches(q, tx.description))
    .slice(0, RESULTS_PER_TYPE)
    .map((tx) => ({
      type: "earning" as const,
      id: tx.id,
      title: tx.description,
      subtitle: `$${tx.amount.toFixed(2)} · ${tx.status}`,
      href: "/earnings",
    }));

  return NextResponse.json({
    data: { clips: clipResults, projects: projectResults, earnings: earningResults },
    error: null,
  });
}

export const GET = withApiAnalytics("/api/search", handleGet);
