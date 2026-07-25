import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import {
  getConnections,
  deleteConnection,
  type SocialPlatform,
} from "@/app/lib/platformConnections";

/**
 * GET /api/platforms/connections
 *
 * Returns all platform connections for the authenticated user.
 * Response shape:
 *   { connections: PlatformConnection[] }
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use email as the stable user identifier since no database user ID exists yet.
  const userId = session.user.email;
  const connections = getConnections(userId);

  // Strip sensitive token fields before sending to the client.
  const safeConnections = connections.map(({ accessToken, refreshToken, ...rest }) => rest);

  return NextResponse.json({ connections: safeConnections });
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

  const validPlatforms: SocialPlatform[] = [
    "google",
    "apple",
    "tiktok",
    "youtube",
    "instagram",
    "twitter",
  ];

  if (!platform || !validPlatforms.includes(platform)) {
    return NextResponse.json(
      {
        error: `Invalid or missing platform. Must be one of: ${validPlatforms.join(", ")}`,
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
