import { NextRequest, NextResponse } from "next/server";

import { requireScope, type ApiKeyRouteContext } from "@/app/lib/apiKey";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { versionedRoute } from "@/app/api/versioning";

async function getClips(req: NextRequest, { apiKey }: ApiKeyRouteContext) {
  const startTime = Date.now();

  try {
    const clips = await prisma.clip.findMany({
      where: { userId: apiKey.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const responseTime = Date.now() - startTime;
    return NextResponse.json({
      data: clips,
      meta: {
        total: clips.length,
        responseTime,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Error fetching clips:", error);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}

async function createClip(req: NextRequest, { apiKey }: ApiKeyRouteContext) {
  const startTime = Date.now();

  try {
    const body = await req.json();

    const clip = await prisma.clip.create({
      data: {
        userId: apiKey.userId,
        title: body.title,
        originalUrl: body.originalUrl,
        // Add other fields as needed
      },
    });

    const responseTime = Date.now() - startTime;
    return NextResponse.json(
      {
        data: clip,
        meta: {
          responseTime,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Error creating clip:", error);
    return NextResponse.json({ error: "Failed to create clip" }, { status: 500 });
  }
}

export const GET = versionedRoute("v1", requireScope("clips:read")(getClips));
export const POST = versionedRoute("v1", requireScope("clips:write")(createClip));
