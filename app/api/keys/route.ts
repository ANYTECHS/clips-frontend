import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

const apiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()),
  expiresAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    logger.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = apiKeySchema.parse(body);

    // Generate API key
    const key = `ck_${crypto.randomBytes(32).toString("hex")}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: validatedData.name,
        key,
        scopes: validatedData.scopes,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        active: true,
      },
    });

    return NextResponse.json({ apiKey }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    logger.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
