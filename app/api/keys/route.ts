import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { createApiKeyRecord } from "@/app/lib/apiKey";
import { createAuditEvent } from "@/app/lib/auditLog";

const apiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["read", "write"]),
  expiresAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        active: true,
        createdAt: true,
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = apiKeySchema.parse(body);

    const { apiKey, rawKey } = await createApiKeyRecord({
      userId: session.user.id,
      name: validatedData.name,
      scopes: validatedData.scopes,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
    });

    // Create audit event
    await createAuditEvent({
      actorId: session.user.id,
      action: "api_key.create",
      resource: "api_key",
      resourceId: apiKey.id,
      status: "success",
      metadata: {
        keyId: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
      },
    });

    // Return the raw key ONCE to the user upon creation
    return NextResponse.json(
      {
        apiKey: {
          ...apiKey,
          key: rawKey,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    logger.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
