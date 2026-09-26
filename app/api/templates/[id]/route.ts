import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import {
  templatesStore,
  type ClipTemplate,
  type TemplateResponse,
  type TemplateVersion,
} from "../templatesStore";
import { getTemplateScope } from "../templateScope";
import { updateTemplateBodySchema } from "@/app/api/schemas/templates.schema";
import type { ApiResponse } from "@/app/api/types";

type RouteContext = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json(
    { data: null, error: "Template not found", code: "NOT_FOUND" },
    { status: 404 }
  );

const unauthorized = () =>
  NextResponse.json({ data: null, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

/**
 * GET /api/templates/:id
 *
 * Returns the current revision, or a specific immutable revision when
 * `?version=` is supplied.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const scope = await getTemplateScope();
  if (!scope) return unauthorized();

  const { id } = await context.params;
  const versionParam = request.nextUrl.searchParams.get("version");

  let data: { template: TemplateResponse | TemplateVersion };
  if (versionParam !== null) {
    const version = Number(versionParam);
    if (!Number.isInteger(version) || version < 1) {
      return NextResponse.json(
        { data: null, error: "version must be a positive integer", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    const snapshot = templatesStore.getVersion(id, version, scope);
    if (!snapshot) return notFound();
    data = { template: snapshot };
  } else {
    const template = templatesStore.get(id, scope);
    if (!template) return notFound();
    data = { template };
  }

  const body: ApiResponse<typeof data> = { data, error: null };
  return NextResponse.json(body);
}

/**
 * PATCH /api/templates/:id
 *
 * Optimistic concurrency: `expectedVersion` must match the currently stored
 * revision. A successful update stores the previous revision immutably.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimited = await applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const scope = await getTemplateScope();
  if (!scope) return unauthorized();

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;

  const validation = updateTemplateBodySchema.safeParse(parsed.body);
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

  const { id } = await context.params;
  const { expectedVersion, ...changes } = validation.data;
  const result = templatesStore.update(id, expectedVersion, changes, scope);

  if ("status" in result) {
    if (result.status === "not-found") return notFound();
    if (result.status === "forbidden") {
      return NextResponse.json(
        { data: null, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    if (result.status === "preset") {
      return NextResponse.json(
        { data: null, error: "Built-in presets cannot be modified", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        data: null,
        error: "Template was updated by someone else. Reload and try again.",
        code: "CONFLICT",
      },
      { status: 409 }
    );
  }

  const body: ApiResponse<{ template: TemplateResponse }> = {
    data: { template: result.template },
    error: null,
  };
  return NextResponse.json(body);
}

/**
 * DELETE /api/templates/:id
 *
 * Only the owner may delete a user template. Presets are immutable.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimited = await applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const scope = await getTemplateScope();
  if (!scope) return unauthorized();

  const { id } = await context.params;
  const result = templatesStore.delete(id, scope);

  if (result === "not-found") return notFound();
  if (result === "forbidden") {
    return NextResponse.json(
      { data: null, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  if (result === "preset") {
    return NextResponse.json(
      { data: null, error: "Built-in presets cannot be deleted", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body: ApiResponse<{ success: true }> = {
    data: { success: true },
    error: null,
  };
  return NextResponse.json(body);
}

// Re-exported for route-level type consumers.
export type { ClipTemplate };
