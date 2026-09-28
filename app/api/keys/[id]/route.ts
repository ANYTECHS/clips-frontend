import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { createAuditEvent } from "@/app/lib/auditLog";

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
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
        usages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    return NextResponse.json({ apiKey });
  } catch (error) {
    logger.error("Error fetching API key:", error);
    return NextResponse.json({ error: "Failed to fetch API key" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateApiKeySchema.parse(body);

    const updateData: any = { ...validatedData };
    if (validatedData.active === false) {
      updateData.revokedAt = new Date();
    }

    const apiKey = await prisma.apiKey.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: updateData,
    });

    if (apiKey.count === 0) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    const updatedApiKey = await prisma.apiKey.findUnique({
      where: { id },
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
      },
    });

    // Create audit event
    await createAuditEvent({
      actorId: session.user.id,
      action: validatedData.active === false ? "api_key.revoke" : "api_key.update",
      resource: "api_key",
      resourceId: id,
      status: "success",
      metadata: validatedData,
    });

    return NextResponse.json({ apiKey: updatedApiKey });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    logger.error("Error updating API key:", error);
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const apiKey = await prisma.apiKey.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (apiKey.count === 0) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    // Create audit event
    await createAuditEvent({
      actorId: session.user.id,
      action: "api_key.delete",
      resource: "api_key",
      resourceId: id,
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting API key:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
