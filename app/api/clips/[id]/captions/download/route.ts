import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { captionsStore } from "@/app/api/captions/captionsStore";
import { buildSubtitleFile, type SubtitleFormat } from "@/app/lib/subtitles";

/**
 * GET /api/clips/:id/captions/download?format=srt|vtt
 *
 * Downloads the stored captions as a browser file. The route enforces session
 * authentication and clip ownership, and sets `no-store` so drafts never get
 * cached by intermediary proxies.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;
  clipsStore.getClipsForUser(userId);
  if (clipsStore.findUnownedClipIds(userId, [clipId]).length > 0) {
    return NextResponse.json({ error: "Clip not found" }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format");
  if (format !== "srt" && format !== "vtt") {
    return NextResponse.json({ error: "format must be 'srt' or 'vtt'" }, { status: 400 });
  }

  const captions = captionsStore.get(clipId, userId);
  if (!captions || captions.segments.length === 0) {
    return NextResponse.json({ error: "Captions not found" }, { status: 404 });
  }

  const content = buildSubtitleFile(captions.segments, format as SubtitleFormat);
  const filename = `clip-${encodeURIComponent(clipId)}.${format}`;
  return new Response(content, {
    headers: {
      "Content-Type": format === "srt" ? "application/x-subrip" : "text/vtt",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
