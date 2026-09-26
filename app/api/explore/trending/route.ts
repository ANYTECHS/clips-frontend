import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { exploreStore, privacyStore } from "./exploreStore";
import type { ApiResponse } from "../types";

/**
 * GET /api/explore/trending
 *
 * Public endpoint — returns isPublic clips sorted by virality score.
 * Cursor pagination, 20 results per page.
 */
export async function GET(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const { clips, nextCursor } = exploreStore.getTrending({
    cursor,
    limit,
    privacyFilter: (clip) => {
      const isDemoCreator = clip.userId.startsWith("creator-");
      const privacy = privacyStore.get(clip.userId);

      if (!isDemoCreator && !privacy.exploreOptIn) {
        return null;
      }

      return {
        ...clip,
        creatorUsername: privacy.showUsername || isDemoCreator
          ? clip.creatorUsername
          : "Anonymous Creator",
      };
    },
  });

  const body: ApiResponse<{
    clips: Array<{
      id: string;
      title: string;
      thumbnail: string;
      score: number;
      style: string;
      duration: string;
      creatorUsername: string;
      shareId: string;
    }>;
    nextCursor: string | null;
  }> = {
    data: {
      clips: clips.map((c) => ({
        id: c.id,
        title: c.title,
        thumbnail: c.thumbnail,
        score: c.score,
        style: c.style,
        duration: c.duration,
        creatorUsername: c.creatorUsername,
        shareId: c.shareId,
      })),
      nextCursor,
    },
    error: null,
  };

  return NextResponse.json(body);
}
