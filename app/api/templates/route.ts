import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { templatesStore, type TemplateResponse } from "./templatesStore";
import { getTemplateScope } from "./templateScope";
import { createTemplateBodySchema } from "@/app/api/schemas/templates.schema";
import type { ApiResponse } from "@/app/api/types";

/**
 * GET /api/templates
 *
 * Returns built-in presets plus every template the caller may read: their own
 * templates and, when the session exposes a team scope, templates teammates
 * have explicitly shared.
 */
export async function GET() {
  const scope = await getTemplateScope();
  if (!scope) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const templates = templatesStore.list(scope);
  const body: ApiResponse<{ templates: TemplateResponse[] }> = {
    data: { templates },
    error: null,
  };
  return NextResponse.json(body);
}

/**
 * POST /api/templates
 *
 * Creates a user-owned template at version 1.
 */
export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const scope = await getTemplateScope();
  if (!scope) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;

  const validation = createTemplateBodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      {
        data: null,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: validation.error.issues,
      },
      { status: 400 }
    );
  }

  const template = templatesStore.create(validation.data, scope);
  const body: ApiResponse<{ template: TemplateResponse }> = {
    data: { template },
    error: null,
  };
  return NextResponse.json(body, { status: 201 });
}
