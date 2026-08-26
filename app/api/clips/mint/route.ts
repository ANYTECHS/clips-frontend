import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { clipsStore } from "../clipsStore";
import type { ApiResponse } from "../../types";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clipIds } = await request.json();
    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return NextResponse.json({ error: "Invalid clipIds array" }, { status: 400 });
    }

    // Verify ownership
    const userClips = clipsStore.getClipsForUser(session.user.id);
    const userClipIds = userClips.map(c => c.id);
    const unauthorized = clipIds.some(id => !userClipIds.includes(id));
    if (unauthorized) {
      return NextResponse.json({ error: "One or more clips do not belong to you" }, { status: 403 });
    }

    // Simulate batch minting by updating status to 'listed'
    const updatedCount = clipsStore.updateClipStatus(session.user.id, clipIds, "listed");

    return NextResponse.json({
      data: { success: true, updatedCount },
      error: null
    } as ApiResponse<{ success: boolean; updatedCount: number }>);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
