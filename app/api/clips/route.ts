import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { clipsStore } from "./clipsStore";
import type { ApiResponse } from "../types";
import { getClipsQuerySchema, bulkClipIdsBodySchema } from "../schemas/index";
import {
  applySort,
  containsAll,
  matchesQuery,
  paginate,
  parseRange,
  withinDateRange,
  withinRange,
  type SortOrder,
} from "@/app/api/lib/listQuery";
import { parseFieldSelection, pickFields } from "@/app/lib/fieldSelection";
import { withApiAnalytics } from "@/app/lib/withApiAnalytics";
import type { Clip } from "./clipsStore";

const CLIP_FIELD_CONFIG = {
  allowedFields: [
    "id", "userId", "projectId", "title", "thumbnail", "score", "scoreKey",
    "duration", "style", "status", "resolution", "videoUrl", "createdAt",
    "scoreBreakdown", "tags", "shareId",
  ] as (keyof Clip & string)[],
  defaultFields: [
    "id", "title", "thumbnail", "score", "scoreKey", "duration",
    "style", "status", "createdAt", "tags",
  ] as (keyof Clip & string)[],
};

/** Fields `?q=` searches. */
const CLIP_SEARCH_FIELDS = ["title", "style", "tags"] as const;

/**
 * Converts a stored `mm:ss` (or `hh:mm:ss`) duration to seconds.
 *
 * `durationMin`/`durationMax` are numeric seconds, but the store keeps
 * duration as a display string. Returning `null` for anything unparseable
 * means such a clip simply does not match a duration filter, rather than
 * being coerced to 0 and matching every `durationMax`.
 */
function durationToSeconds(duration: unknown): number | null {
  if (typeof duration !== "string") return null;

  const parts = duration.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;

  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

async function handleGet(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Validate query parameters with Zod. Pagination, sorting, `q` and the date
  // range come from the shared list-query schema (Issue #949) so they behave
  // identically here and on every other list endpoint.
  const queryValidation = getClipsQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    style: searchParams.get("style") ?? undefined,
    virality: searchParams.getAll("virality"),
    tags: searchParams.get("tags") ?? undefined,
    platform: searchParams.get("platform") ?? undefined,
  });

  if (!queryValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: queryValidation.error.issues },
      { status: 400 }
    );
  }

  const {
    page, pageSize, sort, order, q, dateFrom, dateTo,
    status, style, virality, tags, platform,
  } = queryValidation.data;

  // Ranges are parsed separately because an inverted range is a client
  // mistake worth a 400, not an empty page the caller reads as "no results".
  const duration = parseRange(searchParams, "duration");
  if (!duration.ok) {
    return NextResponse.json({ error: duration.error }, { status: 400 });
  }

  const score = parseRange(searchParams, "score");
  if (!score.ok) {
    return NextResponse.json({ error: score.error }, { status: 400 });
  }

  const fieldResult = parseFieldSelection(searchParams.get("fields"), CLIP_FIELD_CONFIG);
  if (!fieldResult.ok) {
    return NextResponse.json(
      { error: fieldResult.error },
      { status: 400 }
    );
  }

  // 1. Fetch user's clips. "archived" is a lifecycle state, not a clip status,
  //    so it selects a different set rather than filtering the default one.
  let userClips =
    status === "archived"
      ? clipsStore.getArchivedClipsForUser(session.user.id)
      : clipsStore.getClipsForUser(session.user.id, { keepDuplicates });

  // 2. Filter
  if (status && status !== "all" && status !== "archived") {
    userClips = userClips.filter(c => c.status === status);
  }

  if (style && style !== "All Styles") {
    userClips = userClips.filter(c => c.style === style);
  }

  if (virality.length > 0 && virality.length < 3) {
    userClips = userClips.filter(c => virality.includes(c.scoreKey));
  }

  if (platform) {
    userClips = userClips.filter(c => c.platform === platform);
  }

  // Tags narrow rather than widen — a clip must carry every requested tag.
  if (tags.length > 0) {
    userClips = userClips.filter(c => containsAll(c.tags, tags));
  }

  if (q) {
    userClips = userClips.filter(c => matchesQuery(c, q, CLIP_SEARCH_FIELDS));
  }

  if (dateFrom || dateTo) {
    userClips = userClips.filter(c => withinDateRange(c.createdAt, dateFrom, dateTo));
  }

  if (duration.min !== undefined || duration.max !== undefined) {
    userClips = userClips.filter(c =>
      withinRange(durationToSeconds(c.duration), duration.min, duration.max),
    );
  }

  if (score.min !== undefined || score.max !== undefined) {
    userClips = userClips.filter(c => withinRange(c.score, score.min, score.max));
  }

  // 3. Sort. `duration` is stored as a display string, so sorting on it
  //    compares seconds rather than "01:12" < "00:45" lexicographic nonsense.
  const sorted: Clip[] =
    sort === "duration"
      ? applySort(
          userClips.map(c => ({ ...c, __seconds: durationToSeconds(c.duration) })),
          "__seconds",
          order,
        ).map(({ __seconds: _seconds, ...clip }) => clip as Clip)
      : applySort(userClips, sort, order);

  // 4. Paginate
  const pageResult = paginate(sorted, page, pageSize);

  const selectedClips = pageResult.items.map(clip => pickFields(clip, fieldResult.fields));

  const body: ApiResponse<{
    clips: typeof selectedClips;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    sort: string;
    order: SortOrder;
  }> = {
    data: {
      clips: selectedClips,
      // `total` is kept for existing clients; the rest is additive so a
      // caller can render "21-40 of 137" without a second request.
      total: pageResult.total,
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      totalPages: pageResult.totalPages,
      sort,
      order,
    },
    error: null
  };

  return NextResponse.json(body);
}

export const GET = withApiAnalytics("/api/clips", handleGet, async () => {
  const session = await auth();
  return session?.user?.id;
});

/**
 * DELETE /api/clips
 * Body: { clipIds: string[] }
 *
 * Soft-deletes clips by stamping `deletedAt`. Deleted clips drop out of every
 * read path immediately — library, Vault, and Analytics all read through
 * `getClipsForUser` — while the row is retained for the recovery window.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bulkClipIdsBodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { clipIds } = parsed.data;

  // Seed the user's clips so ownership resolves on a first-time request.
  clipsStore.getClipsForUser(session.user.id);

  const unowned = clipsStore.findUnownedClipIds(session.user.id, clipIds);
  if (unowned.length > 0) {
    return NextResponse.json(
      { error: "One or more clips do not belong to you" },
      { status: 403 },
    );
  }

  const deletedCount = clipsStore.softDeleteClips(session.user.id, clipIds);

  const body: ApiResponse<{ success: boolean; deletedCount: number }> = {
    data: { success: true, deletedCount },
    error: null,
  };

  return NextResponse.json(body);
}
