import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { privacyStore } from "@/app/api/explore/exploreStore";
import { privacySettingsSchema } from "@/app/api/schemas/privacy.schema";
import type { ApiResponse } from "../types";

/**
 * GET /api/user/privacy — get explore privacy preferences.
 * PATCH — update explore opt-in and username visibility.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const settings = privacyStore.get(userId);

  const body: ApiResponse<{
    exploreOptIn: boolean;
    showUsername: boolean;
  }> = {
    data: {
      exploreOptIn: settings.exploreOptIn,
      showUsername: settings.showUsername,
    },
    error: null,
  };

  return NextResponse.json(body);
}

export async function PATCH(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const validation = privacySettingsSchema.safeParse(parsedBody.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 400 },
    );
  }

  const updated = privacyStore.update(userId, validation.data);

  const body: ApiResponse<{
    exploreOptIn: boolean;
    showUsername: boolean;
  }> = {
    data: {
      exploreOptIn: updated.exploreOptIn,
      showUsername: updated.showUsername,
    },
    error: null,
  };

  return NextResponse.json(body);
}
