import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { clipsStore } from "../clipsStore";
import type { ApiResponse } from "../../types";
import { bulkClipIdsBodySchema } from "../../schemas/index";

/** Shared auth + validation + ownership path for both handlers below. */
async function resolveRequest(request: NextRequest): Promise<
  | { ok: true; userId: string; clipIds: string[] }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = bulkClipIdsBodySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }

  // Seed the user's clips so ownership resolves on a first-time request.
  clipsStore.getClipsForUser(session.user.id);

  const unowned = clipsStore.findUnownedClipIds(
    session.user.id,
    parsed.data.clipIds,
  );
  if (unowned.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "One or more clips do not belong to you" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: session.user.id, clipIds: parsed.data.clipIds };
}

/**
 * PATCH /api/clips/archive
 * Body: { clipIds: string[] }
 *
 * Stamps `archivedAt`, moving clips out of the default library and into the
 * Archived tab. Non-destructive — DELETE /api/clips is the delete path.
 */
export async function PATCH(request: NextRequest) {
  const resolved = await resolveRequest(request);
  if (!resolved.ok) return resolved.response;

  const archivedCount = clipsStore.archiveClips(resolved.userId, resolved.clipIds);

  const body: ApiResponse<{ success: boolean; archivedCount: number }> = {
    data: { success: true, archivedCount },
    error: null,
  };

  return NextResponse.json(body);
}

/**
 * DELETE /api/clips/archive
 * Body: { clipIds: string[] }
 *
 * Unarchives — clears `archivedAt` and returns clips to the main library.
 * This does not delete anything.
 */
export async function DELETE(request: NextRequest) {
  const resolved = await resolveRequest(request);
  if (!resolved.ok) return resolved.response;

  const restoredCount = clipsStore.unarchiveClips(resolved.userId, resolved.clipIds);

  const body: ApiResponse<{ success: boolean; restoredCount: number }> = {
    data: { success: true, restoredCount },
    error: null,
  };

  return NextResponse.json(body);
}
