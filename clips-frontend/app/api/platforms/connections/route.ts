import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import {
  getConnections,
  upsertConnection,
  deleteConnection,
  type SocialPlatform,
  type PlatformConnection,
} from "@/app/lib/platformConnections";

const VALID_PLATFORMS: SocialPlatform[] = [
  "google",
  "apple",
  "tiktok",
  "youtube",
  "instagram",
  "twitter",
];

/**
 * GET /api/platforms/connections
 *
 * Returns all platform connections for the authenticated user.
 * Response shape:
 *   { connections: SafeConnection[] }
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.email;
  const connections = getConnections(userId);

  // Strip sensitive token fields before sending to the client.
  const safeConnections = connections.map(
    ({ accessToken: _a, refreshToken: _r, ...rest }) => rest
  );

  return NextResponse.json({ connections: safeConnections });
}

/**
 * POST /api/platforms/connections
 *
 * Manually upsert a platform connection for the authenticated user.
 * Useful for testing and for providers that complete OAuth outside the
 * NextAuth jwt callback (e.g. mobile-initiated flows).
 *
 * Request body:
 *   { platform: SocialPlatform; username?: string; accessToken?: string; refreshToken?: string }
 *
 * Response shape:
 *   { success: true } | { error: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<PlatformConnection>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { platform, username = null, accessToken = null, refreshToken = null } = body;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      {
        error: `Invalid or missing platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  upsertConnection({
    userId: session.user.email,
    platform,
    accessToken,
    refreshToken,
    username: username ?? null,
    connectedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

/**
 * DELETE /api/platforms/connections?platform=tiktok
 *
 * Removes a specific platform connection for the authenticated user.
 * Response shape:
 *   { success: true } | { error: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") as SocialPlatform | null;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      {
        error: `Invalid or missing platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const userId = session.user.email;
  const deleted = deleteConnection(userId, platform);

  if (!deleted) {
    return NextResponse.json(
      { error: `No connection found for platform "${platform}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
