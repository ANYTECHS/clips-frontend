import { NextResponse } from "next/server";
import type { ApiResponse } from "@/app/api/types";
import { TRANSFORM_STYLES, type TransformStyle, type TransformStyleVariants } from "@/app/lib/transformStyles";

export type { TransformStyle, TransformStyleVariants };

// ─── GET /api/transform/styles ────────────────────────────────────────────────

/**
 * Returns the list of available AI transformation style presets.
 *
 * Response: 200 { data: TransformStyle[], error: null }
 *
 * This endpoint is intentionally unauthenticated — style metadata is
 * public information and safe to expose without a session. The style
 * catalogue itself lives in app/lib/transformStyles.ts (issue #802) so new
 * styles can be added without touching this handler.
 */
export async function GET(): Promise<NextResponse<ApiResponse<TransformStyle[]>>> {
  return NextResponse.json(
    { data: TRANSFORM_STYLES, error: null },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
