import { NextRequest, NextResponse } from "next/server";

// In-memory mock store; in production use an S3/cloud storage client
const clipsStore = new Map<string, { userId: string; url: string }>();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const clipId = params.id;

  // Authenticated — in production, validate session/token
  const userId = req.headers.get("x-user-id") || "test-user-id";

  if (!clipsStore.has(clipId)) {
    clipsStore.set(clipId, {
      userId,
      url: "https://storage.example.com/clips/sample.mp4",
    });
  }

  const clip = clipsStore.get(clipId)!;

  // Authorization — users can only download their own clips
  if (clip.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate a signed pre-signed URL (mock — in production use S3 SDK)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const signedUrl = `${clip.url}?expires=${encodeURIComponent(expiresAt)}&signature=mock-signature`;

  return NextResponse.json({ url: signedUrl, expiresAt });
}