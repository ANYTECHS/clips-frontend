import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, checkScope, logApiUsage } from "@/app/lib/apiAuth";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  const auth = await authenticateApiKey(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!checkScope(auth.apiKey, "clips:read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const clips = await prisma.clip.findMany({
      where: { userId: auth.apiKey.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const responseTime = Date.now() - startTime;
    await logApiUsage(auth.apiKey.id, "/api/v1/clips", "GET", 200, responseTime);

    return NextResponse.json({ 
      data: clips,
      meta: {
        total: clips.length,
        responseTime,
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiUsage(auth.apiKey.id, "/api/v1/clips", "GET", 500, responseTime);
    
    console.error("Error fetching clips:", error);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  const auth = await authenticateApiKey(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!checkScope(auth.apiKey, "clips:write")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await req.json();
    
    const clip = await prisma.clip.create({
      data: {
        userId: auth.apiKey.userId,
        title: body.title,
        originalUrl: body.originalUrl,
        // Add other fields as needed
      },
    });

    const responseTime = Date.now() - startTime;
    await logApiUsage(auth.apiKey.id, "/api/v1/clips", "POST", 201, responseTime);

    return NextResponse.json({ 
      data: clip,
      meta: {
        responseTime,
      }
    }, { status: 201 });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiUsage(auth.apiKey.id, "/api/v1/clips", "POST", 500, responseTime);
    
    console.error("Error creating clip:", error);
    return NextResponse.json({ error: "Failed to create clip" }, { status: 500 });
  }
}