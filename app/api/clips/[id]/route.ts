import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { clipsStore } from "../clipsStore";
import type { ApiResponse } from "../../types";

/**
 * GET /api/clips/:id
 *
 * Returns the full detail object for a single clip owned by the
 * authenticated user. The response includes virality breakdown,
 * processing metadata, transformation history, and share link status.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clipId } = await context.params;

  if (!clipsStore.clipExists(clipId)) {
    const body: ApiResponse<null> = {
      data: null,
      error: "Clip not found",
      code: "CLIP_NOT_FOUND",
    };
    return NextResponse.json(body, { status: 404 });
  }

  clipsStore.getClipsForUser(session.user.id);
  const unowned = clipsStore.findUnownedClipIds(session.user.id, [clipId]);
  if (unowned.length > 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clip = clipsStore.getClipById(session.user.id, clipId)!;

  const body: ApiResponse<typeof clip> = {
    data: clip,
    error: null,
  };

  return NextResponse.json(body);
}
