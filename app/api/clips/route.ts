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
import { paginateItems, parsePaginationParams } from "../pagination";

const CLIP_FIELD_CONFIG = {
  allowedFields: [
    "id",
    "userId",
    "projectId",
    "title",
    "thumbnail",
    "score",
    "scoreKey",
    "duration",
    "style",
    "status",
    "resolution",
    "videoUrl",
    "createdAt",
    "scoreBreakdown",
    "tags",
    "shareId",
  ] as (keyof Clip & string)[],
  defaultFields: [
    "id",
    "title",
    "thumbnail",
    "score",
    "scoreKey",
    "duration",
    "style",
    "status",
    "createdAt",
    "tags",
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



  const fieldResult = parseFieldSelection(searchParams.get("fields"), CLIP_FIELD_CONFIG);
  if (!fieldResult.ok) {
    return NextResponse.json({ error: fieldResult.error }, { status: 400 });
  }

  // 1. Fetch user's clips. "archived" is a lifecycle state, not a clip status,
  //    so it selects a different set rather than filtering the default one.
  let userClips =
    status === "archived"
      ? clipsStore.getArchivedClipsForUser(session.user.id)
      : clipsStore.getClipsForUser(session.user.id, { keepDuplicates });

  // 2. Filter
  if (status && status !== "all" && status !== "archived") {
    userClips = userClips.filter((c) => c.status === status);
  }

  if (style && style !== "All Styles") {
    userClips = userClips.filter((c) => c.style === style);
  }

  if (virality.length > 0 && virality.length < 3) {
    userClips = userClips.filter((c) => virality.includes(c.scoreKey));
  }


    },
    error: null,
    meta,
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
      { status: 400 }
    );
  }

  const { clipIds } = parsed.data;

  // Seed the user's clips so ownership resolves on a first-time request.
  clipsStore.getClipsForUser(session.user.id);

  const unowned = clipsStore.findUnownedClipIds(session.user.id, clipIds);
  if (unowned.length > 0) {
    return NextResponse.json({ error: "One or more clips do not belong to you" }, { status: 403 });
  }

  const deletedCount = clipsStore.softDeleteClips(session.user.id, clipIds);

  const body: ApiResponse<{ success: boolean; deletedCount: number }> = {
    data: { success: true, deletedCount },
    error: null,
  };

  return NextResponse.json(body);
}
