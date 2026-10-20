import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { validateAvatarFile, MAX_AVATAR_BYTES } from "@/app/lib/userPreferences";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("avatar") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No avatar file provided in form data" }, { status: 400 });
      }

      if (file.size > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Avatar file exceeds maximum size of 1 MB" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const arrayBuffer = await req.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty avatar file uploaded" }, { status: 400 });
    }

    // Validate avatar magic bytes and size
    const validation = validateAvatarFile(buffer, buffer.length);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || "Invalid image file" }, { status: 400 });
    }

    // Store avatar as data URL or public asset URL
    const mimeType = validation.mimeType || "image/png";
    const base64 = buffer.toString("base64");
    const avatarUrl = `data:${mimeType};base64,${base64}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    logger.error("[user/avatar] Error uploading avatar:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}
