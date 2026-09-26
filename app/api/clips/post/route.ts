import { NextRequest, NextResponse } from "next/server";
import { postClipBodySchema } from "../../schemas/index";

function mockUpload(platform: string, clipId: string): { ok: boolean; postId?: string; error?: string } {
  const success = Math.random() > 0.2; // 80% success rate for mock
  if (success) {
    return { ok: true, postId: `${platform}-${clipId}-${Date.now()}` };
  }
  return { ok: false, error: `Simulated platform error for ${platform}` };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => ({}));

  // Validate request body with Zod
  const bodyValidation = postClipBodySchema.safeParse(rawBody);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: bodyValidation.error.issues },
      { status: 400 }
    );
  }

  const { clipIds, platforms } = bodyValidation.data;

  const posted: { clipId: string; platform: string; postId: string; url: string }[] = [];
  const failed: { clipId: string; platform: string; error: string }[] = [];

  for (const clipId of clipIds) {
    for (const platform of platforms) {
      const result = mockUpload(platform, clipId);
      if (result.ok && result.postId) {
        posted.push({
          clipId,
          platform,
          postId: result.postId,
          url: `https://${platform}.com/post/${result.postId}`,
        });
      } else {
        failed.push({ clipId, platform, error: result.error || "Unknown error" });
      }
    }
  }

  return NextResponse.json({ posted, failed });
}