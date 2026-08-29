import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { clipsStore } from "../clipsStore";
import type { ApiResponse } from "../../types";
import { bulkUpdateTagsBodySchema, bulkUpdateStatusBodySchema } from "../../schemas/index";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("operation");

  if (!operation) {
    return NextResponse.json(
      { error: "Missing required query parameter: operation (tags|status)" },
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  clipsStore.getClipsForUser(session.user.id);

  if (operation === "tags") {
    const parsed = bulkUpdateTagsBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clipIds, tags, mode } = parsed.data;

    const unowned = clipsStore.findUnownedClipIds(session.user.id, clipIds);
    if (unowned.length > 0) {
      return NextResponse.json(
        { error: "One or more clips do not belong to you", unownedClipIds: unowned },
        { status: 403 }
      );
    }

    const result = clipsStore.bulkUpdateTags(session.user.id, clipIds, tags, mode);

    const body: ApiResponse<{
      success: boolean;
      updatedCount: number;
      errors: Array<{ clipId: string; error: string }>;
    }> = {
      data: {
        success: result.errors.length === 0,
        updatedCount: result.updatedCount,
        errors: result.errors,
      },
      error: null,
    };

    return NextResponse.json(body);
  }

  if (operation === "status") {
    const parsed = bulkUpdateStatusBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clipIds, status } = parsed.data;

    const unowned = clipsStore.findUnownedClipIds(session.user.id, clipIds);
    if (unowned.length > 0) {
      return NextResponse.json(
        { error: "One or more clips do not belong to you", unownedClipIds: unowned },
        { status: 403 }
      );
    }

    const result = clipsStore.bulkUpdateStatus(session.user.id, clipIds, status);

    const body: ApiResponse<{
      success: boolean;
      updatedCount: number;
      errors: Array<{ clipId: string; error: string }>;
    }> = {
      data: {
        success: result.errors.length === 0,
        updatedCount: result.updatedCount,
        errors: result.errors,
      },
      error: null,
    };

    return NextResponse.json(body);
  }

  return NextResponse.json(
    { error: `Unknown operation: ${operation}. Supported: tags, status` },
    { status: 400 }
  );
}
